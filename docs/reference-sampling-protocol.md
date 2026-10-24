# Reference-sample and evaluation protocol (draft for review)

Phase 11 cannot score anything until this exists on paper. It is a draft: the four
open decisions need your sign-off, not more code.

## What a reference sample is

One location, one date window, one human-readable label: loss, no loss, or
undeterminable. Samples are points or small squares with a stated size, drawn
before any model output is seen, so the detector cannot be tuned toward them.

## Sampling design

- Stratify by forest type and by cloud exposure, so persistently cloudy strata get
  enough samples instead of being silently untested.
- Draw independently in the pilot (Melghat-Satpura) and the held-out state
  (Tripura). No buffer sharing, no duplicated coordinates, no adjacent-pixel
  leakage between training and testing.
- Interpretation uses the imagery the detector does not have: true-colour Sentinel-2
  at 10 m plus a second source (higher-resolution imagery or published disturbance
  records) where available. Where neither settles it, the label is `undeterminable`
  and the location stays in the test set as such.

## Scoring rules the detector is judged against

| Predicted | Reference loss | Reference no-loss | Reference undeterminable |
| --- | --- | --- | --- |
| likely_loss | TP | FP | excluded |
| possible_loss | TP | FP | excluded |
| no_detected_loss | FN | TN | excluded |
| insufficient_evidence | excluded | excluded | excluded, counted as abstention |

`undeterminable` samples are never counted as correct or wrong. Abstention rate and
valid-area coverage are reported next to precision and recall, because a detector
that abstains everywhere would otherwise look flawless.

## Metrics produced

Already implemented in `forestguard/metrics.py` and unit-tested: precision, recall,
F1, false-positive rate, abstention rate, valid-area coverage, median detection delay.

## Ablation ladder

Scored on the same sample set each time, so the steps are comparable:

1. two-date comparison
2. plus cloud and shadow masking
3. plus temporal compositing
4. plus seasonal baseline and vegetation indices
5. plus persistence checks and uncertainty-aware reporting

## Open decisions - yours

1. **What counts as forest.** Hansen tree-cover density at 30 m is a canopy proxy,
   not India's forest class. Accept the proxy, or clip to an administrative or
   protected-area boundary, and say which.
2. **Minimum mapping area.** A single 10 m pixel flagged as loss is mostly noise.
   Propose 0.25 ha (about 25 pixels) as the floor; needs your agreement.
3. **Sample count.** Until access allows a first pass, the achievable count is
   unknown. Rough target: 200-400 reference locations split across the two states,
   which is enough for confidence intervals but not for claiming small accuracy gains.
4. **Blind interpretation.** Confirm whether you will interpret samples without
   seeing detector output, or want a second reviewer. Without this the reported
   precision is not defensible.

## What is not claimed

No sample has been drawn, no label assigned, no accuracy measured. Every number in
this project's evaluation table is still to be produced.
