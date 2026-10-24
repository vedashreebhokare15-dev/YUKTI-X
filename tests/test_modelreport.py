import json
import os
import tempfile
import unittest

from forestguard import mlmodel, metrics
from forestguard.modelreport import build_report, load_report, parse_cell_id


def synthetic_tables():
    """Two tables in the shape `scripts/build_training_set.py` writes."""
    train = {
        "path": "data/training_mizoram_2025.json",
        "region": "mizoram",
        "region_name": "Mizoram tropical moist forest, Northeast India",
        "role": "train",
        "reference_asset": "UMD/hansen/global_forest_change_2025_v1_13",
        "windows": (("2020-10-15", "2020-12-15"), ("2025-10-15", "2025-12-15")),
        "summary": {"loss": 40, "no_loss": 260, "abstained": 900, "dropped": 0},
        "rows": [tuple([0.1 * index] * len(mlmodel.FEATURE_NAMES))
                 for index in range(len(ROWS_LABELS[0]))],
        "labels": ROWS_LABELS[0],
        "kept": [{"cell_id": f"92.7{index:02d}_23.6{index:02d}", "label": label}
                 for index, label in enumerate(ROWS_LABELS[0])],
    }
    evaluation = {
        "path": "data/training_tripura_2025.json",
        "region": "tripura",
        "region_name": "Tripura plantation and jhum landscape, Northeast India",
        "role": "eval",
        "reference_asset": "UMD/hansen/global_forest_change_2025_v1_13",
        "windows": (("2020-10-15", "2020-12-15"), ("2025-10-15", "2025-12-15")),
        "summary": {"loss": 29, "no_loss": 213, "abstained": 59, "dropped": 0},
        "rows": [tuple([0.2 * index] * len(mlmodel.FEATURE_NAMES))
                 for index in range(len(ROWS_LABELS[1]))],
        "labels": ROWS_LABELS[1],
        "kept": [{"cell_id": f"91.6{index:02d}_23.5{index:02d}", "label": label}
                 for index, label in enumerate(ROWS_LABELS[1])],
    }
    return train, evaluation


def labels(count, positives):
    return ["loss"] * positives + ["no_loss"] * (count - positives)


ROWS_LABELS = (labels(8, 4), labels(6, 3))


class TestCellIds(unittest.TestCase):
    def test_a_cell_id_is_the_position_it_was_sampled_at(self):
        self.assertEqual(parse_cell_id("91.69851_23.58000"), (91.69851, 23.58))

    def test_an_unparseable_id_stays_unplaced_instead_of_moving_to_the_origin(self):
        self.assertIsNone(parse_cell_id("not-a-cell"))
        self.assertIsNone(parse_cell_id(None))


class TestBuildReport(unittest.TestCase):
    def setUp(self):
        train, evaluation = synthetic_tables()
        self.train, self.evaluation = train, evaluation
        self.bundle = mlmodel.train_model(train["rows"], train["labels"],
                                          min_rows_per_class=3)
        self.result = mlmodel.evaluate(self.bundle, evaluation["rows"],
                                       evaluation["labels"])

    def test_the_report_carries_the_numbers_that_were_measured(self):
        report = build_report(self.bundle, self.train, self.evaluation, self.result)
        self.assertEqual(report["metrics"]["scored"], self.result.scored)
        self.assertEqual(report["metrics"]["total"], self.result.total)
        for name in ("precision", "recall", "false_alarm_rate", "f1"):
            self.assertIn(name, report["metrics"])

    def test_a_rate_comes_with_the_interval_that_bounds_it(self):
        report = build_report(self.bundle, self.train, self.evaluation, self.result)
        precision = report["metrics"]["precision"]
        self.assertEqual(precision["point"], self.result.precision)
        self.assertEqual(
            precision["interval"],
            list(metrics.wilson_interval(self.result.true_positive,
                                         self.result.true_positive
                                         + self.result.false_positive)[:2]),
        )

    def test_an_unmeasurable_rate_is_reported_as_unmeasured_not_as_zero(self):
        empty = metrics.Metrics(total=0, true_positive=0, false_positive=0,
                                false_negative=0, true_negative=0, abstained=0,
                                invalid=0)
        report = build_report(self.bundle, self.train, self.evaluation, empty)
        self.assertIsNone(report["metrics"]["precision"]["point"])
        self.assertIsNone(report["metrics"]["precision"]["interval"])

    def test_both_regions_are_named_with_what_each_one_supplied(self):
        report = build_report(self.bundle, self.train, self.evaluation, self.result)
        self.assertEqual(report["train"]["region"], "mizoram")
        self.assertEqual(report["train"]["rows"], 8)
        self.assertEqual(report["evaluation"]["region"], "tripura")
        self.assertEqual(report["evaluation"]["rows"], 6)
        self.assertNotEqual(report["train"]["region"], report["evaluation"]["region"])

    def test_every_held_out_cell_keeps_its_label_and_its_prediction(self):
        report = build_report(self.bundle, self.train, self.evaluation, self.result)
        cells = report["cells"]
        self.assertEqual(len(cells), 6)
        for cell in cells:
            self.assertIn(cell["prediction"], ("loss", "no_loss"))
            self.assertIn(cell["label"], ("loss", "no_loss"))
            self.assertEqual(cell["correct"], cell["prediction"] == cell["label"])
        self.assertEqual(cells[0]["position"], [91.60, 23.50])

    def test_feature_importances_are_named_in_stable_order(self):
        report = build_report(self.bundle, self.train, self.evaluation, self.result)
        names = [row["name"] for row in report["feature_importances"]]
        self.assertEqual(sorted(names), sorted(mlmodel.FEATURE_NAMES))
        total = sum(row["importance"] for row in report["feature_importances"])
        self.assertAlmostEqual(total, 1.0, places=6)

    def test_the_report_says_what_it_is_not(self):
        report = build_report(self.bundle, self.train, self.evaluation, self.result)
        joined = " ".join(report["caveats"])
        self.assertIn("30 m", joined)
        self.assertIn("probability", joined)


class TestSaveAndLoad(unittest.TestCase):
    def test_a_missing_file_is_no_model_rather_than_an_error(self):
        with tempfile.TemporaryDirectory() as root:
            self.assertIsNone(load_report(os.path.join(root, "absent.json")))

    def test_a_saved_report_reads_back_unchanged(self):
        from forestguard.modelreport import save_report

        train, evaluation = synthetic_tables()
        bundle = mlmodel.train_model(train["rows"], train["labels"],
                                     min_rows_per_class=3)
        report = build_report(bundle, train, evaluation,
                              mlmodel.evaluate(bundle, evaluation["rows"],
                                               evaluation["labels"]))
        with tempfile.TemporaryDirectory() as root:
            path = os.path.join(root, "nested", "model_report.json")
            save_report(report, path)
            self.assertEqual(load_report(path), report)
            self.assertEqual([entry for entry in os.listdir(os.path.dirname(path))],
                             ["model_report.json"])

    def test_a_corrupt_report_is_reported_as_unreadable_not_half_a_model(self):
        with tempfile.TemporaryDirectory() as root:
            path = os.path.join(root, "model_report.json")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("{not json")
            with self.assertRaises(ValueError):
                load_report(path)


if __name__ == "__main__":
    unittest.main()
