# Phase 2 decision record - pilot and held-out regions

Status: **provisional**. Coordinate boxes, not forest boundaries. Closing this
phase properly needs the Earth Engine access that Phase 1 found missing, because
the boxes must be replaced with an administrative or protected-area vector and
their cloud statistics measured.

Date: 2026-10-24

## Pilot: Melghat - Satpura dry deciduous forest, Maharashtra

Box: 77.20-77.50 E, 21.20-21.40 N (about 45 km east-west).

Why this region exercises the project's actual claim:

1. **Seasonality is the trap.** Canopy in dry deciduous forest drops leaves before
   the hot season, so greenness falls without a single tree being cut. A two-date
   comparison in this landscape produces false loss across the whole forest, which
   is precisely the failure the seasonal baseline exists to prevent. A pilot that
   cannot distinguish leaf-drop from clearing proves nothing.
2. **Real loss occurs here.** Central India's driver is extractive pressure -
   mining and logging - and this tract sits inside that pattern, so genuine events
   exist to find rather than an empty map.
3. **Cloud is present but survivable.** Monsoon cloud reduces observations without
   making October-December imagery impossible, so masking and compositing improve
   the result measurably instead of merely being decorative.

## Held-out evaluation state: Tripura plantation and jhum landscape

Box: 91.40-91.70 E, 23.50-23.80 N.

Held out because it differs from the pilot in every way that can break a model:
evergreen and plantation cover rather than dry deciduous, a much heavier and longer
cloud regime, and loss driven by shifting cultivation and rubber expansion rather
than mining. No spatial overlap with the training area, so it satisfies the
cross-state requirement without leakage. Expect a materially higher
`insufficient_evidence` share here - that is a finding to report, not a bug to fix
by inventing values.

## Region selection evidence

National figures reported for 2024 are 150,000 ha of natural forest lost, with
primary forest loss at 18,200 ha. Drivers are regional, which is why the pilot and
the held-out state were chosen from different zones: northeastern states lead in
loss from shifting cultivation, logging and infrastructure; central India from
mining; the Western Ghats from roads, tourism and plantations.

## Open items before Phase 2 can close

| Item | Blocked on |
| --- | --- |
| Replace both boxes with real boundaries (protected-area or forest-division vector) | Earth Engine access or an offline vector source |
| Measure valid-observation fraction per month in both regions | Earth Engine access |
| Confirm at least one documented loss event inside the pilot box | reference layers or published reports |
| Agree the reference-sample protocol and sample count | your review, not data |
| Fix the tree-cover definition used for "forest" (Hansen 30 m density is a proxy, not India's forest class) | your review |
