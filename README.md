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
| Earth Engine project bound to the account | **absent** - Earth Engine has never been activated for this account, and no Cloud project has the API enabled. Diagnosis in `docs/phase1-earth-engine-access.md` |
| Satellite data fetched | none. No number in this repository is a measurement |
| Decision and scoring logic | 79 unit tests pass offline, with no Earth Engine package installed |
| Phase 2 pipeline audit | done and written up in `docs/phase2-pipeline-audit.md`; four real defects fixed |
| Earth Engine code paths (`s2`, `indices`, `baseline`) | reviewed only - they cannot even be constructed without a project, so they are labelled unexercised |
| Validation against reference data | none started; nothing may be described as accurate |

## Environment

- Python 3.11.9 (`python` on PATH). Keep the virtualenv **outside** OneDrive:
  `python -m venv "$HOME/venvs/forestguard"`
- `pip install -r requirements.txt`
- Node 22.18.0 / npm 10.9.3, Git 2.50.1 - frontend work is deferred to Phase 12.
- Tests: `python -m unittest discover -s tests` - 79 tests, and they need neither a
  virtualenv nor the Earth Engine package.
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
docs/                     decision records, one per phase
scripts/                  access diagnosis and the pilot verification run
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
