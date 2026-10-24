"""Pure decision rules for the four reportable output classes.

No Earth Engine dependency: this module is the part of the design that can be
verified without network access, so the thresholds and their precedence are
reviewable as ordinary Python.
"""

LIKELY_LOSS = "likely_loss"
POSSIBLE_LOSS = "possible_loss"
NO_LOSS = "no_detected_loss"
INSUFFICIENT = "insufficient_evidence"

RULES = (
    "R1 valid observations in either period below MIN_VALID_OBSERVATIONS -> insufficient_evidence",
    "R2 no historical forest at the location -> insufficient_evidence (nothing to lose)",
    "R3 seasonal deviation unavailable -> insufficient_evidence",
    "R4 decline >= strong_sigma AND (persistence confirmed OR supporting index agrees) -> likely_loss",
    "R5 decline >= weak_sigma -> possible_loss (an uncorroborated drop, however large, is not likely loss)",
    "R6 adequate evidence and no decline of note, including green-up -> no_detected_loss",
)


def classify(
    valid_before: int,
    valid_after: int,
    historical_forest: bool,
    deviation_sigma: float | None,
    supporting_index_agrees: bool,
    persistence_confirmed: bool | None,
    weak_sigma: float = 2.0,
    strong_sigma: float = 4.0,
    min_valid_observations: int = 3,
) -> str:
    """`deviation_sigma` is (current - seasonal mean) / seasonal stddev, so a
    negative value is a decline."""
    if valid_before < min_valid_observations or valid_after < min_valid_observations:
        return INSUFFICIENT
    if not historical_forest:
        return INSUFFICIENT
    if deviation_sigma is None:
        return INSUFFICIENT

    decline = -deviation_sigma
    corroborated = bool(persistence_confirmed) or bool(supporting_index_agrees)

    if decline >= strong_sigma and corroborated:
        return LIKELY_LOSS
    if decline >= weak_sigma:
        return POSSIBLE_LOSS
    return NO_LOSS
