"""Measure how the 30 m reference histogram is counted for one cell.

The training table reported fractional reference pixels (0.74 loss, 2.95 stable) for
a 90 m box that should hold about nine whole 30 m pixels. Fractional counts mean the
request resampled a degree-gridded product with a metre scale, which mixes pixels
across class values. This probe asks the same box three ways and prints what comes
back, so the fix is chosen on measurement rather than on a guess about resampling.

Throwaway diagnostic: it changes nothing and writes nothing.
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from forestguard import config, mlsplit


def show(label, histogram):
    payload = json.dumps(histogram, sort_keys=True)
    total = sum(value for value in (histogram or {}).values() if value is not None)
    fractional = any(value is not None and float(value) != int(float(value))
                     for value in (histogram or {}).values())
    print(f"{label:38s} pixels={total:6.2f} fractional={fractional} {payload[:150]}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--lon", type=float, required=True)
    parser.add_argument("--lat", type=float, required=True)
    parser.add_argument("--side", type=float, default=config.TRAINING_CELL_METERS)
    args = parser.parse_args()

    import ee

    ee.Initialize(project=args.project)

    reference = ee.Image(config.REFERENCE_ASSET).select(
        [config.REFERENCE_LOSS_BAND, config.REFERENCE_COVER_BAND, "datamask"]
    )
    box = mlsplit.cell_box((args.lon, args.lat), args.side, latitude=args.lat)
    cell = ee.FeatureCollection(
        [ee.Feature(ee.Geometry.Rectangle(box), {"cell_lon": args.lon, "cell_lat": args.lat})]
    )
    print(f"cell {args.lon}, {args.lat} side {args.side} m -> box {box}")
    print(f"reference asset {config.REFERENCE_ASSET} "
          f"nominal pixel {config.REFERENCE_PIXEL_METERS} m")

    variants = {
        "A scale in metres (what shipped)": reference,
        "D reproject to native degrees": reference.reproject(
            crs="EPSG:4326", scale=config.REFERENCE_PIXEL_METERS
        ),
        "E mode reduceResolution, snapped": reference.reduceResolution(
            reducer=ee.Reducer.mode(), maxPixels=int(1e6)
        ).reproject(crs="EPSG:4326", scale=config.REFERENCE_PIXEL_METERS),
    }
    for label, image in variants.items():
        try:
            features = image.reduceRegions(
                collection=cell,
                reducer=ee.Reducer.frequencyHistogram(),
                scale=config.REFERENCE_PIXEL_METERS,
                tileScale=1,
            ).getInfo()["features"]
        except Exception as exc:  # noqa: BLE001 - a probe should say what failed
            print(f"{label:38s} FAILED {type(exc).__name__}: {str(exc)[:120]}")
            continue
        properties = features[0]["properties"]
        show(f"{label} lossyear", properties.get(config.REFERENCE_LOSS_BAND))
        show(f"{label} datamask", properties.get("datamask"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
