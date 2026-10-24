# Phase 2 - pipeline audit and hardening

Audited item by item against the Phase 2 checklist. Every claim below is either
"checked in code and covered by an offline test" or "read and reasoned about, but
unexercised because Earth Engine access does not exist yet". Nothing in this file
says a satellite was observed.

## What could and could not be verified

The test suite runs with the system Python and no Earth Engine package installed:
`python -m unittest discover -s tests` -> **79 tests, OK**.

That is possible because the decision logic (`classify`, `seasonal`, `persistence`,
`metrics`, `windows`, `dataquality`) deliberately never imports `ee`.

The important limit found during this audit: `s2`, `indices` and `baseline` cannot
even be *constructed* without a live Earth Engine session. Building any `ee` object
calls `ApiFunction.initialize()`, which fetches the algorithm catalogue, which needs
a registered project. Verified locally:

```
ee.Geometry.Polygon(...) -> EEException: Earth Engine client library not
initialized. See http://goo.gle/ee-auth.
```

So no raster-arithmetic path in this repository has ever executed. Reviewing it is
not the same as running it, and it stays labelled unexercised until Phase 3.

## s2.py

| Checklist item | Status |
| --- | --- |
| Sentinel-2 Surface Reflectance Harmonized collection | `COPERNICUS/S2_SR_HARMONIZED` in config, used by `load()` |
| Cloud probability matching | `ee.Join.saveFirst` on `system:index`, no time tolerance |
| QA60 and probability masking | opaque bit 10, cirrus bit 11, probability >= 60 |
| Shadow handling and limits | 3 km cloud buffer intersected with dark-NIR heuristic; a heuristic, not a shadow product |
| Edge masks | pixels outside a scene footprint stay masked and never enter `valid_obs` |
| Band names and scales | fixed order from `config.bands_to_load()`; QA60 stays a 60 m mask |
| Temporal composite | per-pixel median of scenes that passed the screen |
| Per-pixel valid observation counts | `valid_obs` band, sum of `selfMask()`ed `valid` |
| Mask preservation, no filling | no fill step exists; `masked_pixels_are_not_filled` is set as provenance |
| Empty collection safety | **fixed this phase**, see defect 1 |
| Missing cloud-probability matches | **fixed this phase**, see defect 2 |

QA60 caveat recorded in `config.QA60_NOTE`: the band exists for every scene in the
Harmonized collection, but its cloud and cirrus flags behave differently across
processing baselines, so QA60 alone is treated as a coarse screen and cloud
probability is preferred where a matching scene exists.

QA60 is native 60 m. It is used as a mask that Earth Engine resamples onto each
band's own grid. Reflectance is never resampled to 60 m, and no 20 m band is ever
presented at 10 m.

### Defect 1 - an empty window crashed the composite

`ee.Reducer` applied to an empty `ImageCollection` raises. Before this phase a
caller had nothing to catch, so a date window with no scene inside it produced an
error mid-run - and any caller that swallowed that error would render a blank map
that reads exactly like "no loss found".

Fix: the window is judged before compositing. `s2.scene_counts()` returns the
deferred (scenes found, scenes surviving the probability join) pair, and
`dataquality.assess_window()` turns those numbers into `empty`,
`no_screenable_scenes`, `thin` or `ok`, with `reportable=False` on the first two.
Covered by `tests/test_dataquality.py`.

### Defect 2 - an unmatched cloud-probability scene was a hard failure

`ee.Image(image.get("cloud_prob"))` on a scene with no joined match receives a null
property and raises when the band is read. The probability collection does not
cover every Sentinel-2 date, so this was guaranteed to happen in some window.

Fix: `load(..., use_cloud_probability=True)` now filters to joined scenes
(`ee.Filter.notNull(["cloud_prob"])`) before attaching the band, and the run reports
how many scenes were lost. Chosen over the alternative of keeping unmatched scenes
and screening them by a weaker rule than their neighbours: mixing two screening
regimes inside one median composite makes the resulting number uninterpretable.
The honest cost is fewer observations, which the coverage report shows.

### Defect 3 - the shadow threshold was computed from the wrong area

`quality_screen()` averaged near-infrared over `image.geometry()`, the full 109 km
scene. A cloudy half of the tile moved the "dark" threshold for the study area, and
the reduction cost far more pixels than the study area needs.

Fix: the mean is taken over the AOI geometry, and the AOI is now an explicit
parameter of `quality_screen()`.

