from . import config, dataquality
from .classify import explain
from .persistence import supporting_index_agrees

CLASS_BY_CODE = {
    1: "no_detected_loss",
    2: "possible_loss",
    3: "likely_loss",
    4: "insufficient_evidence",
}


def normalize_histogram(histogram) -> dict:
    if not histogram:
        return {}
    return {int(key): int(value) for key, value in histogram.items()}


def class_areas(histogram, cell_area_m2=config.ANALYSIS_SCALE_METERS ** 2) -> dict:
    counts_by_code = normalize_histogram(histogram)
    counts = {
        label: counts_by_code.get(code, 0) for code, label in CLASS_BY_CODE.items()
    }
    return {
        "counts": counts,
        "hectares": {
            label: dataquality.area_hectares(count, cell_area_m2)
            for label, count in counts.items()
        },
    }


def explain_sample(sample: dict) -> dict:
    before = int(sample.get("valid_obs_before") or 0)
    after = int(sample.get("valid_obs_after") or 0)
    baseline = sample.get("NDVI_baseline")
    deviation = sample.get("NDVI_deviation_sigma")
    historical_forest = None if baseline is None else baseline >= config.HISTORICAL_NDVI_MIN
    support = supporting_index_agrees([
        sample.get("NDMI_deviation_sigma"), sample.get("NBR_deviation_sigma")
    ])
    label, rule, reason = explain(
        valid_before=before,
        valid_after=after,
        historical_forest=False if historical_forest is None else historical_forest,
        deviation_sigma=deviation,
        supporting_index_agrees=support,
        persistence_confirmed=None,
    )
    return {
        "label": label,
        "rule": rule,
        "reason": reason,
        "valid_obs_before": before,
        "valid_obs_after": after,
        "historical_forest": historical_forest,
        "ndvi_baseline": baseline,
        "ndvi_before": sample.get("NDVI_before"),
        "ndvi_current": sample.get("NDVI"),
        "ndmi_current": sample.get("NDMI"),
        "nbr_current": sample.get("NBR"),
        "deviation_sigma": deviation,
        "ndmi_deviation_sigma": sample.get("NDMI_deviation_sigma"),
        "nbr_deviation_sigma": sample.get("NBR_deviation_sigma"),
        "seasons_in_baseline": sample.get("NDVI_baseline_years"),
        "supporting_index_agrees": support,
        "persistence_confirmed": None,
    }
