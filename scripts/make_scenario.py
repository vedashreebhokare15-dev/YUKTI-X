"""Build a labelled SIMULATION scenario with the real classifier, not a fake one.

Earth Engine is still unavailable, so this grid contains no satellite measurement.
It exists to exercise the interface and the rule table end to end: every class
label here comes from `forestguard.classify.explain`, the same code path a real run
will use. The output file states its own origin in every field the UI displays.

Run: python scripts/make_scenario.py
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from forestguard import config
from forestguard.classify import explain
from forestguard.persistence import persistent_decline, supporting_index_agrees
from forestguard.seasonal import expected_seasonal, standardised_deviation

COLUMNS, ROWS = 46, 30
WEST, SOUTH, EAST, NORTH = 77.20, 21.20, 77.50, 21.40

GREEN_WET = 0.72
GREEN_DRY = 0.55


def zone(col, row):
    """Which invented situation this cell is in."""
    if row < 5 and col < 14:
        return "cloud_gap"
    if 9 <= row <= 16 and 20 <= col <= 29:
        return "clearing"
    if 19 <= row <= 26 and 6 <= col <= 15:
        return "logging_likely"
    if 3 <= row <= 8 and 30 <= col <= 41:
        return "young_plantation"
    if row >= 24 and col >= 36:
        return "bare_non_forest"
    return "mature_forest"


def season_ndvi(kind, year, dry, seed=0.0):
    """Invented NDVI per year/season. Deliberately has a normal annual rhythm."""
    base = {
        "mature_forest": (GREEN_WET, GREEN_DRY),
        "young_plantation": (0.61, 0.40),
        "clearing": (0.70, 0.53),
        "logging_likely": (0.70, 0.53),
        "cloud_gap": (GREEN_WET, GREEN_DRY),
        "bare_non_forest": (0.22, 0.12),
    }[kind]
    # Interannual spread is what makes a seasonal expectation meaningful, so it is
    # invented at a size a dry deciduous forest actually shows, not a rounding wobble.
    wobble = 0.045 * math.sin(year * 1.7 + seed) + 0.02 * math.sin(year * 0.6 + seed * 2.3)
    value = base[1 if dry else 0] + wobble
    if kind == "young_plantation" and not dry:
        value += 0.02 * (year - 1)
    return round(value, 4)


def build_cell(col, row):
    kind = zone(col, row)
    hidden = kind == "cloud_gap" and (col + row) % 3 != 0

    seed = col * 0.61 + row * 1.13

    def observations(dry):
        return [None if hidden and dry else season_ndvi(kind, year, dry, seed)
                for year in range(2021, 2025)]

    history = observations(dry=True)
    baseline = expected_seasonal(history, min_years=config.MIN_BASELINE_YEARS)

    if kind == "clearing":
        current = round(season_ndvi(kind, 2025, True, seed) - 0.30, 4)
        later = [round(current + 0.01, 4), round(current + 0.02, 4)]
        moisture_change = -0.28
    elif kind == "logging_likely":
        current = round(season_ndvi(kind, 2025, True, seed) - 0.22, 4)
        later = [round(current - 0.01, 4), round(current, 4)]
        moisture_change = -0.21
    else:
        current = None if hidden else season_ndvi(kind, 2025, True, seed)
        later = [current, current] if current else []
        moisture_change = 0.0 if current is None else round(current - season_ndvi(kind, 2024, True, seed), 4)

    deviation = standardised_deviation(current, baseline)
    supports = supporting_index_agrees(
        [deviation, moisture_change / 0.12 * abs(deviation or 0.001)] if deviation else []
    )
    persistence = persistent_decline(
        later, baseline, threshold_sigma=config.WEAK_SIGMA, min_observations=2
    )

    label, rule, reason = explain(
        valid_before=0 if hidden else len([v for v in history if v is not None]),
        valid_after=0 if hidden else 3,
        historical_forest=kind != "bare_non_forest",
        deviation_sigma=deviation,
        supporting_index_agrees=supports,
        persistence_confirmed=persistence,
        weak_sigma=config.WEAK_SIGMA,
        strong_sigma=config.STRONG_SIGMA,
        min_valid_observations=config.MIN_VALID_OBSERVATIONS,
    )

    return {
        "col": col, "row": row,
        "lon": round(WEST + (col + 0.5) * (EAST - WEST) / COLUMNS, 5),
        "lat": round(NORTH - (row + 0.5) * (NORTH - SOUTH) / ROWS, 5),
        "zone": kind,
        "ndvi_baseline": baseline.mean,
        "ndvi_current": current,
        "deviation_sigma": None if deviation is None else round(deviation, 3),
        "seasons_in_baseline": baseline.years,
        "baseline_reliable": baseline.reliable,
        "valid_obs_before": 0 if hidden else len([v for v in history if v is not None]),
        "valid_obs_after": 0 if hidden else 3,
        "label": label,
        "rule": rule,
        "reason": reason,
    }


def main():
    cells = [build_cell(col, row) for row in range(ROWS) for col in range(COLUMNS)]
    counts = {}
    for cell in cells:
        counts[cell["label"]] = counts.get(cell["label"], 0) + 1
    cell_area_m2 = 400.0

    scenario = {
        "provenance": {
            "origin": "SIMULATION - invented pixel values, no satellite data",
            "why": "Earth Engine access is not active for this account yet, so the "
                   "interface and the rule table are exercised on synthetic scenes",
            "do_not_publish_as": "forest loss measurement",
            "classifier": "forestguard.classify.explain, the same rules a real run uses",
            "thresholds": {
                "weak_sigma": config.WEAK_SIGMA,
                "strong_sigma": config.STRONG_SIGMA,
                "min_valid_observations": config.MIN_VALID_OBSERVATIONS,
                "min_baseline_years": config.MIN_BASELINE_YEARS,
            },
            "study_region": config.PILOT["name"],
            "season_window": "15 Oct - 15 Dec, matched across years",
            "grid": {"columns": COLUMNS, "rows": ROWS, "cell_area_m2": cell_area_m2},
            "class_counts": counts,
            "class_hectares": {
                key: round(value * cell_area_m2 / 10000, 3) for key, value in counts.items()
            },
        },
        "cells": cells,
    }

    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "webapp")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "scenario.json")
    with open(path, "w") as handle:
        json.dump(scenario, handle, indent=1)
    print(f"wrote {path}: {len(cells)} cells, classes {counts}")


if __name__ == "__main__":
    main()
