# ForestGuard AI

AI-based, season-aware forest loss detection in India using Sentinel-2 optical imagery
in Google Earth Engine.

Two core techniques: cloud/shadow masking with temporal compositing that preserves
missing-data information, and seasonal baseline comparison that flags anomalous
deviation instead of asserting deforestation.

## Current status (2026-10-24)

App name: **Vanadristi (वनदृष्टी)**. Repository name: ForestGuard AI.

| Capability | State |
| --- | --- |
| Google OAuth from this machine | verified working (`~/.config/earthengine/credentials` written by `ee.Authenticate()`, token refresh succeeds) |
| Earth Engine project bound to the account | **working** - project `vanadrishti` initializes and answers real requests |
| Satellite data fetched | yes. First measurements: the pilot window returned 12 scenes (2024-10-17 .. 2024-12-11) with per-scene cloud percentages; over a 0.03 x 0.02 degree box the screened composite reduced to NDVI 0.653, NDMI 0.231, NBR 0.478 at 20 m, and 18,596 of 18,596 counted pixels held sufficient observations. Map tiles are served from Earth Engine through `getMapId` |
| Decision and scoring logic | 174 unit tests pass offline |
| Phase 2 pipeline audit | done and written up in `docs/phase2-pipeline-audit.md`; four real defects fixed |
| Earth Engine code paths (`s2`, `indices`, `baseline`, `change`) | executed against the service. Three API-version defects found and fixed by running them: the kernel object form, the 512-pixel kernel limit, and composites arriving with an abstract projection that `reduceResolution` refuses |
| Reference labels | `UMD/hansen/global_forest_change_2025_v1_13` (30.92 m, loss years 2001-2025) opens and samples. It is a 30 m global product, so it supervises 30 m-scale agreement only - never verified legal deforestation |
| Model | RandomForest code and honest guards are in place and unit-tested; training-table sampling and any score derived from it are reported by the runs in `docs/`, not asserted here |
| Validation against reference data | no accuracy figure exists yet; nothing may be described as accurate until a held-out region is actually scored |

## Environment

- Python 3.11.9 (`python` on PATH). Keep the virtualenv **outside** OneDrive:
  `python -m venv "$HOME/venvs/forestguard"`
- `pip install -r requirements.txt`
- Node 22.18.0 / npm 10.9.3, Git 2.50.1 - frontend work is deferred to Phase 12.
- Tests: `python -m unittest discover -s tests` - 174 tests. The ones that cover the
  decision, labelling and model rules need no Earth Engine calls.
- This folder became a git repository during Phase 2; each phase milestone gets a
  checkpoint commit.

## One-time authorization

```bash
"$HOME/venvs/forestguard/Scripts/python" -c "import ee; ee.Authenticate()"
```

Opens a Google sign-in page in your default browser. Never paste the resulting
token, an API key, or a service-account JSON into a chat or into this repository.

## Verify data access

```bash
"$HOME/venvs/forestguard/Scripts/python" scripts/diagnose_access.py --project YOUR_PROJECT_ID
"$HOME/venvs/forestguard/Scripts/python" scripts/verify_access.py  --project YOUR_PROJECT_ID
```

`diagnose_access.py` says which of the four checks failed - credential file, token
refresh, project binding, initialization - and then makes one cheap real Sentinel-2
request. `verify_access.py` reports scene counts, acquisition dates, cloud
percentages and the fraction of pixels that survive quality screening.

## Model path

```bash
# 1. does the index graph reduce, and does the reference layer answer?
"$HOME/venvs/forestguard/Scripts/python" scripts/verify_reference.py --project vanadrishti --small

# 2. sample labelled cells (one region per table)
"$HOME/venvs/forestguard/Scripts/python" scripts/build_training_set.py \
    --project vanadrishti --region maharashtra --stride 100 --limit 0

# 3. train on one state, score on another
"$HOME/venvs/forestguard/Scripts/python" scripts/train_reference_model.py \
    --train data/training_maharashtra_2025.json \
    --eval data/training_tripura_2025.json
```

Step 3 refuses to run when both tables come from the same region, when a class has
too few labelled cells, or when a table's feature layout does not match the current
`mlfeatures.FEATURE_NAMES`. Scores are printed with Wilson intervals because a few
hundred reference points cannot separate 0.75 from 0.87.

## Layout

```
forestguard/config.py     pilot and held-out AOIs, thresholds, band groups
forestguard/s2.py         Sentinel-2 loading, cloud + shadow screening, valid-observation counting
forestguard/indices.py    NDVI / NDMI / NBR with explicit band-resolution handling
forestguard/classify.py   the authoritative rule table; classify() and explain()
forestguard/baseline.py   two-period and seasonal evidence assembled from the above
forestguard/metrics.py    precision / recall / F1 / false-positive rate / abstention /
                          coverage / detection delay / Wilson intervals
forestguard/seasonal.py   reference implementation of the seasonal expectation
forestguard/persistence.py decline-persistence and supporting-index corroboration,
                          returning unknown when later scenes are cloud-covered
forestguard/windows.py    matched-season window arithmetic, leakage-free by construction
forestguard/dataquality.py empty-window and coverage arithmetic over fetched numbers
forestguard/change.py     the Earth Engine classification graph: rule_code and class_code
forestguard/realrun.py    a whole pilot run against Earth Engine, with provenance
forestguard/runrequest.py request validation, so a bad window is refused before any call
forestguard/results.py    histogram -> class areas, and one-point explanations
forestguard/server.py     stdlib HTTP API over the real pipeline; never falls back to demo data
forestguard/reflabels.py  30 m reference pixels -> cell labels, with unknown and ambiguous
                          cells abstained instead of guessed
forestguard/mlfeatures.py fixed feature order and the cell -> row join
forestguard/mlsplit.py    box geometry, sample grids, and the train/eval disjointness check
forestguard/mlmodel.py    RandomForest fit, save/load and scoring through metrics.py
docs/                     decision records, one per phase
scripts/                  access diagnosis, the pilot verification run, and the model path
tests/                    stdlib unittest, no Earth Engine calls required
```

## Rules carried by every contributor, human or AI

1. Sentinel-2 optical only. No Sentinel-1, no SAR, no radar fallback for clouds.
2. A cloud-hidden pixel is missing evidence, never loss evidence. Do not fill masked pixels.
3. Compute NDMI/NBR at 20 m, or resample with the method and reason stated in writing.
4. 30 m reference layers (Hansen) are not 10 m ground truth.
5. No numeric score may be presented as a probability without calibration.
6. Train and evaluate on different states, with spatial buffers to prevent leakage.

This directory is independent of `../forest-monitoring-gee-app`, a third-party
repository that predates this plan and is not part of it.
