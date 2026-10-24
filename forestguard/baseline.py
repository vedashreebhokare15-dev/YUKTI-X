"""Evidence assembly for two-period and seasonal-baseline comparison.

This module produces numeric evidence - deviations in standard deviations and
valid-observation counts. Class assignment lives in `classify.py`, which is the
single authoritative rule table, so the rules are never expressed twice.
"""

import ee

from . import config, indices, s2


def period_evidence(aoi_box, start: str, end: str,
                    use_cloud_probability: bool = False) -> ee.Image:
    aoi = s2.aoi_geometry(aoi_box)
    comp = s2.composite(aoi, start, end, use_cloud_probability)
    observed = s2.require_observed(comp)
    return indices.all_indices(observed).addBands(comp.select("valid_obs"))


def seasonal_baseline(aoi_box, window: tuple, history_years: int,
                      index: str = "NDVI", use_cloud_probability: bool = False):
    """Mean and spread of the same calendar window over prior years.

    Returns the baseline image plus the number of years that contributed; a
    baseline built from one or two seasons is not a seasonal pattern.
    """
    start_month_day = (int(window[0][5:7]), int(window[0][8:10]))
    end_month_day = (int(window[1][5:7]), int(window[1][8:10]))
    first_year = int(window[0][:4])

    years = []
    for offset in range(1, history_years + 1):
        year = first_year - offset
        start = f"{year:04d}-{start_month_day[0]:02d}-{start_month_day[1]:02d}"
        end = f"{year:04d}-{end_month_day[0]:02d}-{end_month_day[1]:02d}"
        years.append(
            period_evidence(aoi_box, start, end, use_cloud_probability).select(index)
            .set("observation_year", year)
        )
    stack = ee.ImageCollection(years)
    stats = stack.reduce(ee.Reducer.mean().combine(ee.Reducer.stdDev(), sharedInputs=True))
    contributed = stack.count()
    return stats.rename([f"{index}_baseline", f"{index}_stddev"]), contributed


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
        "weak_sigma": 2.0,
        "strong_sigma": 4.0,
        "min_valid_observations": config.MIN_VALID_OBSERVATIONS,
    }
