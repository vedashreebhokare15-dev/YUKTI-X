import unittest

from forestguard.reflabels import (
    ABSTAIN,
    LOSS,
    NO_LOSS,
    canopy_pixels,
    counts_from_histogram,
    counts_from_points,
    forest_cover_ok,
    histogram_mean,
    label_cell,
)


class TestLabelCell(unittest.TestCase):
    def test_majority_of_reference_loss_pixels_is_a_loss_label(self):
        cell = label_cell(loss_pixels=9, stable_pixels=1)
        self.assertEqual(cell["label"], LOSS)
        self.assertAlmostEqual(cell["loss_share"], 0.9)

    def test_majority_stable_pixels_is_a_no_loss_label(self):
        self.assertEqual(label_cell(loss_pixels=1, stable_pixels=9)["label"], NO_LOSS)

    def test_unknown_reference_pixels_are_never_counted_as_stable(self):
        cell = label_cell(loss_pixels=0, stable_pixels=0, unknown_pixels=50)
        self.assertEqual(cell["label"], ABSTAIN)
        self.assertEqual(cell["usable_pixels"], 0)
        self.assertIn("no reference", cell["reason"])

    def test_cell_with_too_few_reference_pixels_abstains(self):
        cell = label_cell(loss_pixels=2, stable_pixels=1, min_reference_pixels=4)
        self.assertEqual(cell["label"], ABSTAIN)
        self.assertIn("below", cell["reason"])

    def test_half_and_half_cell_is_abstained_instead_of_guessed(self):
        cell = label_cell(loss_pixels=5, stable_pixels=5, ambiguous_margin=0.1)
        self.assertEqual(cell["label"], ABSTAIN)
        self.assertIn("ambiguous", cell["reason"])

    def test_ambiguity_margin_decides_the_borderline_cell(self):
        self.assertEqual(label_cell(loss_pixels=6, stable_pixels=4, ambiguous_margin=0.0)["label"], LOSS)
        self.assertEqual(label_cell(loss_pixels=6, stable_pixels=4, ambiguous_margin=0.2)["label"], ABSTAIN)

    def test_negative_counts_are_a_programming_error_not_a_silent_clamp(self):
        with self.assertRaises(ValueError):
            label_cell(loss_pixels=-1, stable_pixels=3)


class TestCountsFromPoints(unittest.TestCase):
    """One labelled reference point is one 30 m pixel, not one 20 m cell."""

    def test_zero_loss_year_on_forested_ground_is_a_stable_point(self):
        counts = counts_from_points([{"lossyear": 0, "treecover": 78}])
        self.assertEqual(counts, {"loss_pixels": 0, "stable_pixels": 1, "unknown_pixels": 0})

    def test_loss_inside_the_reporting_window_is_a_loss_point(self):
        counts = counts_from_points([{"lossyear": 4, "treecover": 65}], loss_window=(2, 6))
        self.assertEqual(counts["loss_pixels"], 1)
        self.assertEqual(counts["stable_pixels"], 0)

    def test_loss_before_the_window_is_neither_loss_nor_stability(self):
        counts = counts_from_points([{"lossyear": 1, "treecover": 65}], loss_window=(2, 6))
        self.assertEqual(counts, {"loss_pixels": 0, "stable_pixels": 0, "unknown_pixels": 1})

    def test_bare_ground_contributes_no_label_at_all(self):
        counts = counts_from_points(
            [{"lossyear": 0, "treecover": 4}, {"lossyear": 9, "treecover": 12}],
            min_tree_cover=30,
        )
        self.assertEqual(counts, {"loss_pixels": 0, "stable_pixels": 0, "unknown_pixels": 2})

    def test_nodata_and_missing_reference_values_are_unknown(self):
        counts = counts_from_points(
            [{"lossyear": 255, "treecover": 50}, {"lossyear": None, "treecover": 50}, {"treecover": 50}]
        )
        self.assertEqual(counts["unknown_pixels"], 3)
        self.assertEqual(counts["loss_pixels"] + counts["stable_pixels"], 0)

    def test_low_tree_cover_threshold_is_stated_in_the_result(self):
        counts = counts_from_points([{"lossyear": 0, "treecover": 25}], min_tree_cover=20)
        self.assertEqual(counts["stable_pixels"], 1)

    def test_datamask_zero_means_no_observation_not_stable_ground(self):
        counts = counts_from_points([{"lossyear": 0, "treecover": 80, "datamask": 0}])
        self.assertEqual(counts, {"loss_pixels": 0, "stable_pixels": 0, "unknown_pixels": 1})

    def test_masked_loss_year_on_observed_forest_means_no_loss_recorded(self):
        # Measured against UMD/hansen/global_forest_change_2025_v1_13: over a 90 m
        # box of 67 % canopy Reducer.count() returned 0 lossyear pixels while
        # datamask returned 9 land pixels. Absence is the product's way of saying
        # "no canopy loss in 2001-2025", not "unmeasured".
        counts = counts_from_points(
            [{"lossyear": None, "treecover": 67, "datamask": 1}] * 9
        )
        self.assertEqual(counts, {"loss_pixels": 0, "stable_pixels": 9, "unknown_pixels": 0})

    def test_masked_loss_year_without_a_land_observation_stays_unknown(self):
        counts = counts_from_points([{"lossyear": None, "treecover": 67}])
        self.assertEqual(counts, {"loss_pixels": 0, "stable_pixels": 0, "unknown_pixels": 1})

    def test_cell_label_consumes_the_point_counts(self):
        points = (
            [{"lossyear": 5, "treecover": 60}] * 9
            + [{"lossyear": 0, "treecover": 60}]
            + [{"lossyear": 0, "treecover": 5}] * 30
        )
        counts = counts_from_points(points, loss_window=(4, 8))
        cell = label_cell(**counts)
        self.assertEqual(cell["label"], LOSS)
        self.assertEqual(cell["unknown_pixels"], 30)


