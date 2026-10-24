"""Metrics tests. Pure Python, no Earth Engine calls."""

import datetime
import unittest

from forestguard.classify import INSUFFICIENT, LIKELY_LOSS, NO_LOSS, POSSIBLE_LOSS
from forestguard.metrics import detection_delay_days, evaluate

DATE = datetime.date


def sample(count, predicted, reference_is_loss):
    return [(predicted, reference_is_loss)] * count


class TestEvaluate(unittest.TestCase):
    def test_perfect_detector(self):
        result = evaluate(
            sample(3, LIKELY_LOSS, True) + sample(2, NO_LOSS, False)
        )
        self.assertEqual((result.precision, result.recall, result.f1), (1.0, 1.0, 1.0))
        self.assertEqual(result.false_positive_rate, 0.0)
        self.assertEqual(result.valid_area_coverage, 1.0)

    def test_abstentions_are_excluded_from_rates_but_counted(self):
        result = evaluate(
            sample(1, LIKELY_LOSS, True) + sample(1, INSUFFICIENT, True)
        )
        self.assertEqual(result.precision, 1.0)
        self.assertEqual(result.abstention_rate, 0.5)
        self.assertEqual(result.valid_area_coverage, 0.5)

    def test_false_positive_rate_uses_negatives_only(self):
        result = evaluate(
            sample(1, POSSIBLE_LOSS, False) + sample(3, NO_LOSS, False)
        )
        self.assertEqual(result.false_positive_rate, 0.25)
        self.assertEqual(result.precision, 0.0)

    def test_no_predicted_loss_gives_undefined_precision(self):
        result = evaluate(sample(4, NO_LOSS, True))
        self.assertIsNone(result.precision)
        self.assertEqual(result.recall, 0.0)
        self.assertIsNone(result.f1)

    def test_no_reference_loss_gives_undefined_recall(self):
        result = evaluate(sample(2, NO_LOSS, False) + sample(1, LIKELY_LOSS, False))
        self.assertIsNone(result.recall)
        self.assertAlmostEqual(result.false_positive_rate, 1 / 3)

    def test_unknown_class_is_flagged_not_silently_scored(self):
        result = evaluate([("greenhouse_gas", True), (LIKELY_LOSS, True)])
        self.assertEqual(result.invalid, 1)
        self.assertEqual(result.scored, 1)

    def test_empty_input_does_not_divide_by_zero(self):
        result = evaluate([])
        self.assertEqual(result.total, 0)
        self.assertIsNone(result.precision)
        self.assertIsNone(result.valid_area_coverage)

    def test_counts_add_up(self):
        result = evaluate(
            sample(1, LIKELY_LOSS, True) + sample(1, POSSIBLE_LOSS, False)
            + sample(1, NO_LOSS, True) + sample(1, NO_LOSS, False)
            + sample(1, INSUFFICIENT, True)
        )
        self.assertEqual(
            (result.true_positive, result.false_positive, result.false_negative,
             result.true_negative, result.abstained), (1, 1, 1, 1, 1)
        )
        self.assertEqual(result.total, 5)


class TestDetectionDelay(unittest.TestCase):
    def test_odd_count_returns_median_lag(self):
        lags = [(DATE(2025, 1, 20), DATE(2025, 1, 10)),
                (DATE(2025, 1, 15), DATE(2025, 1, 10)),
                (DATE(2025, 2, 10), DATE(2025, 1, 10))]
        self.assertEqual(detection_delay_days(lags), 10.0)

    def test_even_count_averages_the_middle_pair(self):
        lags = [(DATE(2025, 1, 12), DATE(2025, 1, 10)),
                (DATE(2025, 1, 18), DATE(2025, 1, 10))]
        self.assertEqual(detection_delay_days(lags), 5.0)

    def test_early_detection_is_reported_as_negative(self):
        lags = [(DATE(2025, 1, 5), DATE(2025, 1, 10))]
        self.assertEqual(detection_delay_days(lags), -5.0)

    def test_no_observations(self):
        self.assertIsNone(detection_delay_days([]))


if __name__ == "__main__":
    unittest.main()
