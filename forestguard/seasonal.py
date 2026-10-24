"""Seasonal expectation computed from plain numbers.

Deliberately independent of Earth Engine: this is the reference implementation
used to check the raster arithmetic at sampled points. Any divergence between the
two is a finding to investigate, not a rounding detail to forgive.
"""

from dataclasses import dataclass
from statistics import fmean, stdev


@dataclass(frozen=True)
class SeasonalEvidence:
    years: int
    mean: float | None
    stddev: float | None
    reliable: bool
    reason: str


def expected_seasonal(observations, min_years: int = 3) -> SeasonalEvidence:
    """Summarise same-season values from prior years.

    A one- or two-year history is not a seasonal pattern, and a spread of zero
    makes a standardised deviation undefined; both return unreliable evidence
    rather than a confident-looking number.
    """
    values = [float(v) for v in observations if v is not None]
    years = len(values)

    if years == 0:
        return SeasonalEvidence(0, None, None, False, "no observations")
    if years < min_years:
        return SeasonalEvidence(years, fmean(values), stdev(values) if years > 1 else None,
                                False, f"only {years} season(s), below minimum {min_years}")

    spread = stdev(values)
    if spread == 0:
        return SeasonalEvidence(years, fmean(values), 0.0, False,
                                "zero historical spread, deviation would be undefined")

    return SeasonalEvidence(years, fmean(values), spread, True, "")


def standardised_deviation(current: float, baseline: SeasonalEvidence) -> float | None:
    """Positive means greener than the season expects, negative means a decline."""
    if not baseline.reliable or baseline.mean is None or baseline.stddev in (None, 0):
        return None
    if current is None:
        return None
    return (current - baseline.mean) / baseline.stddev