class TestCountsFromHistogram(unittest.TestCase):
    """A 90 m training cell holds several 30 m reference pixels, counted by value."""

    def test_string_keys_from_earth_engine_are_understood(self):
        counts = counts_from_histogram({"0": 6, "23": 3})
        self.assertEqual(counts, {"loss_pixels": 3, "stable_pixels": 6, "unknown_pixels": 0})

    def test_only_the_reporting_loss_year_counts_as_loss(self):
        counts = counts_from_histogram({"0": 4, "18": 3, "23": 2}, loss_window=(23, 23))
        self.assertEqual(counts["loss_pixels"], 2)
        self.assertEqual(counts["stable_pixels"], 4)
        self.assertEqual(counts["unknown_pixels"], 3)

    def test_no_data_values_are_never_stability(self):
        counts = counts_from_histogram({"0": 2, "255": 5, "999": 1})
        self.assertEqual(counts, {"loss_pixels": 0, "stable_pixels": 2, "unknown_pixels": 6})

    def test_a_negative_loss_year_is_unknown(self):
        self.assertEqual(counts_from_histogram({"-1": 4})["unknown_pixels"], 4)

    def test_an_empty_histogram_abstains_downstream(self):
        counts = counts_from_histogram({})
        self.assertEqual(counts, {"loss_pixels": 0, "stable_pixels": 0, "unknown_pixels": 0})
        self.assertEqual(label_cell(**counts)["label"], ABSTAIN)

    def test_land_pixels_missing_from_the_histogram_are_stability(self):
        counts = counts_from_histogram({}, observed_pixels=9)
        self.assertEqual(counts, {"loss_pixels": 0, "stable_pixels": 9, "unknown_pixels": 0})
        self.assertEqual(label_cell(**counts)["label"], NO_LOSS)

    def test_out_of_window_loss_is_removed_from_the_stable_remainder(self):
        counts = counts_from_histogram(
            {"20": 2, "255": 1}, loss_window=(25, 25), observed_pixels=9
        )
        self.assertEqual(counts, {"loss_pixels": 0, "stable_pixels": 6, "unknown_pixels": 3})

    def test_an_observed_count_below_the_histogram_total_adds_no_stability(self):
        counts = counts_from_histogram({"25": 5}, observed_pixels=2)
        self.assertEqual(counts["stable_pixels"], 0)
        self.assertEqual(counts["loss_pixels"], 5)


class TestForestCoverGate(unittest.TestCase):
    def test_canopy_above_the_threshold_is_forested_enough_to_be_gated(self):
        self.assertTrue(forest_cover_ok(41, min_tree_cover=30))

    def test_thin_canopy_is_not_forest_and_yields_no_label(self):
        self.assertFalse(forest_cover_ok(12, min_tree_cover=30))

    def test_unmeasured_canopy_is_not_a_pass(self):
        self.assertFalse(forest_cover_ok(None, min_tree_cover=30))

    def test_only_forested_reference_pixels_count_toward_stability(self):
        # The denominator for "no loss recorded" is canopy pixels, not every pixel
        # in the box: bare ground with no loss year is not stable forest.
        self.assertEqual(canopy_pixels({"0": 3, "12": 2, "47": 1.5, "70": 2.5}, 30), 4.0)

    def test_a_histogram_with_no_forest_counts_zero_pixels(self):
        self.assertEqual(canopy_pixels({"0": 4, "29": 5}, 30), 0)


class TestHistogramMean(unittest.TestCase):
    def test_a_histogram_carries_the_weighted_mean(self):
        self.assertAlmostEqual(histogram_mean({"0": 3, "30": 1}), 7.5)

    def test_an_empty_histogram_is_not_a_zero_average(self):
        self.assertIsNone(histogram_mean({}))
        self.assertIsNone(histogram_mean(None))

    def test_string_keys_are_read_as_numbers(self):
        self.assertAlmostEqual(histogram_mean({"10": 2, "20": 2}), 15.0)


if __name__ == "__main__":
    unittest.main()
