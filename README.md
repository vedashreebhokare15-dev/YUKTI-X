# ForestGuard AI

AI-based, season-aware forest loss detection in India using Sentinel-2 optical imagery
in Google Earth Engine.

Two core techniques: cloud/shadow masking with temporal compositing that preserves
missing-data information, and seasonal baseline comparison that flags anomalous
deviation instead of asserting deforestation.

## Current status (2026-10-24)

| Capability | State |
| --- | --- |
| Google OAuth from this machine | verified working (`~/.config/earthengine/credentials` written by `ee.Authenticate()`) |
| Earth Engine project bound to the account | **not present** - `ee.Initialize()` raises `no project found`, retested 2026-10-24 |
| Satellite data fetched | none; Phases 3 onward cannot start |
| Decision and scoring logic | 43 unit tests pass offline (`python -m unittest discover -s tests -t .`) |

Phase 2 has a provisional region decision recorded in `docs/phase2-pilot-region.md`;
its open items depend on the missing Earth Engine project.

Nothing in `analysis` output has been validated against reference data. Do not
describe results as accurate until Phase 11 evaluation has actually been run.

## Environment

- Python 3.11.9 (`python` on PATH). Keep the virtualenv **outside** OneDrive:
  `python -m venv "$HOME/venvs/forestguard"`
- `pip install -r requirements.txt`
- Node 22.18.0 / npm 10.9.3, Git 2.50.1 - frontend work is deferred to Phase 12.

## One-time authorization

```bash
"$HOME/venvs/forestguard/Scripts/python" -c "import ee; ee.Authenticate()"
```

Opens a Google sign-in page in your default browser. Never paste the resulting
token, an API key, or a service-account JSON into a chat or into this repository.

## Verify data access

```bash
"$HOME/venvs/forestguard/Scripts/python" scripts/verify_access.py --project YOUR_PROJECT_ID
```

Reports scene counts, acquisition dates, cloud percentages, and the fraction of
pixels that survive quality screening for the configured pilot box.

## Layout

```
forestguard/config.py     provisional pilot and held-out AOIs, thresholds, date windows
forestguard/s2.py         Sentinel-2 loading, cloud + shadow screening, valid-observation counting
forestguard/indices.py    NDVI / NDMI / NBR with explicit band-resolution handling
forestguard/classify.py   pure decision rules for the four output classes (unit-tested offline)
forestguard/baseline.py   two-period comparison assembled from the above
forestguard/metrics.py    precision / recall / F1 / false-positive rate / abstention
                          and detection delay, computed from labelled samples
forestguard/seasonal.py   reference implementation of the seasonal expectation and
                         standardised deviation, from plain numbers
forestguard/persistence.py decline-persistence and supporting-index corroboration,
                          returning unknown when later scenes are cloud-covered
docs/                     decision records, one per phase
scripts/verify_access.py  Phase 1 spike
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
