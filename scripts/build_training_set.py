"""Sample one region into a labelled table: Earth Engine features, reference labels.

Run:
    python scripts/build_training_set.py --project vanadrishti --region maharashtra
    python scripts/build_training_set.py --project vanadrishti --region tripura

Each sampled cell is a `config.TRAINING_CELL_METERS` box, deliberately larger than
the 30 m reference pixel so a label comes from several reference pixels rather than
one. Features are the mean of the measured evidence inside the box; the label comes
from the `lossyear` histogram over the same box, gated on mean tree cover.

The output JSON is the training input, and it is also the audit trail: it records
which asset answered, which windows were composited, how many cells were abstained
and why, and the exact thresholds used. Nothing here is a model or a metric.
"""

import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from forestguard import (
    baseline,
    change,
    config,
    mlsplit,
    mlfeatures,
    reflabels,
    s2,
)

INDICES = ("NDVI", "NDMI", "NBR")


def relative_year(date_text: str) -> int:
    """Calendar year to the `lossyear` number the reference product uses."""
    return int(date_text[:4]) - 2000


def pair_is_labelable(region):
    """Why these windows cannot supervise this loss window, if they cannot.

    A loss later than the after image is invisible in the features; a loss earlier
    than the before image is already baked into them. Either way the row would teach
    a relationship between a measurement and an event that cannot line up.
    """
    first, last = region["loss_window"]
    if last > relative_year(region["after"][1]):
        return (f"loss year {last} is at or after the end of the after window "
                f"({region['after'][1]}), so a loss that late has no measured "
                "after image to be seen in")
    if first <= relative_year(region["before"][0]):
        return (f"loss year {first} is at or before the start of the before window "
                f"({region['before'][0]}), so the features already carry the loss "
                "they are meant to teach")
    return None


def describe(exc: Exception) -> str:
    return f"{type(exc).__name__}: {str(exc).strip().replace(chr(10), ' ')[:400]}"


def ring_box(ring):
    lons = [point[0] for point in ring]
    lats = [point[1] for point in ring]
    return (min(lons), min(lats), max(lons), max(lats))


def evidence_image(ee, region, label):
    """The measured bands the model consumes, as one multi-band image."""
    ring = region["aoi"]
    before = baseline.period_evidence(ring, *region["before"], use_cloud_probability=True)
    after = baseline.period_evidence(ring, *region["after"], use_cloud_probability=True)
    baselines = baseline.seasonal_baselines(
        ring, region["after"], region["history_years"], INDICES,
        use_cloud_probability=True,
    )
    evidence, _ = change.build_change(before, after, baselines)
    wide = evidence.addBands(
        before.select(["NDMI", "NBR"]).rename(["NDMI_before", "NBR_before"])
    )
    print(f"{label}: evidence image holds {len(wide.bandNames().getInfo())} bands")
    return wide


def sample_centres(region, stride_meters, limit):
    """The cell centres this slice will be sampled at."""
    box = ring_box(region["aoi"])
    step_degrees = stride_meters / mlsplit.METRES_PER_DEGREE_LAT
    centres = mlsplit.grid_points(box, step_degrees)
    if limit:
        centres = centres[:limit]
    print(f"cells to sample: {len(centres)}")
    return centres


def ee_cells(ee, centres, cell_meters):
    """One Earth Engine box per centre, carrying that centre as properties."""
    return ee.FeatureCollection([
        ee.Feature(
            ee.Geometry.Rectangle(mlsplit.cell_box(centre, cell_meters,
                                                   latitude=centre[1])),
            {"cell_lon": centre[0], "cell_lat": centre[1]},
        )
        for centre in centres
    ])


def reference_cells(ee, region, centres, min_tree_cover, cell_meters):
    """Ask the cheap 30 m reference asset about every cell, before any compositing."""
    start = time.time()
    scanned = (
        ee.Image(config.REFERENCE_ASSET)
        .select([config.REFERENCE_LOSS_BAND, config.REFERENCE_COVER_BAND, "datamask"])
        .reduceRegions(
            collection=ee_cells(ee, centres, cell_meters),
            reducer=ee.Reducer.frequencyHistogram(),
            scale=config.REFERENCE_PIXEL_METERS,
            tileScale=2,
        )
        .getInfo()
    )
    print(f"reference histograms returned in {time.time() - start:.1f} s")
    cells = []
    for feature in scanned["features"]:
        properties = feature["properties"]
        lon, lat = properties["cell_lon"], properties["cell_lat"]
        cover_hist = properties.get(config.REFERENCE_COVER_BAND) or {}
        cells.append({
            "cell_id": f"{lon:.5f}_{lat:.5f}",
            "position": (lon, lat),
            "stats": {},
            "counts": reflabels.counts_from_histogram(
                properties.get(config.REFERENCE_LOSS_BAND) or {},
                loss_window=tuple(region["loss_window"]),
                # `lossyear` is masked wherever nothing was lost, so the pixels that
                # are forested but absent from that histogram are stability.
                observed_pixels=reflabels.canopy_pixels(cover_hist, min_tree_cover),
            ),
            "forest_cover": reflabels.histogram_mean(cover_hist),
        })
    return cells


