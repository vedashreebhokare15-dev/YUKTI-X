"""Evidence assembly for two-period and seasonal-baseline comparison.

This module produces numeric evidence - deviations in standard deviations and
valid-observation counts. Class assignment lives in `classify.py`, which is the
single authoritative rule table, so the rules are never expressed twice.

The Earth Engine baseline and the pure-Python reference in `seasonal.py` must
agree on what counts as a usable seasonal pattern: both require
`config.MIN_BASELINE_YEARS` contributing seasons and a non-zero spread. A pixel
whose history is thinner than that gets a masked deviation, which reaches the
rules as "insufficient evidence" rather than as a confident number.
"""

import ee

from . import config, indices, s2, windows


def period_evidence(aoi_box, start: str, end: str,
                    use_cloud_probability: bool = False) -> ee.Image:
    aoi = s2.aoi_geometry(aoi_box)
    comp = s2.composite(aoi, start, end, use_cloud_probability)
    observed = s2.require_observed(comp)
    return indices.all_indices(observed).addBands(comp.select("valid_obs"))


def seasonal_baseline(aoi_box, window: tuple, history_years: int,
                      index: str = "NDVI", use_cloud_probability: bool = False):
    """Mean and spread of the same calendar window over prior years.

    Returns the baseline image plus the per-pixel count of seasons that
    contributed. A baseline built from one or two seasons is not a seasonal
    pattern, so those pixels come back masked rather than as a flat guess.
    """
    periods = windows.history_windows(window[0], window[1], history_years)
    images = []
    for year, start, end in periods:
        images.append(
            period_evidence(aoi_box, start, end, use_cloud_probability)
            .select(index)
            .set("observation_year", year)
            .set("observation_window", [start, end])
        )
    stack = ee.ImageCollection(images)
    stats = stack.reduce(
        ee.Reducer.mean().combine(ee.Reducer.stdDev(), sharedInputs=True)
    )
    contributing_years = stack.count()

    usable = contributing_years.gte(config.MIN_BASELINE_YEARS)
    stats = (stats.updateMask(usable)
             .rename([f"{index}_baseline", f"{index}_stddev"])
             .addBands(contributing_years.rename([f"{index}_baseline_years"])))
    return stats, contributing_years


def deviation_sigma(current: ee.Image, baseline: ee.Image, index: str = "NDVI") -> ee.Image:
    """Standardised departure from the seasonal expectation, signed downward."""
    value = current.select(index)
    mean = baseline.select(f"{index}_baseline")
    spread = baseline.select(f"{index}_stddev")
    usable = spread.gt(0).And(value.mask()).And(mean.mask())
    return value.subtract(mean).divide(spread).updateMask(usable).rename(
        [f"{index}_deviation_sigma"]
    )


def config_thresholds() -> dict:
    return {
        "weak_sigma": config.WEAK_SIGMA,
        "strong_sigma": config.STRONG_SIGMA,
        "min_valid_observations": config.MIN_VALID_OBSERVATIONS,
        "min_baseline_years": config.MIN_BASELINE_YEARS,
    }
