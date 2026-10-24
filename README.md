# VanaDrishti (वनदृष्टी) — ForestGuard AI

Season-aware forest-loss detection over **Sentinel-2 optical imagery** in Google Earth Engine,
served by a local Python API and shown in a React control panel, with a RandomForest model that
was trained on one Indian state and scored on a state it never saw.

The repository is named `forestguard-ai`; the product name in the app is **VanaDrishti**
("forest-sight"). This README describes the code as it exists today, and every number in it is
either reproduced by the commands below or read out of `models/model_report.json`.

---

## 1. The problem, and the specific mistake this design avoids

Satellite "deforestation" maps built by differencing two greenness values are wrong in the
tropics for a boring reason: a healthy dry-deciduous forest loses its leaves every winter, so
NDVI in October is far lower than NDVI in February. A two-image difference calls that
deforestation. Clouds and their shadows make it worse — a shadow reads as a dark, low-vegetation
pixel, which is exactly the signature of a clearing.

VanaDrishti does not assert deforestation. It answers one question:

> Is this pixel's greenness deviating from **what this location itself is expected to look like
> in this season**, by more than its own historical spread?

Two mechanisms make that answerable:

1. **Quality screening that keeps the missing-data count.** Scenes are filtered with the
   Copernicus cloud-probability product plus a 3 km buffer around flagged pixels, and a shadow
   test (a pixel whose NIR is below 25% of the scene's mean NIR is a shadow candidate). What
   matters is that masked pixels are *not* filled: every cell also carries `valid_obs`, the number
   of clear observations that actually went into the composite. A cloud-hidden pixel is missing
   evidence, never loss evidence.
2. **A seasonal baseline, expressed in sigmas.** Composites are built from the same calendar
   window across several history years, so the mean and spread of a location's own season become
   the yardstick. The reported deviation is `sigma` distance from that expectation, using
   thresholds of 2.0 sigma (possible) and 4.0 sigma (strong) rather than a fixed NDVI cut.

How the numbers are aggregated, stated exactly: a period composite is the **per-pixel median** of
the scenes that passed the quality screen, with the clear-observation count appended as its own
band — never a mean over masked pixels. The seasonal expectation is the **mean and standard
deviation** of that same index across the matched calendar windows of the history years, so the
denominator in the sigma figure is the location's own year-to-year spread. Window arithmetic lives
in `windows.py` and is constructed so no scene after the "after" window can leak into a baseline.

Everything is computed at **20 m** (NDVI at 10 m, NDMI and NBR resampled from their 20 m bands
with the method stated in `indices.py`), over a 20 m analysis grid.

## 2. Output: four classes, and abstention is one of them

`forestguard/classify.py` holds the authoritative rule table. Every pixel is classified by the
first rule that fires, and `explain()` returns the rule id and a plain-language reason, so a
single point on the map can be interrogated.

| Rule | Condition | Class |
| --- | --- | --- |
| R1 | Clear observations in either period below `MIN_VALID_OBSERVATIONS` (3) | `insufficient_evidence` |
| R2 | No historical forest at this location | `insufficient_evidence` (nothing to lose) |
| R3 | No seasonal expectation available for this location | `insufficient_evidence` |
| R4 | Decline ≥ 4.0 sigma **and** corroborated (persistence confirmed, or a supporting index agrees) | `likely_loss` |
| R5 | Decline ≥ 2.0 sigma, uncorroborated | `possible_loss` |
| R6 | Adequate evidence, no decline of note (includes green-up) | `no_detected_loss` |

An uncorroborated drop — however large — is never promoted to `likely_loss`. If persistence
cannot be computed because later scenes are cloud-covered, `persistence.py` returns *unknown*
instead of guessing "no".

## 3. What is real today, and what is not

Status as of **2026-10-25**. Read this table before demoing; it is the difference between a
working system and a mock-up.

| | State | Evidence |
| --- | --- | --- |
| Decision, labelling, metrics and split logic | **Real, tested** | 219 offline unittest cases pass with no Earth Engine calls and no credentials touched (`python -m unittest discover -s tests -t .`); last re-run 2026-10-25 |
| Earth Engine data access | **Real, working for metadata and reference layers** | Project `vanadrishti` initialises with the local OAuth credential file; the pilot window returned 12 scenes (2024-10-17 … 2024-12-11) with per-scene cloud percentages, and a screened composite over a 0.03 × 0.02° box measured NDVI 0.653, NDMI 0.231, NBR 0.478 at 20 m with 18,596/18,596 pixels holding enough observations |
| Labelled sample tables | **Real** | `data/training_{maharashtra,mizoram,tripura}_2025.json`, sampled from Earth Engine against the Hansen product |
| Trained model + held-out score | **Real, and honestly bad** | `models/model_report.json`; numbers in §5 |
| React app | **Real and buildable** | `npm run build` succeeds; the Model page reads the trained report through `/api/model` |
| PDF reports | **Real generation, sample input** | Vector, paginated, self-reconciling output; the records it prints come from the app's bundled demo dataset |
| **One real whole-region run through the app** | **BLOCKED** | Earth Engine put `vanadrishti` into *restricted mode* (noncommercial compute quota exceeded). A run over the 28.7 km² slice held the connection 40 minutes and returned 0 bytes; shrinking the box did not help, because compute starvation, not area, is binding. See §9 |
| Dashboard, Study Area, Analysis, Results, Reports pages | **Illustrative, labelled** | Map overlays, per-region summary counts and charts come from `frontend/src/data/*`, and every record carries `isDemo: true`. Only the Model page consumes the backend today |

The `Demo` label stays on sample screens until the real number behind it exists. Retiring a label
requires producing the measurement, not deleting the word.

## 4. Study regions

All geometry lives in `forestguard/config.py`. Areas are computed from the boxes, not typed in.

| Key | Landscape | Area | Role |
| --- | --- | --- | --- |
| `pilot` | Melghat — Satpura dry deciduous forest, Maharashtra | 688.1 km² | pilot; documented logging and mining pressure, strong dry-season leaf-drop |
| `pilot_slice` | Same landscape, a slice of it | 28.7 km² | the area at which a whole run could be forced in one request before restricted mode |
| `held_out` / `tripura` | Tripura plantation and jhum landscape, Northeast India | 1014.8 km² | evaluation; different forest type, monsoon cloud regime, no shared training area |
| `mizoram` | Mizoram tropical moist forest, Northeast India | 28.2 km² | training, sampled at 300 m stride |
| `tripura` sample box (in `ML_REGIONS`) | same landscape, a 28.2 km² interior box | 28.2 km² | the cells behind the evaluation table |

Both `ML_REGIONS` boxes are 0.05° × 0.05° and therefore the same size — the split is by state and
landscape, not by area.

`/api/regions` reports these areas and a `forcible` flag against a 60 km² ceiling — measured on
2026-10-25, a single composite over the 688.1 km² pilot box did not return, so larger boxes are
offered as geography rather than as something the app can claim to have run. That flag is
**advisory metadata for the UI**: what the server actually refuses, before making any Earth Engine
call, is an unknown region key, a window longer than 120 days or in the wrong format,
`history_years` outside 3–6, a non-boolean flag, and an oversized request body.

Region choice is evidence-driven, not decorative. Sampling the reference layer over the
Maharashtra pilot box put 485 of 500 candidate cells below the canopy gate with **zero** loss
labels, so that box cannot teach a loss class; the same sampling over Mizoram yielded 11 loss and
247 stable cells.

## 5. The model

**Labels.** `UMD/hansen/global_forest_change_2025_v1_13` — 30.92 m global forest-change product,
`treecover2000` plus `lossyear`. A 90 m training cell is labelled `loss` when a majority of its
reference pixels carry a loss year inside the window (2021–2025 for the Northeast boxes), with
cells that are ambiguous or under-covered **abstained rather than guessed**. A canopy gate of 30%
keeps non-forest out of training. This is a 30 m reference product: it supervises agreement with
that product, and is not verified legal deforestation and not ground truth.

**Features** (`forestguard/mlfeatures.py`, fixed order of 12):
`ndvi_before`, `ndvi_after`, `ndmi_before`, `ndmi_after`, `nbr_before`, `nbr_after`,
`ndvi_sigma`, `ndmi_sigma`, `nbr_sigma`, `valid_before`, `valid_after`, `ndvi_baseline`.
Note that the observation counts travel with the indices — the model can learn that low-evidence
cells behave differently, instead of being fed composites as if they were all equally trustworthy.

**Learner.** `RandomForestClassifier`, 300 trees, `max_depth=8`, `random_state=7`, all from
`config.py`.

**Split.** Train on Mizoram (94 cells: 11 loss, 83 stable), evaluate on Tripura (136 cells: 29
loss, 107 stable) — different states, boxes roughly 700 km apart. The trainer refuses the split
outright when both tables carry the same region key, and `mlsplit.py` provides the tested box
overlap and buffer helpers (`overlap`, `spatial_conflicts`, `split_regions`) that a caller can use
to check disjointness; the trainer itself does not call them, so cross-state separation here rests
on the two declared boxes in `config.py`.

**Measured result on the held-out state** (`models/model_report.json`, generated 2026-10-24):

| | value |
| --- | --- |
| Confusion | TP 0 · FP 2 · FN 29 · TN 105 |
| Precision | 0 of 2 predicted losses — 0.0%, 95% Wilson interval 0.0% to 65.8% |
| Recall | 0 of 29 true losses — 0.0%, 95% interval 0.0% to 11.7% |
| False alarm rate | 2 of 107 stable cells — 1.9%, 95% interval 0.5% to 6.6% |
| F1 | not defined (zero recall) |
| Loss prevalence in the eval table | 21.3% |
| Accuracy implied by the confusion matrix | 105/136 = 77.2%, which is **below** the 107/136 = 78.7% an always-"no loss" predictor would score |

**What that means, stated plainly.** The model learned Mizoram's spectral signature of recent loss
and did not transfer it to Tripura across a 700 km gap in forest type and cloud regime, with only
11 positive training cells to learn from. This is a cross-state domain-shift result on a tiny
positive class, not a mislabelled join — and it is the number the app shows. No accuracy figure
may be described as validated until a third region is scored with enough positives on both sides.

**Guards that refuse to run.** The statistical guard lives in `mlmodel.train_model` and is
unit-tested: it raises when any class holds fewer than `min_rows_per_class` rows. The provenance
guards live in `scripts/train_reference_model.py` and refuse before fitting — training and
evaluation tables carrying the same region key, a table whose `feature_names` do not match this
build's `FEATURE_BANDS`, and a table with no labelled rows. The API answers 404 with the exact
command that produces a report when `models/model_report.json` is absent, and 500 when it is
present but unreadable, rather than inventing numbers. The shipped Mizoram table has 11 loss rows,
so the script's default of 40 refuses it and reproducing §5 needs `--min-rows-per-class 10` — a
threshold that should be reported next to the wide intervals it produces, not hidden.

## 6. Quick start

Verified toolchain: Python 3.11.9, Node v22.18.0, npm 10.9.3, Git 2.50.1.

```bash
# 1. virtualenv — keep it OUTSIDE OneDrive, the sync client fights a venv
python -m venv "$HOME/venvs/forestguard"
"$HOME/venvs/forestguard/Scripts/python" -m pip install -r requirements.txt

# 2. one-time Earth Engine authorization (opens a Google sign-in page)
"$HOME/venvs/forestguard/Scripts/python" -c "import ee; ee.Authenticate()"

# 3. tests — no Earth Engine access needed, no credentials touched
"$HOME/venvs/forestguard/Scripts/python" -m unittest discover -s tests -t .
# → Ran 219 tests ... OK

# 4. build the React app
cd frontend && npm install && npm run build && cd ..

# 5. serve the app and the API from one origin
"$HOME/venvs/forestguard/Scripts/python" scripts/serve.py --project vanadrishti --port 8777
```

Open `http://127.0.0.1:8777`. Without `--project` the server still starts and the app still
works, but real runs are disabled and the server says so — it never substitutes simulation data
into a field that claims to be measured.

For frontend development with hot reload, run `npm run dev` (port 5173) alongside the API server;
Vite proxies `/api` to `http://127.0.0.1:8777`, or to `$VITE_API_BASE_URL` if you set it.

**Access diagnosis**, when something is broken, is one command and costs one cheap request:

```bash
"$HOME/venvs/forestguard/Scripts/python" scripts/diagnose_access.py --project vanadrishti
"$HOME/venvs/forestguard/Scripts/python" scripts/verify_access.py  --project vanadrishti
```

`diagnose_access.py` names the failing link among credential file, token refresh, project binding
and initialization. `verify_access.py` reports scene counts, acquisition dates, cloud percentages
and the fraction of pixels surviving screening.

**Credentials never go in the repository, a chat, or a command line argument that gets pasted.**
Earth Engine here uses the OAuth credential file plus a *project ID* — there is no API key
involved, and a service-account JSON is not needed.

## 7. Reproducing the numbers in §5

```bash
# 0. does the index graph reduce, and does the reference layer answer at all?
"$HOME/venvs/forestguard/Scripts/python" scripts/verify_reference.py --project vanadrishti --small

# 1. sample labelled cells — one region per table, 90 m cells on a 300 m stride
"$HOME/venvs/forestguard/Scripts/python" scripts/build_training_set.py \
    --project vanadrishti --region mizoram --stride 300 --batch-size 60 \
    --out data/training_mizoram_2025.json

# 2. train on one state, score on a state it never saw
"$HOME/venvs/forestguard/Scripts/python" scripts/train_reference_model.py \
    --train data/training_mizoram_2025.json \
    --eval  data/training_tripura_2025.json \
    --min-rows-per-class 10
```

Step 2 writes `models/forest_loss_rf.joblib` and `models/model_report.json`, which is the file
`/api/model` and the Model page read. Step 1 is the slow one: **measured ≈ 8 minutes per 60-cell
batch**, and two concurrent builds both time out, so run one region at a time and expect the
requests to fail entirely while the project is in restricted mode. Nothing in step 2 needs Earth
Engine — the committed `data/` tables are enough to re-derive every figure in §5 offline.

## 8. HTTP API

`forestguard/server.py` is a stdlib `ThreadingHTTPServer` — no framework, no database — that also
serves the built bundle, so a long Earth Engine run cannot freeze the UI. Extension-less paths
fall back to `index.html` so refreshing a React route works; a genuinely missing asset still
returns 404 rather than HTML.

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/api/health` | `{ earth_engine_ready: bool }` — whether a pipeline was constructed at startup |
| GET | `/api/regions` | region keys, names, why-chosen, bounds, AOI rings, computed `area_km2`, `forcible`, default windows |
| GET | `/api/model` | the full trained report: model config, train and eval provenance, metrics with Wilson intervals, feature importances, per-cell results, caveats. Read from disk each request, so retraining needs no restart |
| POST | `/api/run` | a whole-region run against Earth Engine, with provenance; validated by `runrequest.py` first, so a bad window is refused before any call |
| POST | `/api/inspect` | `{ run_id, lon, lat }` → the class, rule id, index values, sigma and observation count at one point |

## 9. Current blockers, stated as measured

- **Restricted mode.** Since 2026-10-25 the Cloud project has been over its noncommercial compute quota.
  Metadata is fine (`size()` ≈ 1.6 s; one scene screened over the full 688.1 km² pilot box ≈ 2.0 s),
  but forcing a single Sentinel-2 composite over that box had not returned after 14 minutes, and a
  whole run over the 28.7 km² slice returned nothing after 40 minutes (curl exit 28). Slicing
  smaller is not the lever. Either the quota recovers or the project is upgraded.
- **The route that still works under throttling** is `getMapId` tile layers: Earth Engine renders
  each tile for the viewport on demand, so a map shows real pixels without paying for the
  whole-region `reduceRegion` histogram that run tables require. Not built yet.
- **Batching is mandatory for vector reductions.** Measured cost is ≈ 8 minutes per 60-cell
  training batch, and two concurrent builds both time out — run them one at a time.
- **The model needs more positives.** Widening the Mizoram box is the cheapest path to a
  cross-state score that is not dominated by 11 cells.
- **Only the Model page is wired to the backend.** §3's remaining `isDemo` screens become real by
  consuming `/api/regions` and `/api/run`, field by field, with anything unmeasured shown as
  *not measured*.
- **"Early warning" is a title, not a feature yet.** The UI is named for forest-loss *early
  warning*, but nothing here predicts loss before it happens: the pipeline detects a change that
  already occurred between two matched seasons. `metrics.detection_delay_days` exists and is
  unit-tested, but no delay figure is reported, because reporting one requires a real run whose
  first clear observation post-loss is known — and the first bullet of this section says that run does not
  currently finish.

## 10. Layout

```
forestguard/config.py        AOIs, thresholds, band groups, model hyperparameters
forestguard/s2.py            Sentinel-2 loading, cloud + shadow screening, valid-observation count
forestguard/indices.py       NDVI / NDMI / NBR with explicit band-resolution handling
forestguard/classify.py      the authoritative rule table; classify() and explain()
forestguard/baseline.py      two-period and seasonal evidence assembled from the above
forestguard/seasonal.py      reference implementation of the seasonal expectation
forestguard/persistence.py   decline persistence + supporting-index corroboration; unknown on clouds
forestguard/windows.py       matched-season window arithmetic, leakage-free by construction
forestguard/dataquality.py   empty-window and coverage arithmetic over fetched numbers
forestguard/change.py        the Earth Engine classification graph: rule_code and class_code
forestguard/metrics.py       precision / recall / F1 / false alarm / abstention / coverage /
                             detection delay / Wilson intervals
forestguard/reflabels.py     30 m reference pixels -> cell labels, ambiguous cells abstained
forestguard/mlfeatures.py    fixed feature order and the cell -> row join
forestguard/mlsplit.py       box geometry, sample grids, overlap + buffer conflict helpers
forestguard/mlmodel.py       RandomForest fit, save/load, scoring through metrics.py
forestguard/realrun.py       a whole pilot run against Earth Engine, with provenance
forestguard/runrequest.py    request validation + the region metadata the API serves
forestguard/results.py       histogram -> class areas, and one-point explanations
forestguard/modelreport.py   the on-disk report the Model page reads
forestguard/server.py        stdlib HTTP API + static app; never falls back to demo data
scripts/                     access diagnosis, region location, training-set builder, trainer, server
data/                        labelled sample tables (~180 KB, versioned on purpose)
models/                      trained bundle + model report (~600 KB, versioned on purpose)
docs/                        decision records: phase1 access, phase2 pilot + pipeline audit,
                             reference sampling protocol
tests/                       219 stdlib unittest cases, no Earth Engine calls required
frontend/                    React 18 + Vite 6 control panel (see frontend/README.md)
  src/pages/                 Dashboard, StudyArea, Analysis, ModelReport, Results, Reports, Settings
  src/services/api.js        the single seam to the backend above
  src/data/                  bundled illustrative dataset, every record isDemo: true
  src/utils/reportPdf.js     paginated vector PDF reports, computed from the records they print
```

`data/` and `models/` are committed deliberately: without them, nobody cloning this repository can
reproduce the Model page.

## 11. Rules every contributor — human or AI — must follow

1. **Sentinel-2 optical only.** No Sentinel-1, no SAR, no radar fallback for clouds.
2. A cloud-hidden pixel is missing evidence, never loss evidence. Do not fill masked pixels.
3. Compute NDMI/NBR at 20 m, or resample with the method and the reason stated in writing.
4. 30 m reference layers are not 10 m ground truth, and are not verified legality.
5. No numeric score may be presented as a probability without calibration. A RandomForest vote is
   a class, not a confidence.
6. Train and evaluate on different states, with spatial buffers against leakage.
7. **No number is called accurate, validated or verified without a measured comparison.** Earth
   Engine graph code cannot be proven offline — `tests/` never imports `ee`, so every `s2`,
   `indices`, `change` and `realrun` defect found so far surfaced on the first remote call.
   Changes to those modules must be executed against Earth Engine before being described as fixed.
8. Simulation is allowed only as an explicitly labelled mode. Labels come off when the real
   measurement replaces them, never before.
9. Never paste a refresh token, API key or service-account JSON into a chat or a commit. Anything
   already pasted is treated as compromised and rotated.

## 12. Third-party code

`../forest-monitoring-gee-app` is a separate repository that predates this plan. It is not a
dependency, and nothing here imports it.
