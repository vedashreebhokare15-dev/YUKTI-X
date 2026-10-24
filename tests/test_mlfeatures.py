import unittest

from forestguard import config
from forestguard.mlfeatures import FEATURE_NAMES, merge_means, vectorize

COMPLETE = {
    "ndvi_before": 0.71,
    "ndvi_after": 0.58,
    "ndmi_before": 0.44,
    "ndmi_after": 0.31,
    "nbr_before": 0.35,
    "nbr_after": 0.12,
    "ndvi_sigma": -3.1,
    "ndmi_sigma": -2.0,
    "nbr_sigma": -4.2,
    "valid_before": 4,
    "valid_after": 5,
    "ndvi_baseline": 0.68,
}


class TestVectorize(unittest.TestCase):
    def test_row_is_ordered_by_the_declared_feature_names(self):
        row = vectorize(COMPLETE)
        self.assertEqual(len(row), len(FEATURE_NAMES))
        self.assertEqual(row, tuple(COMPLETE[name] for name in FEATURE_NAMES))

    def test_dict_insertion_order_does_not_change_the_row(self):
        shuffled = {name: COMPLETE[name] for name in reversed(FEATURE_NAMES)}
        self.assertEqual(vectorize(shuffled), vectorize(COMPLETE))

    def test_missing_feature_raises_naming_it(self):
        incomplete = dict(COMPLETE)
        del incomplete["nbr_sigma"]
        with self.assertRaises(KeyError) as caught:
            vectorize(incomplete)
        self.assertIn("nbr_sigma", str(caught.exception))

    def test_null_feature_raises_instead_of_becoming_zero(self):
        broken = dict(COMPLETE)
        broken["ndmi_sigma"] = None
        with self.assertRaises(ValueError) as caught:
            vectorize(broken)
        self.assertIn("ndmi_sigma", str(caught.exception))

    def test_non_numeric_feature_raises(self):
        broken = dict(COMPLETE)
        broken["ndvi_before"] = "0.71"
        with self.assertRaises(ValueError):
            vectorize(broken)


def measured(lon, lat, value):
    return {
        "properties": {
            "cell_lon": lon,
            "cell_lat": lat,
            **{band: value for band in config.FEATURE_BANDS.values()},
        }
    }


class TestMergeMeans(unittest.TestCase):
    def test_means_join_onto_the_cell_at_the_same_position(self):
        cells = [{"cell_id": "a", "position": (91.65, 23.58), "stats": {}}]
        merge_means(cells, [measured(91.65, 23.58, 0.42)], config.FEATURE_BANDS)
        self.assertEqual(cells[0]["stats"]["ndvi_after"], 0.42)

    def test_means_returned_in_separate_batches_all_reach_their_cells(self):
        cells = [
            {"cell_id": "a", "position": (91.65, 23.58), "stats": {}},
            {"cell_id": "b", "position": (91.66, 23.58), "stats": {}},
        ]
        merge_means(
            cells,
            [measured(91.66, 23.58, 0.30)] + [measured(91.65, 23.58, 0.70)],
            config.FEATURE_BANDS,
        )
        self.assertEqual(cells[0]["stats"]["ndvi_after"], 0.70)
        self.assertEqual(cells[1]["stats"]["ndvi_after"], 0.30)

    def test_cell_with_no_measurement_stays_unmeasured_for_every_feature(self):
        cells = [{"cell_id": "a", "position": (91.65, 23.58), "stats": {}}]
        merge_means(cells, [], config.FEATURE_BANDS)
        self.assertEqual(set(cells[0]["stats"]), set(FEATURE_NAMES))
        self.assertTrue(all(value is None for value in cells[0]["stats"].values()))

    def test_vectorize_reports_the_unmeasured_cell_instead_of_inventing_zero(self):
        cells = [{"cell_id": "a", "position": (91.65, 23.58), "stats": {}}]
        merge_means(cells, [], config.FEATURE_BANDS)
        with self.assertRaises(ValueError):
            vectorize(cells[0]["stats"])


if __name__ == "__main__":
    unittest.main()
