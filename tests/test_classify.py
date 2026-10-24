"""Rule-table tests. Pure Python, no Earth Engine calls."""

import unittest

from forestguard.classify import (
    INSUFFICIENT,
    LIKELY_LOSS,
    NO_LOSS,
    POSSIBLE_LOSS,
    classify,
)
from forestguard.classify import explain as classify_explain


def decide(deviation_sigma, valid_before=10, valid_after=10, historical_forest=True,
           supporting_index_agrees=False, persistence_confirmed=None):
    return classify(valid_before, valid_after, historical_forest, deviation_sigma,
                    supporting_index_agrees, persistence_confirmed)


class TestClassify(unittest.TestCase):
    def test_missing_observations_before_or_after_are_insufficient(self):
        self.assertEqual(decide(-9.0, valid_before=2), INSUFFICIENT)
        self.assertEqual(decide(-9.0, valid_after=0), INSUFFICIENT)

    def test_non_forest_is_insufficient_not_no_loss(self):
        self.assertEqual(decide(-9.0, historical_forest=False), INSUFFICIENT)

    def test_unknown_deviation_is_insufficient(self):
        self.assertEqual(decide(None), INSUFFICIENT)

    def test_strong_decline_alone_is_only_possible(self):
        self.assertEqual(decide(-5.0), POSSIBLE_LOSS)

    def test_strong_decline_with_persistence_is_likely(self):
        self.assertEqual(decide(-5.0, persistence_confirmed=True), LIKELY_LOSS)

    def test_strong_decline_with_agreeing_index_is_likely(self):
        self.assertEqual(decide(-5.0, supporting_index_agrees=True), LIKELY_LOSS)

    def test_moderate_decline_is_possible(self):
        self.assertEqual(decide(-2.5), POSSIBLE_LOSS)

    def test_strong_greenup_is_no_loss_not_a_loss_class(self):
        self.assertEqual(decide(5.0), NO_LOSS)
        self.assertEqual(decide(5.0, supporting_index_agrees=True), NO_LOSS)

    def test_uncorroborated_extreme_decline_stays_possible(self):
        self.assertEqual(decide(-9.0, persistence_confirmed=False), POSSIBLE_LOSS)

    def test_evidence_gate_beats_a_strong_signal(self):
        self.assertEqual(
            decide(-9.0, valid_after=1, persistence_confirmed=True), INSUFFICIENT
        )

    def test_quiet_pixel_with_adequate_evidence_is_no_loss(self):
        self.assertEqual(decide(-0.4), NO_LOSS)

    def test_boundary_between_weak_and_strong(self):
        self.assertEqual(decide(-2.0), POSSIBLE_LOSS)
        self.assertEqual(decide(-4.0, supporting_index_agrees=True), LIKELY_LOSS)
        self.assertEqual(decide(-3.9, supporting_index_agrees=True), POSSIBLE_LOSS)


class TestExplain(unittest.TestCase):
    """Every reported class must be traceable to one rule in the table."""

    def explain(self, **kwargs):
        args = {"valid_before": 5, "valid_after": 5, "historical_forest": True,
                "deviation_sigma": -0.5, "supporting_index_agrees": False,
                "persistence_confirmed": False}
        args.update(kwargs)
        return classify_explain(**args)

    def test_reason_names_the_rule_that_fired(self):
        self.assertEqual(self.explain(valid_before=1)[1], "R1")
        self.assertEqual(self.explain(historical_forest=False)[1], "R2")
        self.assertEqual(self.explain(deviation_sigma=None)[1], "R3")
        self.assertEqual(self.explain(deviation_sigma=-4.5, persistence_confirmed=True)[1], "R4")
        self.assertEqual(self.explain(deviation_sigma=-2.5)[1], "R5")
        self.assertEqual(self.explain()[1], "R6")

    def test_insufficient_reason_reports_the_actual_counts(self):
        label, rule, reason = self.explain(valid_before=2, valid_after=1)
        self.assertEqual(rule, "R1")
        self.assertIn("2 valid observations before", reason)
        self.assertIn("1 after", reason)

    def test_uncomputable_corroboration_is_not_described_as_disagreement(self):
        label, rule, reason = self.explain(deviation_sigma=-5.0, persistence_confirmed=None)
        self.assertEqual(label, POSSIBLE_LOSS)
        self.assertIn("could not be computed", reason)

    def test_greenup_is_explained_as_greenup(self):
        label, rule, reason = self.explain(deviation_sigma=3.0)
        self.assertEqual(label, NO_LOSS)
        self.assertIn("green-up", reason)

    def test_explain_and_classify_never_disagree(self):
        for sigma in (-5.0, -4.0, -3.0, -2.0, -1.0, 0.0, 1.0):
            for agrees in (True, False, None):
                arguments = dict(valid_before=5, valid_after=5, historical_forest=True,
                                 deviation_sigma=sigma, supporting_index_agrees=agrees,
                                 persistence_confirmed=agrees)
                self.assertEqual(classify(**arguments), classify_explain(**arguments)[0])

if __name__ == "__main__":
    unittest.main()
