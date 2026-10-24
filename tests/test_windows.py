"""Matched-season window arithmetic: the leakage and calendar guarantees."""

import unittest

from forestguard import windows


class TestValidateWindow(unittest.TestCase):
    def test_reversed_window_is_rejected(self):
        with self.assertRaises(ValueError):
            windows.validate_window("2024-12-15", "2024-10-15")

    def test_same_day_window_is_rejected(self):
        with self.assertRaises(ValueError):
            windows.validate_window("2024-10-15", "2024-10-15")

    def test_non_iso_text_is_rejected(self):
        with self.assertRaises(ValueError):
            windows.parse_iso("15/10/2024")


class TestMatchedWindows(unittest.TestCase):
    def test_same_calendar_days_repeat_across_years(self):
        result = windows.matched_windows("2024-10-15", "2024-12-15", [2021, 2022, 2023])
        self.assertEqual(result, [
            (2021, "2021-10-15", "2021-12-15"),
            (2022, "2022-10-15", "2022-12-15"),
            (2023, "2023-10-15", "2023-12-15"),
        ])

    def test_years_come_back_in_order(self):
        result = windows.matched_windows("2024-10-15", "2024-12-15", [2023, 2020, 2022])
        self.assertEqual([row[0] for row in result], [2020, 2022, 2023])

    def test_29_february_clamps_in_a_non_leap_year(self):
        result = windows.matched_windows("2024-02-28", "2024-02-29", [2023])
        self.assertEqual(result, [(2023, "2023-02-28", "2023-03-01")])

    def test_a_clamped_window_never_becomes_empty(self):
        for year, start, end in windows.matched_windows("2024-02-28", "2024-02-29",
                                                        [2021, 2022, 2023, 2024]):
            self.assertLess(start, end)


class TestHistoryWindows(unittest.TestCase):
    def test_current_year_is_never_in_its_own_baseline(self):
        result = windows.history_windows("2025-10-15", "2025-12-15", 4)
        self.assertEqual([row[0] for row in result], [2021, 2022, 2023, 2024])

    def test_zero_history_is_no_baseline(self):
        self.assertEqual(windows.history_windows("2025-10-15", "2025-12-15", 0), [])

    def test_history_windows_keep_the_same_seasonal_span(self):
        result = windows.history_windows("2025-10-15", "2025-12-15", 3)
        self.assertTrue(all(start[5:] == "10-15" and end[5:] == "12-15"
                            for _, start, end in result))


class TestDatesFromMillis(unittest.TestCase):
    def test_epoch_milliseconds_become_utc_dates(self):
        self.assertEqual(windows.dates_from_millis([1730000000000]), ["2024-10-27"])

    def test_empty_input_gives_empty_output(self):
        self.assertEqual(windows.dates_from_millis([]), [])

    def test_ordering_is_preserved(self):
        dates = windows.dates_from_millis([1730000000000, 1729396800000])
        self.assertEqual(len(dates), 2)
        self.assertGreater(dates[0], dates[1])


if __name__ == "__main__":
    unittest.main()
