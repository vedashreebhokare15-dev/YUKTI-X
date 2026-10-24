import unittest

from forestguard.mlfeatures import FEATURE_NAMES, build_dataset
from forestguard.reflabels import LOSS, NO_LOSS

FULL_STATS = {name: 0.5 for name in FEATURE_NAMES}
LOSS_POINTS = [{"lossyear": 23, "treecover": 70}] * 9 + [{"lossyear": 0, "treecover": 70}]
STABLE_POINTS = [{"lossyear": 0, "treecover": 70}] * 10


class TestBuildDataset(unittest.TestCase):
    def test_a_forested_cell_with_reference_loss_becomes_a_loss_row(self):
        result = build_dataset(
            [{"cell_id": "a", "stats": FULL_STATS, "points": LOSS_POINTS}],
            loss_window=(23, 23),
        )
        self.assertEqual(result["labels"], [LOSS])
        self.assertEqual(len(result["rows"][0]), len(FEATURE_NAMES))
        self.assertEqual([item["cell_id"] for item in result["kept"]], ["a"])

    def test_a_stable_cell_becomes_a_no_loss_row(self):
        result = build_dataset(
            [{"cell_id": "b", "stats": FULL_STATS, "points": STABLE_POINTS}],
            loss_window=(23, 23),
        )
        self.assertEqual(result["labels"], [NO_LOSS])

    def test_an_ambiguous_cell_is_abstained_and_carries_its_reason(self):
        points = [{"lossyear": 23, "treecover": 70}] * 5 + [{"lossyear": 0, "treecover": 70}] * 5
        result = build_dataset(
            [{"cell_id": "c", "stats": FULL_STATS, "points": points}], loss_window=(23, 23)
        )
        self.assertEqual(result["rows"], [])
        self.assertEqual(result["abstained"][0]["cell_id"], "c")
        self.assertIn("ambiguous", result["abstained"][0]["reason"])

    def test_a_cell_without_enough_reference_evidence_is_abstained_not_guessed(self):
        result = build_dataset(
            [{"cell_id": "d", "stats": FULL_STATS, "points": [{"lossyear": 23, "treecover": 70}]}],
            loss_window=(23, 23),
            min_reference_pixels=4,
        )
        self.assertEqual(result["labels"], [])
        self.assertIn("below", result["abstained"][0]["reason"])

    def test_a_cell_with_missing_features_is_dropped_and_named(self):
        partial = dict(FULL_STATS)
        del partial["nbr_sigma"]
        result = build_dataset(
            [{"cell_id": "e", "stats": partial, "points": LOSS_POINTS}], loss_window=(23, 23)
        )
        self.assertEqual(result["rows"], [])
        self.assertEqual(result["dropped"][0]["cell_id"], "e")
        self.assertIn("nbr_sigma", result["dropped"][0]["reason"])

    def test_a_cell_can_arrive_with_reference_counts_already_computed(self):
        result = build_dataset(
            [{"cell_id": "i", "stats": FULL_STATS,
              "counts": {"loss_pixels": 8, "stable_pixels": 1, "unknown_pixels": 0}}]
        )
        self.assertEqual(result["labels"], [LOSS])

    def test_thin_canopy_is_abstained_even_when_the_reference_shows_loss(self):
        result = build_dataset(
            [{"cell_id": "j", "stats": FULL_STATS,
              "counts": {"loss_pixels": 8, "stable_pixels": 1, "unknown_pixels": 0},
              "forest_cover": 8}],
            min_tree_cover=30,
        )
        self.assertEqual(result["rows"], [])
        self.assertIn("canopy", result["abstained"][0]["reason"])

    def test_unmeasured_canopy_is_abstained_too(self):
        result = build_dataset(
            [{"cell_id": "k", "stats": FULL_STATS,
              "counts": {"loss_pixels": 8, "stable_pixels": 1, "unknown_pixels": 0},
              "forest_cover": None}],
            min_tree_cover=30,
        )
        self.assertEqual(result["labels"], [])

    def test_kept_and_dropped_counts_are_reported_together(self):
        cells = [
            {"cell_id": "f", "stats": FULL_STATS, "points": LOSS_POINTS},
            {"cell_id": "g", "stats": FULL_STATS, "points": STABLE_POINTS},
            {"cell_id": "h", "stats": FULL_STATS, "points": []},
        ]
        result = build_dataset(cells, loss_window=(23, 23))
        self.assertEqual(len(result["kept"]), 2)
        self.assertEqual(len(result["abstained"]), 1)
        self.assertEqual(result["summary"], {"loss": 1, "no_loss": 1, "abstained": 1, "dropped": 0})


if __name__ == "__main__":
    unittest.main()
