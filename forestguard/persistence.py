"""Whether a candidate decline still holds in observations after the event.

A single dark pixel after a date is not a loss; a scar that refills within two
months was cloud, haze or a sensor artefact. This module answers the persistence
question, and returns None - not False - when the later observations are too
sparse to answer it, which is the common case in monsoon cloud.
"""

from . import seasonal
from .seasonal import SeasonalEvidence


def persistent_decline(
    subsequent_values,
    baseline: SeasonalEvidence,
    threshold_sigma: float = 2.0,
    required_fraction: float = 1.0,
    min_observations: int = 2,
) -> bool | None:
    if not baseline.reliable:
        return None

    deviations = [
        seasonal.standardised_deviation(value, baseline)
        for value in subsequent_values
        if value is not None
    ]
    deviations = [d for d in deviations if d is not None]

    if len(deviations) < min_observations:
        return None

    declining = sum(1 for d in deviations if d <= -threshold_sigma)
    return declining / len(deviations) >= required_fraction


def supporting_index_agrees(
    index_deviations,
    threshold_sigma: float = 2.0,
    min_observations: int = 1,
) -> bool | None:
    """Do the moisture or burn indices decline as strongly as greenness?

    Used to corroborate an NDVI drop. Returns None when the supporting index
    simply has no usable value, which must not be read as disagreement.
    """
    values = [d for d in index_deviations if d is not None]
    if len(values) < min_observations:
        return None
    return all(d <= -threshold_sigma for d in values)
