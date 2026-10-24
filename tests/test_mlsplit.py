import unittest

from forestguard.mlsplit import (
    corner_box,
    cell_box,
    expand_box,
    grid_points,
    overlap,
    points_box,
    spatial_conflicts,
    split_regions,
)

MAHARASHTRA = (77.20, 21.20, 77.50, 21.40)
TRIPURA = (91.20, 23.30, 91.60, 23.60)
ADJACENT = (77.55, 21.20, 77.80, 21.40)


class TestBoxGeometry(unittest.TestCase):
    def test_expand_grows_every_edge(self):
        self.assertEqual(expand_box(MAHARASHTRA, 0.05), (77.15, 21.15, 77.55, 21.45))

    def test_distant_boxes_do_not_overlap(self):
        self.assertFalse(overlap(MAHARASHTRA, TRIPURA))

    def test_edge_touching_boxes_overlap(self):
        self.assertTrue(overlap(MAHARASHTRA, (77.50, 21.20, 78.00, 21.40)))


class TestConflicts(unittest.TestCase):
    def test_distant_train_and_eval_regions_have_no_conflict(self):
        self.assertEqual(spatial_conflicts([MAHARASHTRA], [TRIPURA], 0.05), [])

    def test_buffer_turns_a_near_neighbour_into_a_conflict(self):
        self.assertEqual(len(spatial_conflicts([MAHARASHTRA], [ADJACENT], 0.02)), 0)
        conflicts = spatial_conflicts([MAHARASHTRA], [ADJACENT], 0.05)
        self.assertEqual(conflicts, [(0, 0)])

    def test_conflict_pairs_index_both_sides(self):
        conflicts = spatial_conflicts([MAHARASHTRA, MAHARASHTRA], [ADJACENT], 0.1)
        self.assertEqual(conflicts, [(0, 0), (1, 0)])


class TestSplitRegions(unittest.TestCase):
    def test_train_and_eval_regions_are_disjoint_by_default(self):
        train, eval_ = split_regions(
            {"mh": MAHARASHTRA, "tripura": TRIPURA},
            train_keys=["mh"],
            eval_keys=["tripura"],
        )
        self.assertEqual(list(train), ["mh"])
        self.assertEqual(list(eval_), ["tripura"])

    def test_a_region_in_both_groups_is_rejected(self):
        with self.assertRaises(ValueError):
            split_regions(
                {"mh": MAHARASHTRA}, train_keys=["mh"], eval_keys=["mh"]
            )

    def test_regions_inside_the_buffer_of_a_training_region_are_rejected(self):
        with self.assertRaises(ValueError):
            split_regions(
                {"mh": MAHARASHTRA, "near": ADJACENT},
                train_keys=["mh"],
                eval_keys=["near"],
                buffer_degrees=0.1,
            )


class TestGridPoints(unittest.TestCase):
    def test_points_stay_strictly_inside_the_box(self):
        points = grid_points(MAHARASHTRA, 0.05)
        self.assertTrue(points)
        for lon, lat in points:
            self.assertGreaterEqual(lon, MAHARASHTRA[0])
            self.assertLess(lon, MAHARASHTRA[2])
            self.assertGreaterEqual(lat, MAHARASHTRA[1])
            self.assertLess(lat, MAHARASHTRA[3])

    def test_a_box_wider_than_two_steps_holds_two_rows_and_two_columns(self):
        points = grid_points((0.0, 0.0, 0.2, 0.2), 0.1)
        self.assertEqual(len(points), 4)
        self.assertEqual(points[0], [0.0, 0.0])
        self.assertEqual(points[-1], [0.1, 0.1])

    def test_a_box_smaller_than_the_step_yields_only_its_origin(self):
        self.assertEqual(grid_points((0.0, 0.0, 0.01, 0.01), 0.1), [[0.0, 0.0]])

    def test_longitude_varies_fastest_so_rows_are_readable(self):
        self.assertEqual([point[0] for point in grid_points((0.0, 0.0, 0.2, 0.2), 0.1)],
                         [0.0, 0.1, 0.0, 0.1])

    def test_an_empty_or_inverted_box_is_rejected(self):
        with self.assertRaises(ValueError):
            grid_points((0.2, 0.2, 0.0, 0.0), 0.1)

    def test_a_non_positive_step_is_rejected(self):
        with self.assertRaises(ValueError):
            grid_points(MAHARASHTRA, 0)


