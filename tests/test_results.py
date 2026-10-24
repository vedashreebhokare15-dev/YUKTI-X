import unittest

from forestguard import config
from forestguard.results import class_areas, explain_sample, normalize_histogram


class TestHistograms(unittest.TestCase):
    def test_earth_engine_string_keys_become_integer_counts(self):
        self.assertEqual(normalize_histogram({"0": 2, "3": 5}), {0: 2, 3: 5})

    def test_missing_histogram_stays_empty(self):
        self.assertEqual(normalize_histogram(None), {})

    def test_class_areas_include_zeroes_and_insufficient_evidence(self):
        result = class_areas({"1": 10, "2": 5, "3": 2, "4": 3}, 400)
        self.assertEqual(result["counts"]["likely_loss"], 2)
        self.assertEqual(result["counts"]["insufficient_evidence"], 3)
        self.assertAlmostEqual(result["hectares"]["no_detected_loss"], 0.4)
        self.assertAlmostEqual(result["hectares"]["possible_loss"], 0.2)

    def test_default_area_uses_the_analysis_grid(self):
        result = class_areas({"1": 25})
        self.assertAlmostEqual(result["hectares"]["no_detected_loss"], 1.0)


class TestExplainSample(unittest.TestCase):
    def test_missing_counts_are_insufficient_not_no_loss(self):
        result = explain_sample({"NDVI_baseline": 0.6})
        self.assertEqual(result["label"], "insufficient_evidence")
        self.assertEqual(result["rule"], "R1")

    def test_missing_baseline_is_not_called_nonforest(self):
        result = explain_sample({"valid_obs_before": 4, "valid_obs_after": 4})
        self.assertEqual(result["rule"], "R3")
        self.assertNotIn("no historical forest", result["reason"])

    def test_real_sample_exposes_ndvi_before(self):
        result = explain_sample({
            "valid_obs_before": 4, "valid_obs_after": 4,
            "NDVI_baseline": 0.6, "NDVI_before": 0.68, "NDVI": 0.65,
            "NDVI_deviation_sigma": -1,
        })
        self.assertEqual(result["ndvi_before"], 0.68)

    def test_real_supporting_index_can_corroborate_strong_decline(self):
        result = explain_sample({
            "valid_obs_before": 4, "valid_obs_after": 4,
            "NDVI_baseline": 0.6, "NDVI": 0.2,
            "NDVI_deviation_sigma": -4.5,
            "NDMI_deviation_sigma": -3.0,
            "NBR_deviation_sigma": None,
            "NDVI_baseline_years": 4,
        })
        self.assertEqual(result["label"], "likely_loss")
        self.assertEqual(result["rule"], "R4")
        self.assertTrue(result["supporting_index_agrees"])

    def test_low_historical_vegetation_is_not_reported_as_loss(self):
        result = explain_sample({
            "valid_obs_before": 4, "valid_obs_after": 4,
            "NDVI_baseline": config.HISTORICAL_NDVI_MIN - 0.1,
            "NDVI_deviation_sigma": -5,
        })
        self.assertEqual(result["rule"], "R2")


if __name__ == "__main__":
    unittest.main()
