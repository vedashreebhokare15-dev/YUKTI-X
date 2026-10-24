"""Reference-sample metrics, computed from labelled pairs in plain Python.

Kept free of Earth Engine and numpy so the scoring rules can be executed and
unit-tested anywhere, including before any detection run exists.

Abstention is a first-class outcome: pixels reported as insufficient evidence are
excluded from precision and recall and counted separately, instead of being forced
into a class to make the sample table look complete.
"""

from dataclasses import dataclass

from .classify import INSUFFICIENT, LIKELY_LOSS, NO_LOSS, POSSIBLE_LOSS

LOSS_CLASSES = (LIKELY_LOSS, POSSIBLE_LOSS)
DETECTION_CLASSES = LOSS_CLASSES + (NO_LOSS,)


@dataclass(frozen=True)
class Metrics:
    total: int
    true_positive: int
    false_positive: int
    false_negative: int
    true_negative: int
    abstained: int
    invalid: int

    @property
    def scored(self) -> int:
        return self.true_positive + self.false_positive + self.false_negative + self.true_negative

    @property
    def precision(self) -> float | None:
        denominator = self.true_positive + self.false_positive
        return self.true_positive / denominator if denominator else None

    @property
    def recall(self) -> float | None:
        denominator = self.true_positive + self.false_negative
        return self.true_positive / denominator if denominator else None

    @property
    def f1(self) -> float | None:
        precision, recall = self.precision, self.recall
        if precision is None or recall is None or precision + recall == 0:
            return None
        return 2 * precision * recall / (precision + recall)

    @property
    def false_positive_rate(self) -> float | None:
        denominator = self.false_positive + self.true_negative
        return self.false_positive / denominator if denominator else None

    @property
    def abstention_rate(self) -> float | None:
        return self.abstained / self.total if self.total else None

    @property
    def valid_area_coverage(self) -> float | None:
        """Share of reported locations that carry a usable answer."""
        return self.scored / self.total if self.total else None


def evaluate(pairs) -> Metrics:
    """`pairs` is an iterable of (predicted_class, reference_is_loss) tuples."""
    tp = fp = fn = tn = abstained = invalid = 0
    for predicted, reference_is_loss in pairs:
        if predicted == INSUFFICIENT:
            abstained += 1
            continue
        if predicted not in DETECTION_CLASSES:
            invalid += 1
            continue
        if predicted in LOSS_CLASSES and reference_is_loss:
            tp += 1
        elif predicted in LOSS_CLASSES:
            fp += 1
        elif reference_is_loss:
            fn += 1
        else:
            tn += 1
    return Metrics(
        total=tp + fp + fn + tn + abstained + invalid,
        true_positive=tp, false_positive=fp, false_negative=fn, true_negative=tn,
        abstained=abstained, invalid=invalid,
    )


def detection_delay_days(observations) -> float | None:
    """Median lag between the reference loss date and the first detection.

    `observations` is an iterable of (first_detected_date, reference_loss_date)
    datetime.date pairs. Dates before the reference date imply the detector fired
    early, which is reported rather than clamped to zero.
    """
    lags = sorted((detected - reference).days for detected, reference in observations)
    if not lags:
        return None
    middle = len(lags) // 2
    if len(lags) % 2:
        return float(lags[middle])
    return (lags[middle - 1] + lags[middle]) / 2
