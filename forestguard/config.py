"""Provisional configuration. AOIs are coordinate boxes, not forest boundaries.

Phase 2 must replace each box with a real administrative or protected-area
boundary before any result is reported as a forest statistic.
"""

BANDS_10M = ("B2", "B3", "B4", "B8")
BANDS_20M = ("B11", "B12")
TRUE_COLOUR = ("B4", "B3", "B2")

# QA60 is native 60 m. It is used as a mask that is resampled onto the band
# grids; reflectance bands are never resampled to match it.
QA60_NATIVE_METERS = 60
QA60_NOTE = (
    "QA60 exists in COPERNICUS/S2_SR_HARMONIZED for every scene, but its cloud "
    "and cirrus flags changed behaviour across processing baselines, so QA60 "
    "alone is treated as a coarse screen and cloud probability is preferred "
    "where a matching scene exists."
)

DATASET = "COPERNICUS/S2_SR_HARMONIZED"
CLOUD_PROBABILITY_DATASET = "COPERNICUS/S2_CLOUD_PROBABILITY"
INDEX_SCALE_FACTOR = 10000

CLOUD_PROBABILITY_CLOUDY = 60
CLOUD_BUFFER_METERS = 3000
SHADOW_NIR_FRACTION = 0.25

# Evidence gates. MIN_VALID_OBSERVATIONS is the per-period scene count a pixel
# needs before any change claim is made about it; MIN_BASELINE_YEARS is the
# number of prior same-season composites a pixel needs before a seasonal
# expectation exists. Both feed classify.RULES, which stays the single
# authoritative rule table.
MIN_VALID_OBSERVATIONS = 3
MIN_BASELINE_YEARS = 3

# Declines are measured in seasonal standard deviations, negative = decline.
WEAK_SIGMA = 2.0
STRONG_SIGMA = 4.0

PILOT = {
    "name": "Melghat - Satpura dry deciduous forest, Maharashtra",
    "why": "documented logging and mining pressure; strong dry-season leaf-drop makes "
           "NDVI fall without any loss, which is the failure mode this project exists to fix",
    "aoi": [[77.20, 21.20], [77.50, 21.20], [77.50, 21.40], [77.20, 21.40], [77.20, 21.20]],
    "before": ("2024-10-15", "2024-12-15"),
    "after": ("2025-10-15", "2025-12-15"),
    "history_years": 4,
}

HELD_OUT = {
    "name": "Tripura plantation and jhum landscape, Northeast India",
    "why": "different forest type, monsoon-dominated cloud regime, no shared training area",
    "aoi": [[91.40, 23.50], [91.70, 23.50], [91.70, 23.80], [91.40, 23.80], [91.40, 23.50]],
}

ACCESS_PROBE = {
    "aoi": HELD_OUT["aoi"],
    "date_range": ("2025-10-01", "2025-11-30"),
}


def reflectance_bands() -> list:
    """Every reflectance band the pipeline reads, in one fixed order."""
    return list(BANDS_10M) + list(BANDS_20M)


def bands_to_load() -> list:
    """Reflectance bands plus the quality band requested from the archive."""
    return reflectance_bands() + ["QA60"]