def feature_cells(ee, wide, centres, cells, batch_size, tile_scale, cell_meters):
    """Ask for the Sentinel-2 means in batches.

    One request for every cell in the slice hit the Earth Engine computation
    timeout, so the sample is cut into batches that each finish. A batch that
    still fails leaves only its own cells unmeasured, and `build_dataset` drops
    those with a recorded reason rather than the run dying.
    """
    start = time.time()
    size = batch_size if batch_size > 0 else max(len(centres), 1)
    total = -(-len(centres) // size)
    # A batch's cells sit in a contiguous run of the grid, so the image is clipped
    # to just that swath: each request then composites its own slice of the windows
    # instead of re-doing the whole region's baselines.
    from math import cos, radians

    pad_degrees = (cell_meters / 2 / mlsplit.METRES_PER_DEGREE_LAT
                   / cos(radians(max(centre[1] for centre in centres))))
    collected = []
    failed = 0
    for number, index in enumerate(range(0, len(centres), size), start=1):
        batch = centres[index:index + size]
        batch_start = time.time()
        try:
            swath = wide.clip(ee.Geometry.Rectangle(
                *mlsplit.expand_box(mlsplit.points_box(batch), pad_degrees)))
            measured = swath.reduceRegions(
                collection=ee_cells(ee, batch, cell_meters),
                reducer=ee.Reducer.mean(),
                scale=config.ANALYSIS_SCALE_METERS,
                tileScale=tile_scale,
            ).getInfo()["features"]
        except Exception as exc:
            failed += 1
            print(f"batch {number}/{total} FAILED after "
                  f"{time.time() - batch_start:.1f} s: {describe(exc)}", flush=True)
            continue
        collected.extend(measured)
        print(f"batch {number}/{total}: {len(measured)} cells in "
              f"{time.time() - batch_start:.1f} s", flush=True)
    mlfeatures.merge_means(cells, collected, config.FEATURE_BANDS)
    print(f"feature means: {len(collected)} of {len(centres)} cells answered, "
          f"{failed} failed batches, {time.time() - start:.1f} s total")
    return cells


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--region", required=True, choices=sorted(config.ML_REGIONS))
    parser.add_argument("--stride", type=int, default=config.SAMPLE_STRIDE_METERS,
                        help="metres between sampled cell centres")
    parser.add_argument("--limit", type=int, default=400,
                        help="cap on cells per run; 0 means no cap")
    parser.add_argument("--east", type=float, default=0.0,
                        help="degrees of longitude to sample from the region corner; "
                             "0 uses the whole region, which is what config.ML_REGIONS "
                             "boxes are sized for")
    parser.add_argument("--north", type=float, default=0.0)
    parser.add_argument("--at", nargs=2, type=float, metavar=("LON", "LAT"), default=None,
                        help="south-west corner of the slice, from scripts/locate_forest.py")
    parser.add_argument("--min-cover", type=float, default=config.MIN_TRAINING_TREE_COVER,
                        help="canopy percentage a cell needs before it is worth "
                             "compositing Sentinel-2 for")
    parser.add_argument("--dry-run", action="store_true",
                        help="stop after the reference pre-check, so a misplaced "
                             "slice costs seconds instead of a composite")
    parser.add_argument("--batch-size", type=int, default=60,
                        help="cells per Sentinel-2 request; the whole slice at once "
                             "exceeds the Earth Engine computation timeout")
    parser.add_argument("--tile-scale", type=int, default=4,
                        help="Earth Engine tileScale for the sampling requests")
    parser.add_argument("--loss-window", nargs=2, type=int, metavar=("FIRST", "LAST"),
                        default=None,
                        help="inclusive relative loss years that count as a positive; "
                             "one calendar year is too sparse to learn from in most "
                             "Indian forest, so a multi-year window is the honest unit")
    parser.add_argument("--before", nargs=2, metavar=("START", "END"), default=None,
                        help="before window; must sit entirely before the loss window, "
                             "otherwise the features start after the loss they teach")
    parser.add_argument("--after", nargs=2, metavar=("START", "END"), default=None)
    parser.add_argument("--cell-meters", type=float, default=config.TRAINING_CELL_METERS,
                        help="side of a sampled cell box")
    parser.add_argument("--max-rows", type=int, default=0,
                        help="cap the cells sent to the Sentinel-2 pass; every "
                             "reference-loss cell is kept and stable cells are then "
                             "taken evenly across the slice, 0 keeps them all")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    import ee

    ee.Initialize(project=args.project)

    region = dict(config.ML_REGIONS[args.region])
    if args.loss_window:
        region["loss_window"] = tuple(args.loss_window)
    if args.before:
        region["before"] = tuple(args.before)
    if args.after:
        region["after"] = tuple(args.after)
    problem = pair_is_labelable(region)
    if problem:
        print(f"REFUSED: {problem}")
        return 2
    if args.east and args.north:
        region["aoi"] = mlsplit.corner_box(region["aoi"], args.east, args.north,
                                           origin=args.at)
        origin = f" at {region['aoi'][0][0]:.5f}, {region['aoi'][0][1]:.5f}" if args.at else ""
        print(f"sampling slice: {args.east} x {args.north} degrees{origin}")

    # The reference asset answers in seconds; the Sentinel-2 composite takes minutes.
    # Asking it first keeps a mis-placed slice from spending the slow request.
    centres = sample_centres(region, args.stride, args.limit)
    cells = reference_cells(ee, region, centres, args.min_cover, args.cell_meters)
    forested = [cell for cell in cells if cell["forest_cover"] is not None
                and cell["forest_cover"] >= args.min_cover]
    for cell in forested:
        cell["reference_label"] = reflabels.label_cell(**cell["counts"])["label"]
    positives = [cell for cell in forested
                 if cell["reference_label"] == reflabels.LOSS]
    negatives = [cell for cell in forested
                 if cell["reference_label"] == reflabels.NO_LOSS]
    keep = positives
    if args.max_rows:
        room = max(0, args.max_rows - len(positives))
        step = -(-len(negatives) // room) if room else len(negatives) + 1
        keep = positives + negatives[:: max(step, 1)]
    else:
        keep = positives + negatives
    print(f"cells at or above {args.min_cover}% canopy: {len(forested)} of "
          f"{len(cells)}; {len(positives)} carry a loss label and {len(negatives)} "
          f"a stable one in window {region['loss_window']}; {len(keep)} of them go "
          f"to the Sentinel-2 pass")
    if not forested:
        print("RESULT: NO FOREST - no sampled cell reaches the canopy gate, so "
              "nothing was composited. Re-run scripts/locate_forest.py and move "
              "the slice with --at.")
        return 4

    if args.dry_run:
        print("RESULT: DRY RUN - reference pre-check only, nothing was composited")
        return 0

    wide = evidence_image(ee, region, args.region)
    # Only the cells the reference layer can label become rows, so the slow
    # Sentinel-2 pass asks for those alone.
    cells = feature_cells(ee, wide, [cell["position"] for cell in keep], cells,
                          args.batch_size, args.tile_scale, args.cell_meters)
    dataset = mlfeatures.build_dataset(
        keep,
        min_tree_cover=args.min_cover,
        loss_window=tuple(region["loss_window"]),
    )

    out = args.out or os.path.join(
        "data", f"training_{args.region}_{region['after'][0][:4]}.json"
    )
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    payload = {
        "provenance": {
            "region": args.region,
            "region_name": region["name"],
            "role": region["role"],
            "sample_ring": region["aoi"],
            "before_window": list(region["before"]),
            "after_window": list(region["after"]),
            "history_years": region["history_years"],
            "reference_asset": config.REFERENCE_ASSET,
            "reference_pixel_meters": config.REFERENCE_PIXEL_METERS,
            "loss_window": list(region["loss_window"]),
            "training_cell_meters": args.cell_meters,
            "stride_meters": args.stride,
            "analysis_scale_meters": config.ANALYSIS_SCALE_METERS,
            "min_tree_cover": config.MIN_TRAINING_TREE_COVER,
            "cloud_screening": "QA60 + cloud probability + 3 km buffer + shadow",
            "feature_names": list(mlfeatures.FEATURE_NAMES),
            "generated_by": "scripts/build_training_set.py",
        },
        "summary": dataset["summary"],
        "abstained": dataset["abstained"][:40],
        "dropped": dataset["dropped"][:40],
        "labels": dataset["labels"],
        "rows": [list(row) for row in dataset["rows"]],
        "kept": dataset["kept"],
    }
    with open(out, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=1)

    print(f"\nkept: {dataset['summary']}")
    print(f"wrote {out}")
    if dataset["summary"]["loss"] == 0 or dataset["summary"]["no_loss"] == 0:
        print("RESULT: PARTIAL - one class has no labelled cells, so this region "
              "cannot train or evaluate on its own")
        return 4
    print("RESULT: PASS - both classes carry labelled cells")
    return 0


if __name__ == "__main__":
    sys.exit(main())
