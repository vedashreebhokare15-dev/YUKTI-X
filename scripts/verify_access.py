"""Phase 1/3 probe: is Earth Engine reachable, and what does the data look like.

Run:
    python scripts/verify_access.py --project YOUR_PROJECT_ID
    python scripts/verify_access.py --project YOUR_PROJECT_ID --aoi pilot --probability

Nothing here exports imagery and nothing here is a forest-loss result. It answers
three questions with real numbers: does the account initialize, how many scenes
exist in a window, and how many of them survive the quality screen.
"""

import argparse
import importlib.metadata
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from forestguard import config, dataquality, s2, windows  # noqa: E402


def describe(exc: Exception) -> str:
    text = str(exc).strip().replace("\n", " ")
    return f"{type(exc).__name__}: {text[:300]}"


def initialize(ee, project):
    print("=== 1. initialize ===")
    try:
        ee.Initialize(project=project) if project else ee.Initialize()
    except Exception as exc:
        print("FAILED", describe(exc))
        if "no project" in str(exc):
            print("\nThe Google sign-in worked but this account has no Earth Engine project.")
            print("Open https://code.earthengine.google.com/ in the same browser profile.")
            print("If it asks you to sign up, Earth Engine is not enabled for this account yet.")
        return False
    print("initialized: yes")
    return True


def report_window(ee, aoi_box, label, start, end, use_probability) -> bool:
    aoi = s2.aoi_geometry(aoi_box)
    try:
        found, usable = (int(value.getInfo()) for value in s2.scene_counts(aoi, start, end))
    except Exception as exc:
        print(f"FAILED - {label}: {describe(exc)}")
        return False

    quality = dataquality.assess_window(start, end, found, usable)
    print(f"\n=== {label}: {start} .. {end} "
          f"({'probability-screened' if use_probability else 'QA60 only'}) ===")
    print(f"scenes found: {found}, usable after join: {usable}, status: {quality.status}")
    for note in quality.notes:
        print(f"  note: {note}")
    if not quality.reportable:
        return False

    collection = s2.load(aoi, start, end, use_probability)
    dates = windows.dates_from_millis(
        collection.aggregate_array("system:time_start").getInfo()
    )
    clouds = collection.aggregate_array("CLOUDY_PIXEL_PERCENTAGE").getInfo()
    print(f"acquisitions: {', '.join(dates[:8])}{' ...' if len(dates) > 8 else ''}")
    summary = dataquality.cloud_percentage_summary(clouds)
    if summary["scenes"]:
        print(f"scene cloud cover: mean {summary['mean']:.1f}% "
              f"(min {summary['minimum']:.1f}%, max {summary['maximum']:.1f}%) "
              f"over {summary['scenes']} scenes")
    else:
        print("scene cloud cover: not reported by these scenes")

    print("compositing over the AOI at 20 m ...")
    comp = s2.composite(aoi, start, end, use_probability)
    stats = comp.reduceRegion(ee.Reducer.mean(), aoi, scale=20,
                              bestEffort=True, maxPixels=10 ** 8).getInfo()
    print("per-band mean:", {k: (round(v, 3) if isinstance(v, float) else v)
                             for k, v in stats.items()})
    if stats.get("valid_obs") is None:
        print("RESULT: PARTIAL - the composite produced no valid-observation count")
        return False
    print("RESULT: PASS - a real composite was computed and counted")
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=None,
                        help="Google Cloud project ID with Earth Engine enabled")
    parser.add_argument("--aoi", choices=("pilot", "held_out"), default="held_out")
    parser.add_argument("--start", default=config.ACCESS_PROBE["date_range"][0])
    parser.add_argument("--end", default=config.ACCESS_PROBE["date_range"][1])
    parser.add_argument("--probability", action="store_true",
                        help="also require a matching cloud-probability scene")
    args = parser.parse_args()

    import ee
    print("earthengine-api:", importlib.metadata.version("earthengine-api"))
    if not initialize(ee, args.project):
        return 2

    box = config.PILOT["aoi"] if args.aoi == "pilot" else config.HELD_OUT["aoi"]
    name = (config.PILOT if args.aoi == "pilot" else config.HELD_OUT)["name"]
    ok = report_window(ee, box, name, args.start, args.end, args.probability)
    return 0 if ok else 3


if __name__ == "__main__":
    sys.exit(main())
