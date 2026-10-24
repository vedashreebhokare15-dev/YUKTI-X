"""Ask the reference layer where the forest actually is, before compositing anything.

A training cell needs canopy to lose. Hansen's `treecover2000` answers that in one
cheap request, so this scan runs at a coarse stride over a whole region and ranks
its cells by mean canopy. The winning coordinates go straight into
`build_training_set.py --at LON LAT`, which spends the slow Sentinel-2 requests only
on cells that can carry a label.

Run:
    python scripts/locate_forest.py --project vanadrishti --region maharashtra
    python scripts/locate_forest.py --project vanadrishti --region tripura --stride 2000
"""

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from forestguard import config, mlsplit, reflabels  # noqa: E402


def ring_box(ring):
    lons = [point[0] for point in ring]
    lats = [point[1] for point in ring]
    return (min(lons), min(lats), max(lons), max(lats))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--region", required=True, choices=sorted(config.ML_REGIONS))
    parser.add_argument("--stride", type=int, default=3000,
                        help="metres between scan cell centres")
    parser.add_argument("--min-cover", type=float, default=config.MIN_TRAINING_TREE_COVER)
    args = parser.parse_args()

    import ee

    ee.Initialize(project=args.project)
    region = config.ML_REGIONS[args.region]
    box = ring_box(region["aoi"])
    centres = mlsplit.grid_points(box, args.stride / mlsplit.METRES_PER_DEGREE_LAT)
    features = ee.FeatureCollection([
        ee.Feature(
            ee.Geometry.Rectangle(mlsplit.cell_box(centre, config.TRAINING_CELL_METERS,
                                                   latitude=centre[1])),
            {"cell_lon": centre[0], "cell_lat": centre[1]},
        )
        for centre in centres
    ])
    print(f"{args.region}: scanning {len(centres)} cells at {args.stride} m "
          f"against {config.REFERENCE_ASSET}")

    start = time.time()
    scanned = (
        ee.Image(config.REFERENCE_ASSET)
        .select([config.REFERENCE_COVER_BAND, config.REFERENCE_LOSS_BAND, "datamask"])
        .reduceRegions(
            collection=features,
            reducer=ee.Reducer.frequencyHistogram(),
            scale=config.REFERENCE_PIXEL_METERS,
            tileScale=2,
        )
        .getInfo()
    )
    print(f"scan returned in {time.time() - start:.1f} s")

    rows = []
    for feature in scanned["features"]:
        properties = feature["properties"]
        cover_hist = properties.get(config.REFERENCE_COVER_BAND) or {}
        loss_hist = properties.get(config.REFERENCE_LOSS_BAND) or {}
        cover = reflabels.histogram_mean(cover_hist)
        loss = reflabels.counts_from_histogram(
            loss_hist,
            loss_window=tuple(region["loss_window"]),
            observed_pixels=reflabels.canopy_pixels(cover_hist, args.min_cover),
        )
        years = [int(key) for key in loss_hist if int(key) > 0]
        rows.append({
            "lon": properties["cell_lon"],
            "lat": properties["cell_lat"],
            "mean_cover": None if cover is None else round(cover, 2),
            "loss_pixels": loss["loss_pixels"],
            "stable_pixels": round(loss["stable_pixels"], 2),
            "unknown_pixels": round(loss["unknown_pixels"], 2),
            "any_loss_year": sum(loss_hist.values()) if loss_hist else 0,
            "max_loss_year": max(years) if years else None,
            "land": int((properties.get("datamask") or {}).get("1", 0)),
        })

    usable = [row for row in rows
              if row["mean_cover"] is not None and row["mean_cover"] >= args.min_cover]
    header = (f"{'lon':>10} {'lat':>9} {'cover%':>8} {'loss':>6} {'stable':>8} "
              f"{'anyyear':>8} {'maxyr':>6}")

    def table(title, picked):
        print(f"\n{title}")
        print(header)
        for row in picked:
            print(f"{row['lon']:>10.5f} {row['lat']:>9.5f} "
                  f"{('-' if row['mean_cover'] is None else row['mean_cover']):>8} "
                  f"{row['loss_pixels']:>6.2f} {row['stable_pixels']:>8.2f} "
                  f"{row['any_loss_year']:>8.2f} "
                  f"{'- ' if row['max_loss_year'] is None else row['max_loss_year']:>6}")

    print(f"cells at or above {args.min_cover}% canopy: {len(usable)} of {len(rows)}")
    table("richest canopy", sorted(usable, key=lambda r: -r["mean_cover"])[:8])
    table(f"cells reporting loss in window {region['loss_window']}",
          sorted(rows, key=lambda r: -r["loss_pixels"])[:8])
    table("cells reporting loss in any year",
          sorted(rows, key=lambda r: -r["any_loss_year"])[:8])

    labelable = [row for row in usable if row["loss_pixels"] > 0]
    if labelable:
        best = labelable[0]
        print(f"\nnext step: python scripts/build_training_set.py "
              f"--project {args.project} --region {args.region} "
              f"--at {best['lon']:.5f} {best['lat']:.5f}")
    else:
        if usable:
            print(f"\nforested cells exist but none reports loss in window "
                  f"{region['loss_window']}: this slice can only supply stable "
                  f"labels, so move the slice or choose another region")
        else:
            print("\nno scanned cell reaches the canopy gate; widen the stride "
                  "or choose another region")

    out = os.path.join("data", f"forest_scan_{args.region}.json")
    os.makedirs("data", exist_ok=True)
    with open(out, "w", encoding="utf-8") as handle:
        json.dump({"region": args.region, "asset": config.REFERENCE_ASSET,
                   "stride_meters": args.stride, "min_cover": args.min_cover,
                   "cells": rows}, handle, indent=1)
    print(f"wrote {out}")
    return 0 if usable else 4


if __name__ == "__main__":
    sys.exit(main())
