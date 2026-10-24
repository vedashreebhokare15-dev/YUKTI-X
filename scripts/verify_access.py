"""Phase 1 spike: prove Earth Engine is reachable and Sentinel-2 returns scenes.

Run: python scripts/verify_access.py --project YOUR_PROJECT_ID
"""

import argparse
import datetime
import sys

from forestguard import config, s2


def describe(exc: Exception) -> str:
    text = str(exc).strip().replace("\n", " ")
    return f"{type(exc).__name__}: {text[:300]}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", default=None, help="Google Cloud project ID with Earth Engine enabled")
    parser.add_argument("--start", default=config.ACCESS_PROBE["date_range"][0])
    parser.add_argument("--end", default=config.ACCESS_PROBE["date_range"][1])
    args = parser.parse_args()

    print("=== 1. import earthengine-api ===")
    import ee
    print("version:", ee.__version__)

    print("\n=== 2. initialize ===")
    try:
        ee.Initialize(project=args.project) if args.project else ee.Initialize()
    except Exception as exc:
        print("FAILED", describe(exc))
        if "no project" in str(exc):
            print("\nThe Google sign-in worked but this account has no Earth Engine project.")
            print("Open https://code.earthengine.google.com/ in the same browser profile.")
            print("If it asks you to sign up, Earth Engine is not enabled for this account yet.")
            print("If it opens the editor, the project ID is in the top-left selector.")
        return 2

    print("project:", ee.data.getProjectConfig().get("name") if hasattr(ee.data, "getProjectConfig") else args.project)

    print("\n=== 3. scene listing ===")
    aoi = s2.aoi_geometry(config.ACCESS_PROBE["aoi"])
    collection = s2.load(aoi, args.start, args.end)
    try:
        count = int(collection.size().getInfo())
    except Exception as exc:
        print("FAILED", describe(exc))
        return 3
    print(f"scenes: {count}  ({args.start} .. {args.end})")
    if count == 0:
        print("No data. Either the AOI is outside the footpath or the range is empty.")
        return 4

    dates = collection.aggregate_array("system:time_start").getInfo()
    clouds = collection.aggregate_array("CLOUDY_PIXEL_PERCENTAGE").getInfo()
    for ms, cloud in list(zip(dates, clouds))[:10]:
        day = datetime.datetime.utcfromtimestamp(ms / 1000).strftime("%Y-%m-%d")
        print(f"  {day}  cloud={cloud}%")

    print("\n=== 4. quality screening returns numbers ===")
    try:
        comp = s2.composite(aoi, args.start, args.end)
        stats = comp.reduceRegion(
            ee.Reducer.mean(), config.ACCESS_PROBE["aoi"], scale=20, bestEffort=True
        ).getInfo()
    except Exception as exc:
        print("FAILED", describe(exc))
        return 5
    print("mean per band:", {k: round(v, 4) if isinstance(v, float) else v for k, v in stats.items()})
    valid = stats.get("valid_obs")
    print("\nRESULT: PASS" if valid is not None else "\nRESULT: PARTIAL - valid_obs missing")
    return 0


if __name__ == "__main__":
    sys.exit(main())