class TestCellBox(unittest.TestCase):
    def test_a_ninety_metre_cell_is_a_fraction_of_a_degree(self):
        box = cell_box((77.30, 21.30), 90, latitude=21.30)
        width_lon = box[2] - box[0]
        height_lat = box[3] - box[1]
        self.assertAlmostEqual(height_lat, 90 / 111_320, places=6)
        self.assertGreater(width_lon, height_lat)  # meridians converge poleward
        self.assertAlmostEqual(width_lon, 90 / (111_320 * 0.93198), places=5)

    def test_a_zero_cell_is_the_centre_itself(self):
        self.assertEqual(cell_box((77.30, 21.30), 0, latitude=21.30)[:4],
                         (77.30, 21.30, 77.30, 21.30))

    def test_a_negative_cell_is_rejected(self):
        with self.assertRaises(ValueError):
            cell_box((0.0, 0.0), -10, latitude=0.0)


class TestCornerBox(unittest.TestCase):
    """Both probe scripts need a few square kilometres, not the whole region."""

    RING = [[77.20, 21.20], [77.50, 21.20], [77.50, 21.40], [77.20, 21.40], [77.20, 21.20]]

    def test_the_slice_starts_at_the_south_west_corner(self):
        ring = corner_box(self.RING, 0.03, 0.02)
        self.assertEqual(ring[0], [77.20, 21.20])

    def test_the_slice_is_a_closed_ring_of_the_requested_size(self):
        ring = corner_box(self.RING, 0.03, 0.02)
        self.assertEqual(len(ring), 5)
        self.assertEqual(ring[0], ring[-1])
        self.assertAlmostEqual(max(point[0] for point in ring) - 77.20, 0.03, places=9)
        self.assertAlmostEqual(max(point[1] for point in ring) - 21.20, 0.02, places=9)

    def test_a_slice_larger_than_the_region_is_capped_at_the_region(self):
        ring = corner_box(self.RING, 9.0, 9.0)
        self.assertEqual(ring[2], [77.50, 21.40])

    def test_a_non_positive_slice_is_rejected(self):
        with self.assertRaises(ValueError):
            corner_box(self.RING, 0, 0.02)

    def test_an_origin_moves_the_slice_to_that_corner(self):
        ring = corner_box(self.RING, 0.03, 0.02, origin=(77.30, 21.30))
        self.assertEqual(ring[0], [77.30, 21.30])
        self.assertAlmostEqual(ring[2][0], 77.33, places=9)
        self.assertAlmostEqual(ring[2][1], 21.32, places=9)

    def test_an_origin_too_near_the_edge_is_pulled_back(self):
        ring = corner_box(self.RING, 0.03, 0.02, origin=(77.49, 21.39))
        self.assertEqual(ring[2], [77.50, 21.40])
        self.assertAlmostEqual(ring[0][0], 77.47, places=9)
        self.assertAlmostEqual(ring[0][1], 21.38, places=9)

    def test_an_origin_outside_the_region_is_rejected(self):
        with self.assertRaises(ValueError):
            corner_box(self.RING, 0.03, 0.02, origin=(78.00, 21.30))


class TestPointsBox(unittest.TestCase):
    def test_box_wraps_every_point(self):
        self.assertEqual(
            points_box([[91.65, 23.58], [91.68, 23.61], [91.66, 23.55]]),
            (91.65, 23.55, 91.68, 23.61),
        )

    def test_one_point_gives_a_zero_area_box(self):
        self.assertEqual(points_box([[91.65, 23.58]]), (91.65, 23.58, 91.65, 23.58))

    def test_no_points_is_rejected_rather_than_an_inverted_box(self):
        with self.assertRaises(ValueError):
            points_box([])


if __name__ == "__main__":
    unittest.main()
