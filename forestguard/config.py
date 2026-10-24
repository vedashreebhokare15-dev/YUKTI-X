"""Provisional configuration. AOIs are coordinate boxes, not forest boundaries.

Phase 2 must replace each box with a real administrative or protected-area
boundary before any result is reported as a forest statistic.
"""

BANDS_10M = ("B2", "B3", "B4", "B8")
BANDS_20M = ("B11", "B12")
TRUE_COLOUR = ("B4", "B3", "B2")

DATASET = "COPERNICUS/S2_SR_HARMONIZED"
CLOUD_PROBABILITY_DATASET = "COPERNICUS/S2_CLOUD_PROBABILITY"
INDEX_SCALE_FACTOR = 10000

CLOUD_PROBABILITY_CLOUDY = 60
CLOUD_BUFFER_METERS = 3000
SHADOW_NIR_FRACTION = 0.25

MIN_VALID_OBSERVATIONS = 3

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
