"""Assemble one model row from a cell's measured statistics.

The model consumes an ordered tuple, not a dict, so the column order is declared
here and every caller gets the same layout. A missing or non-numeric value raises:
a RandomForest cannot represent "not measured", and silently filling zero would
teach the model that absent cloud-masked evidence means an index of zero.
"""

FEATURE_NAMES = (
    "ndvi_before",
    "ndvi_after",
    "ndmi_before",
    "ndmi_after",
    "nbr_before",
    "nbr_after",
    "ndvi_sigma",
    "ndmi_sigma",
    "nbr_sigma",
    "valid_before",
    "valid_after",
    "ndvi_baseline",
)


def vectorize(stats: dict):
    row = []
    for name in FEATURE_NAMES:
        if name not in stats:
            raise KeyError(f"missing feature: {name}")
        value = stats[name]
        if value is None:
            raise ValueError(f"feature {name} is not measured")
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"feature {name} must be numeric, got {value!r}")
        row.append(float(value))
    return tuple(row)


def merge_means(cells, measured_features, bands):
    """Attach each sampled box's band means to the cell it was asked for.

    A cell that no batch answered keeps every feature unmeasured, so
    `build_dataset` drops it with a reason instead of training on a hole
    filled with zero.
    """
    by_position = {}
    for feature in measured_features:
        properties = feature.get("properties", {})
        lon, lat = properties.get("cell_lon"), properties.get("cell_lat")
        if lon is None or lat is None:
            continue
        by_position[(lon, lat)] = properties
    for cell in cells:
        properties = by_position.get(tuple(cell["position"]), {})
        cell["stats"] = {
            name: properties.get(band) for name, band in bands.items()
        }
    return cells


def build_dataset(
    cells,
    min_tree_cover: int = 30,
    loss_window=None,
    min_reference_pixels: int = 4,
    ambiguous_margin: float = 0.1,
):
    """Join measured cells to reference labels, keeping every rejection on record.

    `cells` is an iterable of `{"cell_id", "stats", "points"}` mappings: the feature
    statistics measured for one analysis cell, and the reference points that fall
    inside it. A cell is only kept when both sides are complete - an unlabelable cell
    is `abstained`, a cell without full measurements is `dropped`, and neither is
    quietly turned into a row. That distinction matters later: many abstentions means
    the reference layer is thin here, while many drops means the satellite windows
    were too cloudy to measure anything.
    """
    from .reflabels import (
        ABSTAIN,
        counts_from_points,
        forest_cover_ok,
        label_cell,
    )

    kept, abstained, dropped = [], [], []
    rows, labels = [], []
    for cell in cells:
        cell_id = cell.get("cell_id")
        # A cell may carry raw reference points, or counts already aggregated from a
        # histogram - the two ways a coarse reference layer is read.
        counts = cell.get("counts")
        if counts is None:
            counts = counts_from_points(
                cell.get("points", ()),
                min_tree_cover=min_tree_cover,
                loss_window=loss_window,
            )
        if "forest_cover" in cell and not forest_cover_ok(
            cell["forest_cover"], min_tree_cover=min_tree_cover
        ):
            abstained.append({
                "cell_id": cell_id,
                "reason": f"mean canopy {cell['forest_cover']} is below the {min_tree_cover} % "
                          "cover gate, so this cell is not forest to lose",
                **counts,
            })
            continue
        decision = label_cell(
            **counts,
            min_reference_pixels=min_reference_pixels,
            ambiguous_margin=ambiguous_margin,
        )
        if decision["label"] == ABSTAIN:
            abstained.append({"cell_id": cell_id, "reason": decision["reason"], **counts})
            continue
        try:
            row = vectorize(cell["stats"])
        except (KeyError, ValueError) as exc:
            dropped.append({"cell_id": cell_id, "reason": str(exc)})
            continue
        rows.append(row)
        labels.append(decision["label"])
        kept.append({"cell_id": cell_id, "label": decision["label"],
                     "loss_share": decision["loss_share"]})

    return {
        "rows": rows,
        "labels": labels,
        "kept": kept,
        "abstained": abstained,
        "dropped": dropped,
        "summary": {
            "loss": sum(1 for label in labels if label == "loss"),
            "no_loss": sum(1 for label in labels if label == "no_loss"),
            "abstained": len(abstained),
            "dropped": len(dropped),
        },
    }
