import unittest

from sklearn.exceptions import NotFittedError

from forestguard.mlmodel import EvaluationError, evaluate, load_model, make_model, train_model

# A separable toy set: loss cells fall together in index space, stable cells elsewhere.
LOSS_ROWS = [
    (0.71, 0.58, 0.44, 0.31, 0.35, 0.12, -3.1, -2.0, -4.2, 4, 5, 0.68),
    (0.74, 0.55, 0.45, 0.28, 0.36, 0.09, -3.6, -2.4, -4.8, 5, 5, 0.70),
    (0.70, 0.52, 0.42, 0.25, 0.33, 0.07, -4.0, -2.8, -5.1, 4, 4, 0.66),
    (0.73, 0.60, 0.46, 0.33, 0.37, 0.15, -2.8, -1.9, -3.9, 5, 4, 0.69),
]
STABLE_ROWS = [
    (0.69, 0.72, 0.41, 0.45, 0.32, 0.34, 0.6, 0.8, 0.5, 4, 5, 0.67),
    (0.68, 0.70, 0.40, 0.43, 0.31, 0.32, 0.4, 0.6, 0.3, 5, 5, 0.66),
    (0.72, 0.74, 0.43, 0.47, 0.34, 0.36, 0.7, 0.9, 0.6, 4, 4, 0.70),
    (0.70, 0.71, 0.42, 0.44, 0.33, 0.33, 0.5, 0.7, 0.4, 5, 4, 0.68),
]
LABELS = ["loss", "loss", "loss", "loss", "no_loss", "no_loss", "no_loss", "no_loss"]


class TestTraining(unittest.TestCase):
    def test_training_returns_a_model_that_predicts_every_class(self):
        bundle = train_model(LOSS_ROWS + STABLE_ROWS, LABELS)
        predictions = bundle.model.predict([LOSS_ROWS[0], STABLE_ROWS[0]])
        self.assertEqual(set(bundle.classes), {"loss", "no_loss"})
        self.assertEqual(predictions[0], "loss")
        self.assertEqual(predictions[1], "no_loss")

    def test_unfitted_model_refuses_to_predict(self):
        with self.assertRaises(NotFittedError):
            make_model().predict([[0.0] * 12])

    def test_mismatched_row_and_label_counts_are_rejected(self):
        with self.assertRaises(EvaluationError):
            train_model(LOSS_ROWS, ["loss"])

    def test_a_single_class_training_set_is_rejected(self):
        with self.assertRaises(EvaluationError):
            train_model(LOSS_ROWS, ["loss"] * len(LOSS_ROWS))

    def test_too_few_rows_for_a_honest_holdout_are_rejected(self):
        with self.assertRaises(EvaluationError):
            train_model(LOSS_ROWS[:2] + STABLE_ROWS[:2], ["loss", "loss", "no_loss", "no_loss"])


class TestSerialisation(unittest.TestCase):
    def test_saved_bundle_carries_the_feature_names_it_was_trained_on(self):
        import tempfile
        from pathlib import Path

        from forestguard.mlfeatures import FEATURE_NAMES

        bundle = train_model(LOSS_ROWS + STABLE_ROWS, LABELS)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "model.joblib"
            bundle.save(path)
            restored = load_model(path)

        self.assertEqual(restored.feature_names, FEATURE_NAMES)
        self.assertEqual(restored.model.predict([LOSS_ROWS[2]])[0], "loss")


class TestEvaluation(unittest.TestCase):
    def test_counts_are_reported_through_the_existing_metric_rules(self):
        from forestguard.metrics import Metrics

        bundle = train_model(LOSS_ROWS + STABLE_ROWS, LABELS)
        rows = [LOSS_ROWS[0], STABLE_ROWS[0], LOSS_ROWS[1], STABLE_ROWS[1]]
        truth = ["loss", "no_loss", "no_loss", "loss"]
        result = evaluate(bundle, rows, truth)

        self.assertIsInstance(result, Metrics)
        self.assertEqual(result.true_positive, 1)
        self.assertEqual(result.true_negative, 1)
        self.assertEqual(result.false_positive, 1)
        self.assertEqual(result.false_negative, 1)

    def test_an_unknown_label_is_rejected_before_it_is_scored(self):
        bundle = train_model(LOSS_ROWS + STABLE_ROWS, LABELS)
        with self.assertRaises(EvaluationError):
            evaluate(bundle, [LOSS_ROWS[0]], ["insufficient_evidence"])

    def test_row_width_must_match_the_trained_feature_names(self):
        bundle = train_model(LOSS_ROWS + STABLE_ROWS, LABELS)
        with self.assertRaises(EvaluationError):
            train_model([LOSS_ROWS[0][:5]], ["loss"])


if __name__ == "__main__":
    unittest.main()
