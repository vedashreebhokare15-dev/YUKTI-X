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


BASELINE_INDICES = ("NDVI", "NDMI", "NBR")


def seasonal_baselines(aoi_box, window: tuple, history_years: int,
                       indices=BASELINE_INDICES,
                       use_cloud_probability: bool = False) -> dict:
    """Mean and spread of the same calendar window over prior years, all indices.

    One composite is built per history season and every index is read out of it.
    Asking for NDVI, NDMI and NBR separately would build three composites of the
    same scenes, and a full-region run cannot survive that: the Earth Engine
    timeout is per request, so a request that repeats the slowest part of itself
    three times is a run that never returns.
    """
    periods = windows.history_windows(window[0], window[1], history_years)
    seasons = [period_evidence(aoi_box, start, end, use_cloud_probability)
               for _year, start, end in periods]
    baselines = {}
    for index in indices:
        stack = ee.ImageCollection([
            season.select(index)
            .set("observation_year", year)
            .set("observation_window", [start, end])
            for season, (year, start, end) in zip(seasons, periods)
        ])
        stats = stack.reduce(
            ee.Reducer.mean().combine(ee.Reducer.stdDev(), sharedInputs=True)
        )
        contributing_years = stack.count()
        usable = contributing_years.gte(config.MIN_BASELINE_YEARS)
        baselines[index] = (stats.updateMask(usable)
                            .rename([f"{index}_baseline", f"{index}_stddev"])
                            .addBands(contributing_years.rename(
                                [f"{index}_baseline_years"])))
    return baselines


def seasonal_baseline(aoi_box, window: tuple, history_years: int,
                      index: str = "NDVI", use_cloud_probability: bool = False):
    """The single-index view of `seasonal_baselines`, as (stats, contributing years).

    The count of contributing seasons travels inside the stats image as the
    `<index>_baseline_years` band, which is what `seasonal_baselines` masks the
    statistics with, so this cannot promise a count the shared build did not make.
    """
    stats = seasonal_baselines(
        aoi_box, window, history_years, (index,), use_cloud_probability
    )[index]
    return stats, stats.select(f"{index}_baseline_years")


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
