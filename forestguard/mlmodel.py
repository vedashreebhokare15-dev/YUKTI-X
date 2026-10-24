"""Random forest over seasonal-index features, trained outside Earth Engine.

Rows arrive as the ordered tuples produced by `mlfeatures.vectorize`, collected by
a sampling script and stored as JSON. Keeping the fit here (plain scikit-learn) and
the measurement in Earth Engine means the model can be retrained, inspected and
re-scored without another satellite request.

No class probability is exposed as a likelihood of deforestation. Tree votes are
recorded as votes; turning them into calibrated probabilities needs labelled data
from the same distribution, which is exactly what the held-out region decides.
"""

from dataclasses import dataclass, field
from pathlib import Path

import joblib
from sklearn.ensemble import RandomForestClassifier

from . import config, metrics
from .classify import LIKELY_LOSS, NO_LOSS
from .mlfeatures import FEATURE_NAMES
from .reflabels import LOSS, NO_LOSS as REF_NO_LOSS

CLASS_LABELS = (LOSS, REF_NO_LOSS)
_TO_DETECTION = {LOSS: LIKELY_LOSS, REF_NO_LOSS: NO_LOSS}


class EvaluationError(Exception):
    """The rows, labels or split cannot support the requested fit or score."""


@dataclass(frozen=True)
class Bundle:
    model: RandomForestClassifier
    classes: tuple
    feature_names: tuple = FEATURE_NAMES
    rows: int = 0
    trained_from: dict = field(default_factory=dict)

    def save(self, path) -> Path:
        path = Path(path)
        joblib.dump(self, path)
        return path


def make_model(**overrides) -> RandomForestClassifier:
    params = {
        "n_estimators": config.MODEL_N_ESTIMATORS,
        "max_depth": config.MODEL_MAX_DEPTH,
        # Reference labels come from a coarse loss layer, so positive cells are far
        # rarer than stable ones. Sampling per class keeps the minority class visible
        # without inventing examples.
        "class_weight": "balanced_subsample",
        "n_jobs": 1,
        "random_state": config.MODEL_RANDOM_STATE,
    }
    params.update(overrides)
    return RandomForestClassifier(**params)


def _check_rows(rows, labels):
    if len(rows) != len(labels):
        raise EvaluationError(f"{len(rows)} rows but {len(labels)} labels")
    wrong_width = [index for index, row in enumerate(rows) if len(row) != len(FEATURE_NAMES)]
    if wrong_width:
        raise EvaluationError(
            f"{len(wrong_width)} rows have {len(rows[wrong_width[0]])} values, "
            f"expected {len(FEATURE_NAMES)} features"
        )
    unknown = sorted({label for label in labels} - set(CLASS_LABELS))
    if unknown:
        raise EvaluationError(f"labels outside the reference vocabulary: {', '.join(unknown)}")


def train_model(rows, labels, min_rows_per_class: int = 3, **model_overrides) -> Bundle:
    if not rows:
        raise EvaluationError("no training rows")
    _check_rows(rows, labels)

    per_class = {label: sum(1 for value in labels if value == label) for label in CLASS_LABELS}
    missing = [f"{label} ({count})" for label, count in per_class.items() if count < min_rows_per_class]
    if missing:
        raise EvaluationError(
            f"needs at least {min_rows_per_class} rows per class, got {', '.join(missing)}"
        )

    model = make_model(**model_overrides)
    model.fit(list(rows), list(labels))
    return Bundle(
        model=model,
        classes=tuple(str(name) for name in model.classes_),
        rows=len(rows),
        trained_from={"rows": len(rows), **per_class, "features": list(FEATURE_NAMES)},
    )


def load_model(path) -> Bundle:
    bundle = joblib.load(Path(path))
    if bundle.feature_names != FEATURE_NAMES:
        raise EvaluationError("saved model was trained on a different feature layout")
    return bundle


def evaluate(bundle: Bundle, rows, labels):
    """Score predictions with the project's existing metric rules.

    A model "loss" is scored as `likely_loss` and a "no_loss" as `no_detected_loss`,
    so precision and recall follow the same definitions used by the rule detector.
    """
    if not rows:
        raise EvaluationError("no rows to evaluate")
    _check_rows(rows, labels)
    predictions = bundle.model.predict(list(rows))
    pairs = ((_TO_DETECTION[predicted], label == LOSS) for predicted, label in zip(predictions, labels))
    return metrics.evaluate(pairs)
