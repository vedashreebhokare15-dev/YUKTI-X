"""The machine-readable record of one trained model, written for the app to read.

`scripts/train_reference_model.py` prints a scored summary for a person; this module
turns the same numbers into one JSON file so a page can show them instantly instead of
waiting on an Earth Engine computation. Nothing here measures anything: every value is
carried in from the bundle, the tables and the metrics object that were already
computed, and an unmeasurable rate leaves as `None` rather than a comfortable zero.
"""

from datetime import datetime, timezone
import json
import os

from . import metrics
from .mlmodel import LOSS

REPORT_NAME = "model_report.json"


def parse_cell_id(cell_id):
    """`"91.69851_23.58000"` back to the point it was sampled at, or None."""
    if not isinstance(cell_id, str) or "_" not in cell_id:
        return None
    lon_text, _, lat_text = cell_id.partition("_")
    try:
        return float(lon_text), float(lat_text)
    except ValueError:
        return None


def _rate(successes, total):
    """A measured rate with the interval that bounds it, or a plain not-measured."""
    interval = metrics.wilson_interval(successes, total)
    return {
        "numerator": successes,
        "denominator": total,
        "point": interval[2] if interval else None,
        "interval": list(interval[:2]) if interval else None,
    }


def _table(table):
    before, after = table.get("windows", (None, None))
    return {
        "path": table.get("path"),
        "region": table.get("region"),
        "region_name": table.get("region_name"),
        "role": table.get("role"),
        "rows": len(table.get("rows", ())),
        "counts": table.get("summary", {}),
        "before_window": list(before or ()),
        "after_window": list(after or ()),
        "reference_asset": table.get("reference_asset"),
    }


def build_report(bundle, train, evaluation, result, generated_at=None):
    """Assemble the report the app displays; every field comes from what was run."""
    predictions = bundle.model.predict(list(evaluation["rows"]))
    kept = evaluation.get("kept", [])
    cells = []
    for index, label in enumerate(evaluation["labels"]):
        record = kept[index] if index < len(kept) else {}
        position = parse_cell_id(record.get("cell_id"))
        prediction = str(predictions[index])
        cells.append({
            "cell_id": record.get("cell_id"),
            "position": list(position) if position else None,
            "label": label,
            "prediction": prediction,
            "loss_share": record.get("loss_share"),
            "correct": prediction == label,
        })

    labelled_loss = sum(1 for label in evaluation["labels"] if label == LOSS)
    caveats = [
        "Labels are the 30 m Hansen global forest-loss product, not verified legal "
        "deforestation and not ground truth: the model learns agreement with that "
        "product.",
        "A prediction is a class from tree votes, not a calibrated probability of "
        "loss; no per-cell confidence value exists.",
        f"Scored on one held-out state ({evaluation.get('region')}) that the model "
        "never saw. Forest type and cloud regime change between regions, so this "
        "score does not transfer to a third region without a new check.",
        "The reference product dates loss to a calendar year, so a loss near a "
        "window boundary can sit on either side of its label.",
    ]

    return {
        "generated_at": (generated_at or datetime.now(timezone.utc))
                        .isoformat(timespec="seconds"),
        "model": {
            "algorithm": "random_forest",
            "rows": bundle.rows,
            "classes": list(bundle.classes),
            "features": list(bundle.feature_names),
        },
        "train": _table(train),
        "evaluation": _table(evaluation),
        "metrics": {
            "total": result.total,
            "scored": result.scored,
            "abstained": result.abstained,
            "invalid": result.invalid,
            "true_positive": result.true_positive,
            "false_positive": result.false_positive,
            "false_negative": result.false_negative,
            "true_negative": result.true_negative,
            "precision": _rate(result.true_positive,
                               result.true_positive + result.false_positive),
            "recall": _rate(result.true_positive,
                            result.true_positive + result.false_negative),
            "false_alarm_rate": _rate(result.false_positive,
                                      result.false_positive + result.true_negative),
            "f1": result.f1,
            "loss_prevalence_in_sample": (labelled_loss / len(evaluation["labels"])
                                          if evaluation["labels"] else None),
        },
        "feature_importances": [
            {"name": name, "importance": float(value)}
            for name, value in zip(bundle.feature_names,
                                   bundle.model.feature_importances_)
        ],
        "cells": cells,
        "caveats": caveats,
    }


def save_report(report, path):
    """Write the report in one move: a page mid-retrain never reads a half file."""
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    temporary = os.path.join(directory, f".{os.path.basename(path)}.tmp")
    with open(temporary, "w", encoding="utf-8") as handle:
        handle.write(json.dumps(report, indent=1, allow_nan=False))
    os.replace(temporary, path)
    return path


def load_report(path):
    """The report as written, or None when no model has been trained and scored yet.

    A file that exists but does not parse raises: a half-read model page would look
    like a result.
    """
    if not path or not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)
