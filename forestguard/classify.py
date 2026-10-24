"""Pure decision rules for the four reportable output classes.

No Earth Engine dependency: this module is the part of the design that can be
verified without network access, so the thresholds and their precedence are
reviewable as ordinary Python. `classify` and `explain` are the only place these
rules are expressed - callers that need the reason call `explain`.
"""

from typing import Optional

from . import config

LIKELY_LOSS = "likely_loss"
POSSIBLE_LOSS = "possible_loss"
NO_LOSS = "no_detected_loss"
INSUFFICIENT = "insufficient_evidence"

RULES = (
    "R1 valid observations in either period below min_valid_observations -> insufficient_evidence",
    "R2 no historical forest at the location -> insufficient_evidence (nothing to lose)",
    "R3 seasonal deviation unavailable -> insufficient_evidence",
    "R4 decline >= strong_sigma AND (persistence confirmed OR supporting index agrees) -> likely_loss",
    "R5 decline >= weak_sigma -> possible_loss (an uncorroborated drop, however large, is not likely loss)",
    "R6 adequate evidence and no decline of note, including green-up -> no_detected_loss",
)


def explain(
    valid_before: int,
    valid_after: int,
    historical_forest: bool,
    deviation_sigma: Optional[float],
    supporting_index_agrees: Optional[bool],
    persistence_confirmed: Optional[bool],
    weak_sigma: float = config.WEAK_SIGMA,
    strong_sigma: float = config.STRONG_SIGMA,
    min_valid_observations: int = config.MIN_VALID_OBSERVATIONS,
):
    """Return (class, rule_id, reason) so every pixel can be explained."""
    if valid_before < min_valid_observations or valid_after < min_valid_observations:
        return (INSUFFICIENT, "R1",
                f"only {valid_before} valid observations before and {valid_after} after, "
                f"minimum is {min_valid_observations}")
    if not historical_forest:
        return (INSUFFICIENT, "R2", "no historical forest here, so there is nothing to lose")
    if deviation_sigma is None:
        return (INSUFFICIENT, "R3",
                "no seasonal expectation for this location, so a change has nothing to be measured against")

    decline = -deviation_sigma
    # None means the corroboration could not be computed. It is not evidence of
    # persistence, so it cannot promote a pixel to likely_loss, but the reason
    # says so instead of pretending the answer was "no".
    corroborated = persistence_confirmed is True or supporting_index_agrees is True
    untested = persistence_confirmed is None or supporting_index_agrees is None

    if decline >= strong_sigma and corroborated:
        return (LIKELY_LOSS, "R4",
                f"decline of {decline:.1f} sigma beyond the season's own spread, corroborated")
    if decline >= weak_sigma:
        reason = f"decline of {decline:.1f} sigma"
        if untested:
            reason += " - corroboration could not be computed (cloud or missing history)"
        elif not corroborated:
            reason += " - no corroborating evidence, so it is not promoted to likely loss"
        return (POSSIBLE_LOSS, "R5", reason)
    if decline <= -weak_sigma:
        return (NO_LOSS, "R6", f"green-up of {-decline:.1f} sigma relative to the season")
    return (NO_LOSS, "R6",
            f"decline of {decline:.1f} sigma is within what this location's season normally shows")


def classify(
    valid_before: int,
    valid_after: int,
    historical_forest: bool,
    deviation_sigma: Optional[float],
    supporting_index_agrees: Optional[bool],
    persistence_confirmed: Optional[bool],
    weak_sigma: float = config.WEAK_SIGMA,
    strong_sigma: float = config.STRONG_SIGMA,
    min_valid_observations: int = config.MIN_VALID_OBSERVATIONS,
) -> str:
    """`deviation_sigma` is (current - seasonal mean) / seasonal stddev, so a
    negative value is a decline."""
    return explain(
        valid_before, valid_after, historical_forest, deviation_sigma,
        supporting_index_agrees, persistence_confirmed,
        weak_sigma, strong_sigma, min_valid_observations,
    )[0]

