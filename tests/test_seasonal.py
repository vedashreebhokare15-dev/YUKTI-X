"""Seasonal and persistence logic tests.

The fixture numbers are invented illustration values, not measurements: these
tests verify the decision logic, and say nothing about any pixel on the ground.
"""

import unittest

from forestguard.classify import LIKELY_LOSS, NO_LOSS, POSSIBLE_LOSS, classify
from forestguard.persistence import persistent_decline, supporting_index_agrees
from forestguard.seasonal import expected_seasonal, standardised_deviation


class TestExpectedSeasonal(unittest.TestCase):
    def test_empty_history(self):
        evidence = expected_seasonal([])
        self.assertFalse(evidence.reliable)
        self.assertIsNone(evidence.mean)
        self.assertEqual(evidence.reason, "no observations")

    def test_two_seasons_is_not_a_pattern(self):
        evidence = expected_seasonal([0.51, 0.48])
        self.assertFalse(evidence.reliable)
        self.assertIn("below minimum", evidence.reason)
        self.assertAlmostEqual(evidence.mean, 0.495)

    def test_three_seasons_is_usable(self):
        evidence = expected_seasonal([0.51, 0.48, 0.52])
        self.assertTrue(evidence.reliable)
        self.assertEqual(evidence.years, 3)
        self.assertGreater(evidence.stddev, 0)

    def test_identical_history_has_no_spread_and_is_unusable(self):
        evidence = expected_seasonal([0.5, 0.5, 0.5])
        self.assertEqual(evidence.stddev, 0.0)
        self.assertFalse(evidence.reliable)

    def test_missing_years_are_dropped_not_zero_filled(self):
        evidence = expected_seasonal([0.51, None, 0.48, 0.52])
        self.assertEqual(evidence.years, 3)
        self.assertTrue(evidence.reliable)


class TestStandardisedDeviation(unittest.TestCase):
    def test_sign_convention(self):
        baseline = expected_seasonal([0.50, 0.52, 0.48])
        self.assertGreater(standardised_deviation(0.60, baseline), 0)
        self.assertLess(standardised_deviation(0.40, baseline), 0)

    def test_unreliable_baseline_gives_no_number(self):
        self.assertIsNone(standardised_deviation(0.4, expected_seasonal([0.5, 0.5])))
        self.assertIsNone(standardised_deviation(0.4, expected_seasonal([0.5])))

    def test_absent_current_value_gives_no_number(self):
        baseline = expected_seasonal([0.50, 0.52, 0.48])
        self.assertIsNone(standardised_deviation(None, baseline))


class TestPersistentDecline(unittest.TestCase):
    def setUp(self):
        self.baseline = expected_seasonal([0.52, 0.48, 0.50])

    def test_all_later_observations_declined(self):
        self.assertTrue(persistent_decline([0.38, 0.36, 0.39], self.baseline))

    def test_recovery_is_not_persistent(self):
        self.assertFalse(persistent_decline([0.38, 0.51, 0.50], self.baseline))

    def test_partial_recovery_with_relaxed_fraction(self):
        self.assertTrue(
            persistent_decline([0.38, 0.51, 0.50], self.baseline, required_fraction=1 / 3)
        )

    def test_one_cloudy_after_image_is_not_an_answer(self):
        self.assertIsNone(persistent_decline([0.38], self.baseline))
        self.assertIsNone(persistent_decline([None, None], self.baseline))

    def test_unreliable_baseline_is_not_an_answer(self):
        self.assertIsNone(persistent_decline([0.3, 0.3], expected_seasonal([0.5, 0.5, 0.5])))


class TestSupportingIndex(unittest.TestCase):
    def test_no_values_is_unknown_not_disagreement(self):
        self.assertIsNone(supporting_index_agrees([None, None]))

    def test_all_declining_agrees(self):
        self.assertTrue(supporting_index_agrees([-3.1, -2.4]))

    def test_mixed_does_not_agree(self):
        self.assertFalse(supporting_index_agrees([-3.1, 0.2]))


class TestSeasonVsClearing(unittest.TestCase):
    """The project's central claim, expressed as decision logic."""

    def setUp(self):
        self.baseline = expected_seasonal([0.52, 0.48, 0.50, 0.51])

    def test_normal_leaf_drop_is_not_loss(self):
        deviation = standardised_deviation(0.47, self.baseline)
        self.assertEqual(
            classify(6, 6, True, deviation, False, None), NO_LOSS
        )

    def test_clearing_with_persistence_is_likely_loss(self):
        deviation = standardised_deviation(0.24, self.baseline)
        self.assertEqual(
            classify(6, 6, True, deviation, True, True), LIKELY_LOSS
        )

    def test_clearing_without_any_later_clear_scene_is_only_possible(self):
        deviation = standardised_deviation(0.24, self.baseline)
        self.assertEqual(persistent_decline([], self.baseline), None)
        self.assertEqual(
            classify(6, 6, True, deviation, False, None), POSSIBLE_LOSS
        )


if __name__ == "__main__":
    unittest.main()
