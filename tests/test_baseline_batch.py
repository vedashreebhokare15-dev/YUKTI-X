"""Tests for building several seasonal baselines from one composite per season.

`baseline.seasonal_baseline` takes a single index, so a caller that wants NDVI, NDMI
and NBR asks for three full Sentinel-2 composites per history season. On the pilot
region that is 12 composites where 4 carry the same information, and a real run does
not finish inside the Earth Engine timeout. These tests pin the number of composites,
which is the thing that decides whether a run completes.

The Earth Engine objects are recorded stubs: no number here is a measurement and no
pixel is touched. What is verified is which calls the module makes.
"""

import unittest

from forestguard import baseline, config, windows

INDICES = ("NDVI", "NDMI", "NBR")


class Chain:
    """A stand-in for an ee object: every method call is recorded and chainable."""

    def __init__(self, log, name):
        self.log = log
        self.name = name

    def __getattr__(self, attr):
        def method(*args, **kwargs):
            self.log.append(f"{self.name}.{attr}({', '.join(repr(a) for a in args)})")
            return Chain(self.log, f"{self.name}.{attr}")
        return method


class FakeEarthEngine:
    """Only the constructors `seasonal_baselines` reaches for."""

    def __init__(self, log):
        self.log = log

    def ImageCollection(self, images):
        self.log.append(f"ImageCollection(count={len(images)})")
        return Chain(self.log, "stack")

    @property
    def Reducer(self):
        return Chain(self.log, "Reducer")


class TestSeasonalBaselines(unittest.TestCase):
    def setUp(self):
        self.log = []
        self.periods = []
        self._real_ee = baseline.ee
        self._real_period_evidence = baseline.period_evidence
        baseline.ee = FakeEarthEngine(self.log)
        baseline.period_evidence = self.record_period_evidence

    def record_period_evidence(self, aoi, start, end, use_cloud_probability=False):
        self.periods.append((start, end))
        return Chain(self.log, f"season[{start}]")

    def tearDown(self):
        baseline.ee = self._real_ee
        baseline.period_evidence = self._real_period_evidence

    def build(self, history_years=4):
        return baseline.seasonal_baselines(
            config.PILOT["aoi"], config.PILOT["after"], history_years, INDICES,
            use_cloud_probability=True,
        )

    def test_three_indices_use_one_composite_per_season(self):
        result = self.build()
        self.assertEqual(len(self.periods), 4,
                         f"4 history seasons must build 4 composites, built "
                         f"{len(self.periods)}")
        self.assertEqual(sorted(result), sorted(INDICES))

    def test_each_index_is_selected_from_the_shared_season_images(self):
        self.build(history_years=3)
        selections = [entry for entry in self.log if ".select(" in entry]
        for index in INDICES:
            matched = [entry for entry in selections
                       if entry.startswith("season[") and f"select('{index}')" in entry]
            self.assertEqual(len(matched), 3,
                             f"{index} should be selected once per season, saw "
                             f"{len(matched)}: {matched}")

    def test_windows_are_the_prior_seasons_only(self):
        self.build()
        expected = [(start, end) for _, start, end in
                    windows.history_windows(config.PILOT["after"][0],
                                            config.PILOT["after"][1], 4)]
        self.assertEqual(self.periods, expected)


if __name__ == "__main__":
    unittest.main()