### Defect 4 - no provenance on the composite

The Phase 9 map must state what produced a pixel. `composite()` now sets the study
period, dataset, probability threshold, buffer distance, aggregation wording and
the no-fill guarantee as image properties.

## indices.py

| Checklist item | Status |
| --- | --- |
| NDVI | 10 m only, `(B8-B4)/(B8+B4)` |
| NDMI and NBR | computed at 20 m: B8 is aggregated with `reduceResolution(mean)` before meeting B11/B12 |
| Native resolution respected | no 20 m result is ever reported at 10 m; each carries `nominal_resolution_m` and `source_bands` metadata |
| Scaling | reflectance divided by 10000 before the ratio |
| Masking | a ratio is masked where either term is masked, and where the denominator is within `1e-6` of zero |

A near-zero denominator is masked rather than clamped. The consequence is honest:
that pixel becomes evidence-limited instead of taking on an extreme index value
that would look like a dramatic change.

## classify.py

One authoritative rule table remains, and `classify()` is now a thin wrapper over
`explain()` so the rules are expressed exactly once. `explain()` returns
`(class, rule_id, reason)`, which is what Phase 5 needs to say why a pixel got its
class.

| Checklist item | Status |
| --- | --- |
| Positive change vs no change vs insufficient evidence | R1-R3 gate evidence, R6 owns "no decline of note, including green-up" |
| Thresholds configurable | `weak_sigma`, `strong_sigma`, `min_valid_observations` default to `config` constants, no longer literal numbers in the signature |
| Unknown corroboration | `persistence_confirmed=None` and `supporting_index_agrees=None` mean "could not compute". They cannot promote a pixel to likely loss, and the reason text says so instead of implying a "no" |
| Area aggregation over valid areas only | `dataquality.coverage_from_histogram()` keeps unobserved pixels separate from insufficient pixels |

Tested behaviour worth naming, because it is the whole point of the project: a
normal dry-season leaf drop against a matched-season baseline is `no_detected_loss`,
while the same drop with no seasonal history is `insufficient_evidence`.

## metrics.py

| Checklist item | Status |
| --- | --- |
| Precision, recall, F1, false-positive rate | computed from the confusion counts only |
| Undefined metrics | return `None`, never 0.0 - an empty denominator is not a perfect score |
| Insufficient evidence not counted as negative | `INSUFFICIENT` becomes an abstention and leaves every rate denominator |
| Unknown class labels | counted as `invalid` and surfaced, not silently scored |
| Valid-area coverage | `valid_area_coverage = scored / total` |
| Detection delay | median lag, early detections stay negative, `None` with no observations |
| Uncertainty intervals | added: `wilson_interval(successes, total)` for rates estimated from a sample table |

## baseline.py and config.py

| Checklist item | Status |
| --- | --- |
| Seasonal windows | moved to `windows.py`: pure, tested, ISO-validated, `filterDate`-exclusive end, 29 February clamped so a window never collapses to empty |
| Historical reference years | `history_windows()` walks strictly backwards from the tested period, so the current season is never in its own baseline |
| Thresholds | `WEAK_SIGMA`, `STRONG_SIGMA`, `MIN_VALID_OBSERVATIONS`, `MIN_BASELINE_YEARS` live in config and are read by classify, persistence, seasonal, baseline and dataquality |
| Minimum valid observations | enforced twice and consistently: per period in R1, per pixel in `require_observed()` |
| Baseline reliability gate added | the Earth Engine path previously returned a mean and spread from one or two seasons. `seasonal_baseline()` now masks pixels with fewer than `MIN_BASELINE_YEARS` contributing seasons and returns the per-pixel season count, so the raster path agrees with the tested pure path in `seasonal.expected_seasonal()` |

That last row was the most consequential audit finding: without it, the untested
Earth Engine branch could issue a confident seasonal "deviation" from two years of
history, while the tested reference implementation refused to. Same project, two
answers, and only one of them checked.

## What remains unverified

- No line of `s2`, `indices` or `baseline` has executed against Earth Engine.
- Whether `COPERNICUS/S2_CLOUD_PROBABILITY` covers the pilot windows, and how many
  scenes a window loses to the join, are numbers Phase 3 must measure.
- The shadow heuristic has never been compared against a known shadowed scene.
- The AOI boxes are still coordinate rectangles, not forest boundaries.
