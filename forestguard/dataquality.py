"""Data-quality arithmetic over numbers already fetched from Earth Engine.

Kept free of Earth Engine so the honesty rules can be unit-tested: an empty
window is reported as empty rather than as zero loss, a missing statistic stays
missing rather than becoming 0, and area is only summed over pixels that carry
observations.
"""

from dataclasses import dataclass, field
from statistics import fmean

from . import config


@dataclass
class WindowQuality:
    start: str
    end: str
    scenes_found: int
    scenes_usable: int
    acquisition_dates: list = field(default_factory=list)
    status: str = "ok"
    notes: list = field(default_factory=list)
    reportable: bool = True


def assess_window(start: str, end: str, scenes_found: int, scenes_usable: int,
                  acquisition_dates=None,
                  min_valid_observations: int = config.MIN_VALID_OBSERVATIONS) -> WindowQuality:
    """Judge one study window before any composite is trusted."""
    dates = list(acquisition_dates or [])
    quality = WindowQuality(
        start=start, end=end, scenes_found=scenes_found, scenes_usable=scenes_usable,
        acquisition_dates=dates,
    )
    if scenes_found == 0:
        quality.status = "empty"
        quality.reportable = False
        quality.notes.append(
            "no scenes in this window: any map produced here would be an artefact, "
            "not a measurement"
        )
        return quality
    if scenes_usable == 0:
        quality.status = "no_screenable_scenes"
        quality.reportable = False
        quality.notes.append(
            f"{scenes_found} scene(s) exist but none survived the cloud-probability "
            "join; run this window with QA60 screening only"
        )
        return quality
    if scenes_usable < min_valid_observations:
        quality.status = "thin"
        quality.notes.append(
            f"only {scenes_usable} usable scene(s); per-pixel observation counts below "
            f"{min_valid_observations} will be reported as insufficient evidence"
        )
    if dates and len(dates) != scenes_found:
        quality.notes.append(
            f"{len(dates)} acquisition timestamps recorded against {scenes_found} scenes"
        )
    return quality


def coverage_from_histogram(counts_by_obs, min_required: int, cell_area_m2: float):
    """Valid-area coverage from a per-pixel observation-count histogram.

    `counts_by_obs` maps a valid-observation count to the number of pixels with
    that count, as returned by counting each level over the study area. Pixels
    with no observation are reported separately instead of being folded into the
    "no loss" area.
    """
    total = sum(int(v) for v in counts_by_obs.values())
    if total == 0:
        return {
            "total_pixels": 0, "sufficient_pixels": 0, "insufficient_pixels": 0,
            "unobserved_pixels": 0, "sufficient_share": None,
            "sufficient_hectares": 0.0, "unobserved_hectares": 0.0,
        }
    unobserved = int(counts_by_obs.get(0, 0))
    sufficient = sum(int(v) for key, v in counts_by_obs.items() if int(key) >= min_required)
    insufficient = total - sufficient - unobserved
    return {
        "total_pixels": total,
        "sufficient_pixels": sufficient,
        "insufficient_pixels": insufficient,
        "unobserved_pixels": unobserved,
        "sufficient_share": sufficient / total,
        "sufficient_hectares": area_hectares(sufficient, cell_area_m2),
        "unobserved_hectares": area_hectares(unobserved, cell_area_m2),
    }


def area_hectares(pixel_count: int, cell_area_m2: float) -> float:
    return (pixel_count * cell_area_m2) / 10_000


def cloud_percentage_summary(values) -> dict:
    """Summarise CLOUDY_PIXEL_PERCENTAGE scene properties. No scenes, no number."""
    cleaned = [float(v) for v in values if v is not None]
    if not cleaned:
        return {"scenes": 0, "mean": None, "minimum": None, "maximum": None}
    return {
        "scenes": len(cleaned),
        "mean": fmean(cleaned),
        "minimum": min(cleaned),
        "maximum": max(cleaned),
    }


def merge_window_quality(qualities) -> dict:
    """Roll per-window judgements up into one run-level summary."""
    unreportable = [q for q in qualities if not q.reportable]
    return {
        "windows": len(qualities),
        "empty_windows": sum(1 for q in qualities if q.status == "empty"),
        "thin_windows": sum(1 for q in qualities if q.status == "thin"),
        "unreportable_windows": len(unreportable),
        "reportable": not unreportable,
        "notes": [note for q in qualities for note in q.notes],
    }
