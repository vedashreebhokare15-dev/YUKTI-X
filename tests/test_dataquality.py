"""Honesty rules for data-quality reporting, checked before any real run."""

import unittest

from forestguard import dataquality


class TestAssessWindow(unittest.TestCase):
    def test_empty_window_is_not_reportable(self):
        quality = dataquality.assess_window("2024-10-15", "2024-12-15", 0, 0)
        self.assertEqual(quality.status, "empty")
        self.assertFalse(quality.reportable)

    def test_scenes_without_usable_probability_are_called_out(self):
        quality = dataquality.assess_window("2024-10-15", "2024-12-15", 7, 0)
        self.assertEqual(quality.status, "no_screenable_scenes")
        self.assertFalse(quality.reportable)
        self.assertTrue(any("join" in note for note in quality.notes))

    def test_thin_window_stays_usable_but_warns(self):
        quality = dataquality.assess_window("2024-10-15", "2024-12-15", 1, 1)
        self.assertEqual(quality.status, "thin")
        self.assertTrue(quality.reportable)
        self.assertTrue(any("only 1 usable scene" in note for note in quality.notes))

    def test_timestamp_count_mismatch_is_recorded(self):
        quality = dataquality.assess_window("2024-10-15", "2024-12-15", 5, 5,
                                            ["2024-10-20", "2024-11-05"])
        self.assertTrue(any("timestamps" in note for note in quality.notes))

    def test_healthy_window_carries_no_warning(self):
        quality = dataquality.assess_window("2024-10-15", "2024-12-15", 6, 6,
                                            ["2024-10-20"] * 6)
        self.assertEqual(quality.status, "ok")
        self.assertEqual(quality.notes, [])


class TestCoverageFromHistogram(unittest.TestCase):
    COUNTS = {0: 100, 1: 50, 3: 800, 5: 50}
    CELL = 400.0

    def test_unobserved_pixels_stay_separate_from_insufficient(self):
        report = dataquality.coverage_from_histogram(self.COUNTS, 3, self.CELL)
        self.assertEqual(report["total_pixels"], 1000)
        self.assertEqual(report["unobserved_pixels"], 100)
        self.assertEqual(report["sufficient_pixels"], 850)
        self.assertEqual(report["insufficient_pixels"], 50)

    def test_share_and_areas_use_only_valid_pixels(self):
        report = dataquality.coverage_from_histogram(self.COUNTS, 3, self.CELL)
        self.assertAlmostEqual(report["sufficient_share"], 0.85)
        self.assertAlmostEqual(report["sufficient_hectares"], 34.0)
        self.assertAlmostEqual(report["unobserved_hectares"], 4.0)

    def test_nothing_below_the_required_count_is_counted_as_sufficient(self):
        report = dataquality.coverage_from_histogram(self.COUNTS, 6, self.CELL)
        self.assertEqual(report["sufficient_pixels"], 0)
        self.assertEqual(report["insufficient_pixels"], 900)

    def test_empty_histogram_gives_no_share_rather_than_zero(self):
        report = dataquality.coverage_from_histogram({}, 3, self.CELL)
        self.assertIsNone(report["sufficient_share"])
        self.assertEqual(report["total_pixels"], 0)


class TestCloudSummary(unittest.TestCase):
    def test_no_scenes_gives_no_percentage(self):
        summary = dataquality.cloud_percentage_summary([])
        self.assertEqual(summary["scenes"], 0)
        self.assertIsNone(summary["mean"])

    def test_missing_values_are_dropped_not_zero_filled(self):
        summary = dataquality.cloud_percentage_summary([10.0, None, 30.0])
        self.assertEqual(summary["scenes"], 2)
        self.assertAlmostEqual(summary["mean"], 20.0)
        self.assertEqual(summary["minimum"], 10.0)
        self.assertEqual(summary["maximum"], 30.0)


class TestMergeWindowQuality(unittest.TestCase):
    def test_one_empty_window_makes_the_run_unreportable(self):
        qualities = [
            dataquality.assess_window("2024-10-15", "2024-12-15", 6, 6),
            dataquality.assess_window("2023-10-15", "2023-12-15", 0, 0),
        ]
        summary = dataquality.merge_window_quality(qualities)
        self.assertFalse(summary["reportable"])
        self.assertEqual(summary["empty_windows"], 1)

    def test_notes_roll_up_across_windows(self):
        qualities = [
            dataquality.assess_window("2024-10-15", "2024-12-15", 1, 1,
                                      min_valid_observations=3),
            dataquality.assess_window("2023-10-15", "2023-12-15", 2, 2,
                                      min_valid_observations=3),
        ]
        summary = dataquality.merge_window_quality(qualities)
        self.assertEqual(summary["thin_windows"], 2)
        self.assertEqual(len(summary["notes"]), 2)
        self.assertTrue(summary["reportable"])


class TestAreaArithmetic(unittest.TestCase):
    def test_one_hectare_is_ten_thousand_square_metres(self):
        self.assertAlmostEqual(dataquality.area_hectares(25, 400.0), 1.0)


if __name__ == "__main__":
    unittest.main()
