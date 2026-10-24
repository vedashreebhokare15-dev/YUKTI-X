"""Matched-season window arithmetic, kept free of Earth Engine so it is testable.

A seasonal comparison is only honest if the two periods cover the same part of
the calendar year and the historical years used to build the expectation exclude
the period being tested. Both of those properties are pure date arithmetic.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

_MONTH_DAYS = ((31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31),
               (31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31))


def dates_from_millis(values_ms) -> list:
    """Earth Engine `system:time_start` values as UTC calendar dates."""
    return [
        datetime.fromtimestamp(value / 1000, timezone.utc).date().isoformat()
        for value in values_ms
    ]


def parse_iso(text: str) -> date:
    try:
        return date.fromisoformat(text)
    except ValueError as exc:
        raise ValueError(f"not an ISO date: {text!r}") from exc


def _shift_year(day: date, year: int) -> date:
    """Same calendar day in another year, clamping 29 Feb in non-leap years."""
    largest = _MONTH_DAYS[_is_leap(year)][day.month - 1]
    return date(year, day.month, min(day.day, largest))


def _is_leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def validate_window(start: str, end: str) -> tuple[date, date]:
    first, last = parse_iso(start), parse_iso(end)
    if last <= first:
        raise ValueError(f"window ends on or before it starts: {start}..{end}")
    return first, last


def matched_windows(start: str, end: str, years) -> list:
    """Same calendar window repeated for each year, as (year, start, end).

    End dates are exclusive, matching Earth Engine's `filterDate`. In a
    non-leap year a 28-29 February window collapses to a single clamped day, so
    the end is pushed one day forward rather than becoming an empty window that
    would silently return no scenes.
    """
    first, last = validate_window(start, end)
    out = []
    for year in sorted(years):
        shifted_start = _shift_year(first, year)
        shifted_end = _shift_year(last, year)
        if shifted_end <= shifted_start:
            shifted_end = shifted_start + timedelta(days=1)
        out.append((year, shifted_start.isoformat(), shifted_end.isoformat()))
    return out



def history_windows(current_start: str, current_end: str, history_years: int) -> list:
    """Prior-year windows for the seasonal baseline.

    The current year is never included: an expectation built from the period it
    is meant to judge would leak the answer into the baseline.
    """
    first, _ = validate_window(current_start, current_end)
    if history_years < 1:
        return []
    return matched_windows(current_start, current_end,
                           [first.year - offset for offset in range(1, history_years + 1)])
