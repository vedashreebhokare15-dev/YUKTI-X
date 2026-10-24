"""Throwaway: does a box hold forest with recent reference loss at all?

One cheap 30 m query per candidate answers that before any Sentinel-2 composite is
paid for. `loss` and `no_loss` are the cells that would actually carry a label under
the project's share rules, not merely cells with canopy.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from forestguard import config, mlsplit, reflabels


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--boxes", required=True,
                        help="name:lon:lat[,name:lon:lat...] south-west corners")
    parser.add_argument("--degrees", type=float, default=0.05)
    parser.add_argument("--window", nargs=2, type=int, default=[21, 25])
    parser.add_argument("--cell", type=float, default=config.TRAINING_CELL_METERS)
    parser.add_argument("--stride", type=float, default=config.SAMPLE_STRIDE_METERS)
    args = parser.parse_args()

    import ee

    ee.Initialize(project=args.project)

    for entry in args.boxes.split(","):
        name, lon, lat = entry.split(":")
        lon, lat = float(lon), float(lat)
        box = (lon, lat, lon + args.degrees, lat + args.degrees)
        centres = mlsplit.grid_points(box, args.stride / mlsplit.METRES_PER_DEGREE_LAT)
        collection = ee.FeatureCollection([
            ee.Feature(ee.Geometry.Rectangle(
                mlsplit.cell_box(centre, args.cell, latitude=centre[1])),
                {"cell_lon": centre[0], "cell_lat": centre[1]})
            for centre in centres
        ])
        scanned = (
            ee.Image(config.REFERENCE_ASSET)
            .select([config.REFERENCE_LOSS_BAND, config.REFERENCE_COVER_BAND, "datamask"])
            .reduceRegions(collection=collection,
                           reducer=ee.Reducer.frequencyHistogram(),
                           scale=config.REFERENCE_PIXEL_METERS, tileScale=2)
            .getInfo()["features"]
        )
        loss = stable = abstained = below = 0
        for feature in scanned:
            properties = feature["properties"]
            cover = properties.get(config.REFERENCE_COVER_BAND) or {}
            mean_cover = reflabels.histogram_mean(cover)
            if mean_cover is None or mean_cover < config.MIN_TRAINING_TREE_COVER:
                below += 1
                continue
            counts = reflabels.counts_from_histogram(
                properties.get(config.REFERENCE_LOSS_BAND) or {},
                loss_window=tuple(args.window),
                observed_pixels=reflabels.canopy_pixels(
                    cover, config.MIN_TRAINING_TREE_COVER),
            )
            label = reflabels.label_cell(**counts)["label"]
            if label == reflabels.LOSS:
                loss += 1
            elif label == reflabels.NO_LOSS:
                stable += 1
            else:
                abstained += 1
        print(f"{name:14s} {lon:.2f},{lat:.2f}: {len(centres)} cells -> "
              f"loss {loss}, no_loss {stable}, abstained {abstained}, "
              f"below canopy gate {below}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
