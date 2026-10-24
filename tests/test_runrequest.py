import unittest

from forestguard import config
from forestguard.runrequest import (
    MAX_FORCIBLE_AREA_KM2, REGIONS, box_area_km2, normalize_request, point_inside,
    regions_metadata,
)


class TestForcibleRegions(unittest.TestCase):
    """A run has to be computable in one Earth Engine request to exist at all.

    Measured 2026-10-25 on the pilot box: forcing one Sentinel-2 composite over
    its 679 km2 ran for 14 minutes without returning, so a run that ends in a
    whole-region class histogram cannot finish there. The slice below is the same
    pipeline and the same gates over an area one request can actually force.
    """

    def test_area_of_the_pilot_box_is_far_above_the_limit(self):
        self.assertGreater(box_area_km2(config.PILOT["aoi"]), 4 * MAX_FORCIBLE_AREA_KM2)

    def test_a_runnable_slice_inside_the_pilot_exists(self):
        self.assertIn("pilot_slice", REGIONS)
        self.assertLessEqual(box_area_km2(REGIONS["pilot_slice"]["aoi"]),
                             MAX_FORCIBLE_AREA_KM2)

    def test_the_slice_sits_inside_the_pilot_box_it_reports_on(self):
        for lon, lat in REGIONS["pilot_slice"]["aoi"]:
            self.assertTrue(point_inside(config.PILOT["aoi"], lon, lat),
                            f"{lon}, {lat} is outside the pilot region")

    def test_the_slice_carries_its_own_windows(self):
        region = REGIONS["pilot_slice"]
        for name in ("before", "after", "history_years"):
            self.assertIn(name, region, f"{name} is missing, so a run cannot default")

    def test_metadata_tells_the_app_which_regions_can_be_forced(self):
        rows = {row["key"]: row for row in regions_metadata()}
        self.assertTrue(rows["pilot_slice"]["forcible"])
        self.assertFalse(rows["pilot"]["forcible"])

    def test_the_slice_is_a_valid_request_region(self):
        request = normalize_request({"region": "pilot_slice"})
        self.assertEqual(request["region"], "pilot_slice")
        self.assertEqual(request["before"], REGIONS["pilot_slice"]["before"])
        self.assertEqual(request["after"], REGIONS["pilot_slice"]["after"])


class TestRunRequest(unittest.TestCase):
    def test_defaults_use_the_pilot_and_probability_screening(self):
        request = normalize_request({})
        self.assertEqual(request["region"], "pilot")
        self.assertEqual(request["before"], config.PILOT["before"])
        self.assertEqual(request["after"], config.PILOT["after"])
        self.assertEqual(request["history_years"], config.PILOT["history_years"])
        self.assertTrue(request["use_cloud_probability"])

    def test_explicit_dates_are_preserved(self):
        request = normalize_request({
            "region": "held_out",
            "before_start": "2023-01-01", "before_end": "2023-02-01",
            "after_start": "2024-01-01", "after_end": "2024-02-01",
            "history_years": 3,
        })
        self.assertEqual(request["before"], ("2023-01-01", "2023-02-01"))
        self.assertEqual(request["after"], ("2024-01-01", "2024-02-01"))

    def test_unknown_region_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "region"):
            normalize_request({"region": "anywhere"})

    def test_reversed_window_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "before"):
            normalize_request({"before_start": "2024-02-01", "before_end": "2024-01-01"})

    def test_excessively_long_window_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "120 days"):
            normalize_request({"before_start": "2023-01-01", "before_end": "2024-01-01"})

    def test_history_must_cover_at_least_the_required_seasons(self):
        with self.assertRaisesRegex(ValueError, "history_years"):
            normalize_request({"history_years": config.MIN_BASELINE_YEARS - 1})

    def test_history_has_a_compute_limit(self):
        with self.assertRaisesRegex(ValueError, "history_years"):
            normalize_request({"history_years": 7})

    def test_probability_flag_must_be_boolean(self):
        with self.assertRaisesRegex(ValueError, "use_cloud_probability"):
            normalize_request({"use_cloud_probability": "yes"})


class TestInspectionBounds(unittest.TestCase):
    def test_outside_longitude_is_rejected_even_when_latitude_matches(self):
        self.assertFalse(point_inside(config.PILOT["aoi"], 80, 21.3))

    def test_point_inside_box_is_accepted(self):
        self.assertTrue(point_inside(config.PILOT["aoi"], 77.3, 21.3))


if __name__ == "__main__":
    unittest.main()
