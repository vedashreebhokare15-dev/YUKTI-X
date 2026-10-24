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
# Earth Engine rejects a kernel wider than 512 pixels, so a 3 km buffer cannot be
# grown on the 10 m grid (it would need 601 pixels). The cloud mask is resampled
# to this coarser grid first; only the mask moves, never the reflectance bands.
CLOUD_BUFFER_GRID_METERS = 20
# The buffer needs a metric grid, because a kernel radius is given in metres.
CLOUD_BUFFER_CRS = "EPSG:3857"
SHADOW_NIR_FRACTION = 0.25
# The 10 m and 20 m Sentinel-2 grids are not perfectly nested, so a 20 m cell can
# overlap more than the default allowance of 8 source pixels. reduceResolution
# raises instead of aggregating, so the allowance is raised for the NDVI term used
# in NDMI and NBR.
RESAMPLE_MAX_INPUT_PIXELS = 1024
# Composites arrive with an abstract EPSG:4326 projection and no scale, so the
# grids used for index arithmetic are declared here: Earth Engine reads a `scale`
# on a geographic CRS as metres, which is how every area figure in the reports is
# obtained (20 m cells are counted as 400 m^2).
INDEX_GRID_CRS = "EPSG:4326"
INDEX_FINE_SCALE_METERS = 10

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

# Provisional vegetation gate, not a validated legal or ecological forest mask.
HISTORICAL_NDVI_MIN = 0.4
ANALYSIS_SCALE_METERS = 20

# Shallow trees on purpose: a few thousand labelled cells cannot support deep
# forests, and depth is what turns memorised landscape texture into apparent skill.
MODEL_N_ESTIMATORS = 300
MODEL_MAX_DEPTH = 8
MODEL_RANDOM_STATE = 7

PILOT = {
    "name": "Melghat - Satpura dry deciduous forest, Maharashtra",
    "why": "documented logging and mining pressure; strong dry-season leaf-drop makes "
           "NDVI fall without any loss, which is the failure mode this project exists to fix",
    "aoi": [[77.20, 21.20], [77.50, 21.20], [77.50, 21.40], [77.20, 21.40], [77.20, 21.20]],
    "before": ("2024-10-15", "2024-12-15"),
    "after": ("2025-10-15", "2025-12-15"),
    "history_years": 4,
}

# The same landscape at an area one Earth Engine request can finish. Measured
# 2026-10-25: forcing a single composite over the 679 km2 pilot box above ran for
# 14 minutes without returning, so a whole-pilot run cannot produce the class
# histogram its tables need. Nothing about the pipeline changes here - the box is
# smaller, the gates and windows are identical.
PILOT_SLICE = {
    "name": "Melghat - Satpura slice, Maharashtra (28 km2 of the pilot box)",
    "why": "the pilot landscape at an area a single Earth Engine request can force; "
           "same windows, same evidence gates, same rules",
    "aoi": [[77.25, 21.30], [77.30, 21.30], [77.30, 21.35],
            [77.25, 21.35], [77.25, 21.30]],
    "before": PILOT["before"],
    "after": PILOT["after"],
    "history_years": PILOT["history_years"],
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

# Reference labels. The only loss inventory available for India at this resolution
# is a 30 m product, so it can supervise 30 m-scale agreement and nothing finer;
# every metric reported from it carries that caveat. v1_13 covers relative loss
# years 1-25, i.e. calendar 2001 through 2025, which is what makes the operational
# 2024 -> 2025 pair labelable at all (v1_12 stops at 2024).
REFERENCE_ASSET = "UMD/hansen/global_forest_change_2025_v1_13"
REFERENCE_PIXEL_METERS = 30.92
REFERENCE_LOSS_BAND = "lossyear"
REFERENCE_COVER_BAND = "treecover2000"
MIN_TRAINING_TREE_COVER = 30

# A labelled cell has to be bigger than the reference pixel: a 90 m box holds about
# nine 30 m reference pixels, which is enough for a share-based label with an
# ambiguous band instead of a single pixel's yes/no.
TRAINING_CELL_METERS = 90
SAMPLE_STRIDE_METERS = 300

# Model pairs are dated to the reference product. `lossyear` counts calendar years
# and v1_13 reaches 2025. Measured on the ground: inside a 90 m box, one calendar
# year of loss labels 2 of 301 labelable cells in the Northeast slice, which is not
# enough of a class to learn from, so the training target is the reference product's
# recent five years (relative 21-25, calendar 2021-2025) and the image pair spans
# the season before that window and the season it ends in. Anything that went before
# the window opens is unknown, not stable - a cell that was already open cannot teach
# the model what an intact cell looks like.
ML_REGIONS = {
    "maharashtra": {
        "name": PILOT["name"],
        "role": "train",
        "aoi": PILOT["aoi"],
        "before": PILOT["before"],
        "after": PILOT["after"],
        "loss_window": (25, 25),
        "history_years": 3,
    },
    "tripura": {
        "name": HELD_OUT["name"],
        "role": "eval",
        "aoi": [[91.65, 23.58], [91.70, 23.58], [91.70, 23.63],
                [91.65, 23.63], [91.65, 23.58]],
        "before": ("2020-10-15", "2020-12-15"),
        "after": ("2025-10-15", "2025-12-15"),
        "loss_window": (21, 25),
        "history_years": 3,
    },
    # Sampled 2026-10-24 from the reference layer over this exact box: 11 cells carry
    # a loss label and 247 a stable one at 90 m, so the Northeast has a trainable
    # class here. The Maharashtra pilot box does not - 485 of 500 sampled cells sit
    # below the canopy gate there, and none carry a loss label.
    "mizoram": {
        "name": "Mizoram tropical moist forest, Northeast India",
        "role": "train",
        "aoi": [[92.70, 23.65], [92.75, 23.65], [92.75, 23.70],
                [92.70, 23.70], [92.70, 23.65]],
        "before": ("2020-10-15", "2020-12-15"),
        "after": ("2025-10-15", "2025-12-15"),
        "loss_window": (21, 25),
        "history_years": 3,
    },
}

# Band on the sampled evidence image -> name in mlfeatures.FEATURE_NAMES.
FEATURE_BANDS = {
    "ndvi_before": "NDVI_before",
    "ndvi_after": "NDVI",
    "ndmi_before": "NDMI_before",
    "ndmi_after": "NDMI",
    "nbr_before": "NBR_before",
    "nbr_after": "NBR",
    "ndvi_sigma": "NDVI_deviation_sigma",
    "ndmi_sigma": "NDMI_deviation_sigma",
    "nbr_sigma": "NBR_deviation_sigma",
    "valid_before": "valid_obs_before",
    "valid_after": "valid_obs_after",
    "ndvi_baseline": "NDVI_baseline",
}


def reflectance_bands() -> list:
    """Every reflectance band the pipeline reads, in one fixed order."""
    return list(BANDS_10M) + list(BANDS_20M)


def bands_to_load() -> list:
    """Reflectance bands plus the quality band requested from the archive."""
    return reflectance_bands() + ["QA60"]

