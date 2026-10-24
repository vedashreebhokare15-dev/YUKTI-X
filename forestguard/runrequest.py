import math

from . import config, windows

MAX_WINDOW_DAYS = 120
MAX_HISTORY_YEARS = 6
REGIONS = {
    "pilot": config.PILOT,
    "pilot_slice": config.PILOT_SLICE,
    "held_out": config.HELD_OUT,
}

# The earth is not a cylinder: a degree of longitude shrinks with latitude, so the
# area of a coordinate box has to be measured where the box sits.
METRES_PER_DEGREE_LAT = 110_574.0
METRES_PER_DEGREE_EQUATOR = 111_320.0
# A run is one Earth Engine request that ends in a histogram over the whole region.
# Measured 2026-10-25: one composite over the 679 km2 pilot box did not return in 14
# minutes, so boxes this large are offered as geography, not as something the app can
# claim to have run.
MAX_FORCIBLE_AREA_KM2 = 60.0


def box_area_km2(box) -> float:
    """Approximate area of a coordinate box, in km2, at its own latitude."""
    lons = [point[0] for point in box]
    lats = [point[1] for point in box]
    middle_lat = (min(lats) + max(lats)) / 2
    km_wide = ((max(lons) - min(lons)) * METRES_PER_DEGREE_EQUATOR
               * math.cos(math.radians(middle_lat)) / 1000)
    km_tall = (max(lats) - min(lats)) * METRES_PER_DEGREE_LAT / 1000
    return km_wide * km_tall


def point_inside(box, lon, lat):
    xs, ys = [point[0] for point in box], [point[1] for point in box]
    return min(xs) <= lon <= max(xs) and min(ys) <= lat <= max(ys)


def regions_metadata() -> list:
    """The study regions the backend can actually run, as the frontend sees them."""
    rows = []
    for key, region in REGIONS.items():
        longitudes = [point[0] for point in region["aoi"]]
        latitudes = [point[1] for point in region["aoi"]]
        area_km2 = box_area_km2(region["aoi"])
        defaults = {
            name: list(region[name])
            for name in ("before", "after")
            if name in region
        }
        if "history_years" in region:
            defaults["history_years"] = region["history_years"]
        rows.append({
            "key": key,
            "name": region["name"],
            "why": region["why"],
            "bounds": [[min(latitudes), min(longitudes)], [max(latitudes), max(longitudes)]],
            "aoi": [list(point) for point in region["aoi"]],
            "area_km2": round(area_km2, 1),
            "forcible": area_km2 <= MAX_FORCIBLE_AREA_KM2,
            "defaults": defaults,
        })
    return rows


def normalize_request(payload) -> dict:
    if payload is None:
        payload = {}
    if not isinstance(payload, dict):
        raise ValueError("request body must be a JSON object")

    region = payload.get("region", "pilot")
    if region not in REGIONS:
        raise ValueError(f"region must be one of: {', '.join(REGIONS)}")

    # A region that carries its own windows runs those; the pilot's pair is only the
    # fallback for a region that never declared one.
    selected = dict(config.PILOT)
    selected.update(REGIONS[region])

    before = (
        payload.get("before_start", selected["before"][0]),
        payload.get("before_end", selected["before"][1]),
    )
    after = (
        payload.get("after_start", selected["after"][0]),
        payload.get("after_end", selected["after"][1]),
    )
    for label, window in (("before", before), ("after", after)):
        start, end = windows.validate_window(*window)
        if (end - start).days > MAX_WINDOW_DAYS:
            raise ValueError(f"{label} window must not exceed {MAX_WINDOW_DAYS} days")

    history_years = payload.get("history_years", selected["history_years"])
    if (isinstance(history_years, bool) or not isinstance(history_years, int)
            or not config.MIN_BASELINE_YEARS <= history_years <= MAX_HISTORY_YEARS):
        raise ValueError(
            f"history_years must be an integer from {config.MIN_BASELINE_YEARS} "
            f"to {MAX_HISTORY_YEARS}"
        )

    use_cloud_probability = payload.get("use_cloud_probability", True)
    if not isinstance(use_cloud_probability, bool):
        raise ValueError("use_cloud_probability must be boolean")

    return {
        "region": region,
        "before": before,
        "after": after,
        "history_years": history_years,
        "use_cloud_probability": use_cloud_probability,
    }
