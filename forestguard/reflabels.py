"""Turn 30 m reference-loss pixels inside a 20 m analysis cell into a training label.

The public reference layers are coarser than the analysis grid and carry a nodata
value, so a cell is only labelable when enough of its reference pixels are usable.
Unknown reference pixels are dropped from the denominator: treating them as
"no loss" would teach the model that unmeasured ground is stable ground.
"""

LOSS = "loss"
NO_LOSS = "no_loss"
ABSTAIN = "abstain"

# Sentinel values used by the 30 m global products for "no observation". They are
# not zero, and reading them as zero would label unmeasured ground as stable forest.
UNKNOWN_LOSS_VALUES = (255, 999)


def counts_from_points(points, min_tree_cover: int = 30, loss_window=None):
    """Sort labelled reference points into loss / stable / unknown counts.

    `points` is an iterable of dicts carrying at least `lossyear` and `treecover`
    as read per reference pixel. `loss_window` is the inclusive (first, last)
    relative loss year the analysis period corresponds to; loss outside it is
    unknown rather than stable, because a cell that already lost canopy earlier
    cannot be used to teach what an intact cell looks like.
    """
    loss = stable = unknown = 0
    for point in points:
        cover = point.get("treecover")
        year = point.get("lossyear")
        # Hansen's `datamask` is 1 where the product has an observation and 0 over
        # ice and inland water; those pixels have no lossyear signal of their own.
        if point.get("datamask") == 0:
            unknown += 1
            continue
        if cover is None or cover < min_tree_cover:
            unknown += 1
            continue
        if year is None:
            # A pixel the product marks as land (`datamask` 1) that carries no loss
            # year is a pixel with no recorded loss, verified against v1_13. Without
            # that land observation the same absence stays unknown.
            if point.get("datamask") == 1:
                stable += 1
            else:
                unknown += 1
            continue
        if year < 0 or year in UNKNOWN_LOSS_VALUES:
            unknown += 1
            continue
        if year == 0:
            stable += 1
            continue
        if loss_window is not None and not loss_window[0] <= year <= loss_window[1]:
            unknown += 1
            continue
        loss += 1
    return {
        "loss_pixels": loss,
        "stable_pixels": stable,
        "unknown_pixels": unknown,
    }


def histogram_mean(hist):
    """Weighted mean of a value -> count histogram, or None when it holds nothing.

    The reference layer is read as a histogram per cell, so mean canopy has to be
    recovered from the counts rather than from a separate request. An empty histogram
    returns None, not 0: no observation is not 0 % cover.
    """
    if not hist:
        return None
    total = count = 0
    for key, value in hist.items():
        if value is None:
            continue
        total += int(key) * value
        count += value
    return total / count if count else None


def canopy_pixels(hist, min_tree_cover: int) -> float:
    """How many reference pixels in the cell carry at least the forest canopy gate.

    `lossyear` is masked wherever nothing was lost, so stability has to be counted
    against the pixels that are forested enough to lose canopy. Counting every pixel
    in the box instead would teach the model that bare ground is stable forest.
    """
    if not hist:
        return 0
    return sum(
        value for key, value in hist.items()
        if value is not None and int(key) >= min_tree_cover
    )


def forest_cover_ok(mean_cover, min_tree_cover: int = 30) -> bool:
    """Whether a cell's mean canopy is forested enough to carry a loss label.

    `None` means the reference layer reported nothing for the cell, which is not a
    pass: an unmeasured cell cannot be called stable forest.
    """
    if mean_cover is None:
        return False
    return mean_cover >= min_tree_cover


def counts_from_histogram(lossyear_hist, loss_window=None, observed_pixels=None):
    """Turn a `lossyear` frequency histogram into loss / stable / unknown counts.

    Earth Engine returns histogram keys as strings, and the reference product marks
    no-data with 255 (and 999 in older releases). A loss year outside `loss_window`
    is unknown rather than stable for the same reason as in `counts_from_points`:
    canopy that went earlier cannot teach the model what an intact cell looks like.

    `lossyear` is masked where nothing was lost, so an intact pixel never appears in
    the histogram at all. `observed_pixels` is how many pixels the product reported
    as land in the same cell, taken from `datamask`: the pixels the histogram is
    missing are then counted as stability instead of abstaining the whole cell.
    """
    loss = stable = unknown = 0
    for key, count in (lossyear_hist or {}).items():
        value = int(key)
        if count is None:
            continue
        if value == 0:
            stable += count
        elif value < 0 or value in UNKNOWN_LOSS_VALUES:
            unknown += count
        elif loss_window is not None and not loss_window[0] <= value <= loss_window[1]:
            unknown += count
        else:
            loss += count
    if observed_pixels is not None:
        unreported = observed_pixels - (loss + stable + unknown)
        if unreported > 0:
            stable += unreported
    return {
        "loss_pixels": loss,
        "stable_pixels": stable,
        "unknown_pixels": unknown,
    }


def label_cell(
    loss_pixels: int,
    stable_pixels: int,
    unknown_pixels: int = 0,
    min_reference_pixels: int = 4,
    ambiguous_margin: float = 0.1,
):
    """Return the label plus the count and share it was decided from."""
    counts = (loss_pixels, stable_pixels, unknown_pixels)
    if any(count < 0 for count in counts):
        raise ValueError(f"pixel counts cannot be negative: {counts}")
    if not 0.0 <= ambiguous_margin <= 0.5:
        raise ValueError(f"ambiguous_margin must be between 0 and 0.5: {ambiguous_margin}")

    usable = loss_pixels + stable_pixels
    base = {
        "usable_pixels": usable,
        "unknown_pixels": unknown_pixels,
        "loss_share": loss_pixels / usable if usable else None,
    }
    if usable == 0:
        return {**base, "label": ABSTAIN, "reason": "no reference pixels, only unknown"}
    if usable < min_reference_pixels:
        return {
            **base,
            "label": ABSTAIN,
            "reason": f"only {usable} usable reference pixels, below {min_reference_pixels}",
        }

    share = base["loss_share"]
    upper = 0.5 + ambiguous_margin
    lower = 0.5 - ambiguous_margin
    if share >= upper:
        return {**base, "label": LOSS, "reason": f"{share:.2f} of usable reference pixels show loss"}
    if share <= lower:
        return {**base, "label": NO_LOSS, "reason": f"{1 - share:.2f} of usable reference pixels are stable"}
    return {
        **base,
        "label": ABSTAIN,
        "reason": f"ambiguous cell: {share:.2f} loss share is within {ambiguous_margin} of an even split",
    }
