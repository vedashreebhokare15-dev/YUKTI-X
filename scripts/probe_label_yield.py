"""Throwaway: how many cells in a slice become a label, at each box size?

A 30 m reference layer asked for at a metre scale comes back area-weighted, so a 90 m
box holds a handful of fractional pixels and a share computed from them often falls
under the "enough reference pixels" gate. This prints the label yield before any
Sentinel-2 composite is paid for.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from forestguard import config, mlsplit, reflabels

import build_training_set as builder


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--region", required=True, choices=sorted(config.ML_REGIONS))
    parser.add_argument("--east", type=float, default=0.03)
    parser.add_argument("--north", type=float, default=0.02)
    parser.add_argument("--at", nargs=2, type=float, default=None)
    parser.add_argument("--limit", type=int, default=400)
    parser.add_argument("--sizes", default="90,150,200")
    parser.add_argument("--window", nargs=2, type=int, default=None,
                        help="inclusive relative loss years, from the region default")
    args = parser.parse_args()

    import ee

    ee.Initialize(project=args.project)

    region = dict(config.ML_REGIONS[args.region])
    if args.window:
        region["loss_window"] = tuple(args.window)
    region["aoi"] = mlsplit.corner_box(region["aoi"], args.east, args.north,
                                       origin=args.at)
    box = builder.ring_box(region["aoi"])
    step = config.SAMPLE_STRIDE_METERS / mlsplit.METRES_PER_DEGREE_LAT
    centres = mlsplit.grid_points(box, step)[: args.limit]
    print(f"{args.region}: {len(centres)} centres, window {region['loss_window']}")

    for size in [float(value) for value in args.sizes.split(",")]:
        scanned = (
            ee.Image(config.REFERENCE_ASSET)
            .select([config.REFERENCE_LOSS_BAND, config.REFERENCE_COVER_BAND, "datamask"])
            .reduceRegions(
                collection=builder.ee_cells(ee, centres, size),
                reducer=ee.Reducer.frequencyHistogram(),
                scale=config.REFERENCE_PIXEL_METERS,
                tileScale=2,
            )
            .getInfo()["features"]
        )
        loss = stable = abstained = below_gate = 0
        for feature in scanned:
            p = feature["properties"]
            cover_hist = p.get(config.REFERENCE_COVER_BAND) or {}
            mean_cover = reflabels.histogram_mean(cover_hist)
            if mean_cover is None or mean_cover < config.MIN_TRAINING_TREE_COVER:
                below_gate += 1
                continue
            counts = reflabels.counts_from_histogram(
                p.get(config.REFERENCE_LOSS_BAND) or {},
                loss_window=tuple(region["loss_window"]),
                observed_pixels=reflabels.canopy_pixels(
                    cover_hist, config.MIN_TRAINING_TREE_COVER
                ),
            )
            label = reflabels.label_cell(**counts)["label"]
            if label == reflabels.LOSS:
                loss += 1
            elif label == reflabels.NO_LOSS:
                stable += 1
            else:
                abstained += 1
        print(f"  cell {size:5.0f} m -> loss {loss}, no_loss {stable}, "
              f"abstained {abstained}, below canopy gate {below_gate}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
