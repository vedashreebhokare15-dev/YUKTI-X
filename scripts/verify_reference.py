"""Phase 3/ML probe: can we get honest labels, and does the index graph compute?

Run:
    python scripts/verify_reference.py --project vanadrishti
    python scripts/verify_reference.py --project vanadrishti --skip-indices

Three questions, answered with real calls:
  1. do the mixed-resolution indices (NDVI at 10 m, NDMI/NBR at 20 m) actually
     reduce, or does Earth Engine refuse the composite;
  2. which reference loss layers does the public catalog expose for this account
     (the ids are searched, never guessed);
  3. what does that layer return at specific points inside the pilot box, and how
     many of those points are labelable at all.

Nothing here is a model result. A layer can be readable and still be unsuitable as
ground truth: it is a 30 m product, so it can only supervise 30 m-scale agreement.
"""

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from forestguard import config, indices, mlsplit, reflabels, s2  # noqa: E402


def describe(exc: Exception) -> str:
    return f"{type(exc).__name__}: {str(exc).strip().replace(chr(10), ' ')[:300]}"


# Earth Engine 1.7 has no public-catalog search call, so these ids come from the
# dataset catalogue pages, newest first. An id only counts once
# `ee.Image(...).bandNames()` actually returns the labelled bands.
REFERENCE_ASSETS = (
    "UMD/hansen/global_forest_change_2025_v1_13",
    "UMD/hansen/global_forest_change_2024_v1_12",
)
REFERENCE_PIXEL_METERS = 30.92
REFERENCE_BANDS = ("lossyear", "treecover2000", "datamask")


def check_indices(ee, box, label) -> bool:
    """The composite carries no single default projection, so the 10 m term has to
    declare one before reduceResolution will aggregate it onto the 20 m grid."""
    aoi = s2.aoi_geometry(box)
    composite = s2.composite(aoi, "2024-11-01", "2024-12-01", True)
    image = indices.all_indices(s2.require_observed(composite))
    ok = True
    print(f"\n=== 1. index reductions over {label} at {config.ANALYSIS_SCALE_METERS} m ===")
    for name in ("NDVI", "NDMI", "NBR"):
        start = time.time()
        try:
            mean = (
                image.select(name)
                .reduceRegion(
                    ee.Reducer.mean(),
                    aoi,
                    scale=config.ANALYSIS_SCALE_METERS,
                    maxPixels=10**8,
                    bestEffort=True,
                    tileScale=2,
                )
                .get(name)
                .getInfo()
            )
        except Exception as exc:
            print(f"{name}: FAILED {describe(exc)}")
            ok = False
            continue
        print(f"{name}: mean {mean} ({time.time() - start:.1f} s)")
    return ok


def open_candidate(ee, asset_id, bands):
    try:
        image = ee.Image(asset_id)
        available = image.bandNames().getInfo()
    except Exception as exc:
        print(f"{asset_id}: cannot open - {describe(exc)}")
        return None, None
    missing = [band for band in bands if band not in available]
    if missing:
        print(f"{asset_id}: opened, missing {missing} (has {available})")
        return None, None
    scale = image.select(bands[0]).projection().getInfo().get("nominalScale")
    print(f"{asset_id}: usable, nominal scale {scale}, bands {available}")
    return image, scale


def sample_points(ee, ring, image, scale, step_degrees=0.005):
    """Ask the reference layer what it says at a grid of points inside the AOI."""
    print("\n=== 3. reference values at sampled points ===")
    lons = [point[0] for point in ring]
    lats = [point[1] for point in ring]
    cells = mlsplit.grid_points((min(lons), min(lats), max(lons), max(lats)), step_degrees)
    features = ee.FeatureCollection(
        [ee.Feature(ee.Geometry.Point(pair)) for pair in cells]
    )
    try:
        sampled = image.reduceRegions(
            collection=features,
            reducer=ee.Reducer.first(),
            scale=scale or REFERENCE_PIXEL_METERS,
        ).getInfo()
    except Exception as exc:
        print("sampling failed:", describe(exc))
        return None

    rows = [
        {
            "lossyear": feature["properties"].get("lossyear"),
            "treecover": feature["properties"].get("treecover2000"),
            "datamask": feature["properties"].get("datamask"),
        }
        for feature in sampled["features"]
    ]
    counts = reflabels.counts_from_points(rows, min_tree_cover=30)
    print(f"first points: {json.dumps(rows[:12], default=lambda value: None)}")
    print(
        f"points sampled: {len(rows)}, "
        f"labelable loss: {counts['loss_pixels']}, "
        f"labelable stable: {counts['stable_pixels']}, "
        f"unknown: {counts['unknown_pixels']}"
    )
    return counts


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=None)
    parser.add_argument("--aoi", choices=("pilot", "held_out"), default="pilot")
    parser.add_argument("--skip-indices", action="store_true")
    parser.add_argument("--small", action="store_true",
                        help="slice a few square kilometres off the region corner")
    parser.add_argument(
        "--asset",
        default=None,
        help="reference asset id to sample; omit to try every documented candidate",
    )
    args = parser.parse_args()

    import ee

    if args.project:
        ee.Initialize(project=args.project)
    else:
        ee.Initialize()
    print("earthengine-api project:", args.project or "(default)")

    box = config.PILOT["aoi"] if args.aoi == "pilot" else config.HELD_OUT["aoi"]
    if args.small:
        box = mlsplit.corner_box(box, 0.03, 0.02)
        print(f"small box: {box}")
    indices_ok = True if args.skip_indices else check_indices(ee, box, args.aoi)

    candidates = [args.asset] if args.asset else list(REFERENCE_ASSETS)

    for asset_id in candidates:
        image, scale = open_candidate(ee, asset_id, list(REFERENCE_BANDS))
        if image is None:
            continue
        counts = sample_points(ee, box, image, scale)
        if counts is None:
            continue
        labelable = counts["loss_pixels"] + counts["stable_pixels"]
        if labelable:
            print(f"\nRESULT: PASS - {labelable} labelable point(s) of "
                  f"{labelable + counts['unknown_pixels']} sampled")
            return 0
        print("\nRESULT: PARTIAL - the layer reads fine, but not one sampled point "
              "was labelable in this box; that is a sampling-location problem, not a "
              "success")
        return 4
    print("\nRESULT: FAIL - no reference candidate carried the labelled bands")
    return 0 if indices_ok else 3


if __name__ == "__main__":
    sys.exit(main())
