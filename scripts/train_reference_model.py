"""Train and honestly score a forest-loss model from two different regions.

Run:
    python scripts/train_reference_model.py --train data/training_maharashtra_2023.json \
        --eval data/training_tripura_2023.json --model-out models/forest_loss_rf.joblib

Training and evaluation come from separate tables produced by
`scripts/build_training_set.py` for separate states. That is the point: cells a few
hundred metres apart look alike, so a random split of one region would score well by
recognising the landscape instead of recognising loss.

Every number printed below is computed from the tables that were read. The labels are
a 30 m global loss product, so what the model learns is agreement with that product -
not verified legal deforestation, and not ecological damage. Tree votes are votes:
they are not calibrated probabilities of loss.
"""

import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from forestguard import config, metrics, mlmodel, modelreport


def describe(exc: Exception) -> str:
    return f"{type(exc).__name__}: {str(exc).strip().replace(chr(10), ' ')[:400]}"


def read_table(path):
    with open(path, encoding="utf-8") as handle:
        payload = json.load(handle)
    provenance = payload.get("provenance", {})
    if list(provenance.get("feature_names", [])) != list(config.FEATURE_BANDS):
        print(f"{path}: feature layout does not match this build, refusing to use it")
        return None
    if not payload.get("rows"):
        print(f"{path}: table holds no labelled rows, refusing to use it")
        return None
    return {
        "path": path,
        "region": provenance.get("region"),
        "region_name": provenance.get("region_name"),
        "role": provenance.get("role"),
        "reference_asset": provenance.get("reference_asset"),
        "windows": (provenance.get("before_window"), provenance.get("after_window")),
        "summary": payload.get("summary", {}),
        "rows": [tuple(row) for row in payload["rows"]],
        "labels": payload["labels"],
        "kept": payload.get("kept", []),
    }


def percent(value):
    return "not measured" if value is None else f"{value * 100:.1f} %"


def report_rate(name, successes, total):
    interval = metrics.wilson_interval(successes, total)
    if interval is None:
        return f"{name}: not measured (no scored samples)"
    low, high, point = interval
    return (f"{name}: {percent(point)} of {total} "
            f"(95 % interval {percent(low)} to {percent(high)})")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", required=True)
    parser.add_argument("--eval", dest="eval_path", required=True)
    parser.add_argument("--model-out", default="models/forest_loss_rf.joblib")
    parser.add_argument("--report-out", default="models/model_report.json",
                        help="machine-readable copy of every number printed here, "
                             "which the app shows on the model page without waiting "
                             "on Earth Engine")
    parser.add_argument("--min-rows-per-class", type=int, default=40)
    args = parser.parse_args()

    train = read_table(args.train)
    evaluation = read_table(args.eval_path)
    if train is None or evaluation is None:
        return 2
    if train["region"] == evaluation["region"]:
        print(f"REFUSED: both tables come from region {train['region']}; a model must "
              f"be scored on a region it never saw")
        return 2

    print(f"train: {train['path']} region {train['region']} ({train['role']}), "
          f"windows {train['windows'][0]} -> {train['windows'][1]}")
    print(f"  labelled cells: {len(train['rows'])} {train['summary']}")
    print(f"eval:  {evaluation['path']} region {evaluation['region']} "
          f"({evaluation['role']}), windows {evaluation['windows'][0]} -> "
          f"{evaluation['windows'][1]}")
    print(f"  labelled cells: {len(evaluation['rows'])} {evaluation['summary']}")
    if train["reference_asset"] != evaluation["reference_asset"]:
        print("WARNING: the two tables were labelled by different reference assets")

    try:
        bundle = train_model_or_exit(train, args.min_rows_per_class)
    except mlmodel.EvaluationError as exc:
        print(f"REFUSED: {exc}")
        return 3

    result = mlmodel.evaluate(bundle, evaluation["rows"], evaluation["labels"])
    prevalence = sum(1 for label in evaluation["labels"]
                     if label == mlmodel.LOSS) / len(evaluation["labels"])

    print("\n=== held-out region score ===")
    print(f"scored cells: {result.scored} of {result.total} "
          f"(abstained {result.abstained}, invalid {result.invalid})")
    print(f"true positive {result.true_positive}, false positive {result.false_positive}, "
          f"false negative {result.false_negative}, true negative {result.true_negative}")
    print(report_rate("precision", result.true_positive,
                      result.true_positive + result.false_positive))
    print(report_rate("recall", result.true_positive,
                      result.true_positive + result.false_negative))
    print(report_rate("false alarm rate on stable cells", result.false_positive,
                      result.false_positive + result.true_negative))
    print(f"F1: {'not measured' if result.f1 is None else round(result.f1, 3)}")
    print(f"labelled loss prevalence in the eval region: {percent(prevalence)} "
          f"(a model is only worth its margin over this)")

    os.makedirs(os.path.dirname(args.model_out) or ".", exist_ok=True)
    bundle.save(args.model_out)
    report = modelreport.build_report(bundle, train, evaluation, result)
    modelreport.save_report(report, args.report_out)
    print(f"\nmodel saved: {args.model_out}")
    print(f"report saved: {args.report_out} "
          f"(the app reads it at /api/model without an Earth Engine call)")
    print("caveats: labels are a 30 m global loss product, not verified legal "
          "deforestation; tree votes are not calibrated probabilities; the two "
          "regions differ in forest type and cloud regime, so this score does not "
          "transfer to a third region without a new check.")
    return 0


def train_model_or_exit(train, min_rows_per_class):
    return mlmodel.train_model(
        train["rows"], train["labels"], min_rows_per_class=min_rows_per_class
    )


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001 - a probe run should say why it stopped
        print("FAILED:", describe(exc))
        sys.exit(1)
