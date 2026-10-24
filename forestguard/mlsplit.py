"""Keep training regions and evaluation regions from touching each other.

Satellite cells are spatially autocorrelated: a test box that shares a edge, or sits
a few hundred metres away, lets a model score well by memorising the same landscape.
So the split is checked on the boxes themselves, expanded by a buffer, and on the
names of the states involved.

Boxes are `(min_lon, min_lat, max_lon, max_lat)` in WGS84 degrees. The buffer is
also in degrees: near the tropics 0.05 degrees is roughly 5 km, which is the order
of separation wanted here, and the approximation is not used for any reported area.
"""

Box = tuple[float, float, float, float]


def expand_box(box: Box, buffer_degrees: float) -> Box:
    min_lon, min_lat, max_lon, max_lat = box
    return (
        min_lon - buffer_degrees,
        min_lat - buffer_degrees,
        max_lon + buffer_degrees,
        max_lat + buffer_degrees,
    )


def points_box(points) -> Box:
    """The bounding box of `[lon, lat]` points, for clipping work to a batch."""
    lons = [point[0] for point in points]
    lats = [point[1] for point in points]
    if not lons:
        raise ValueError("points_box needs at least one point")
    return (min(lons), min(lats), max(lons), max(lats))


def overlap(a: Box, b: Box) -> bool:
    """Inclusive: two boxes that only share an edge still overlap."""
    a_min_lon, a_min_lat, a_max_lon, a_max_lat = a
    b_min_lon, b_min_lat, b_max_lon, b_max_lat = b
    return not (
        a_max_lon < b_min_lon
        or b_max_lon < a_min_lon
        or a_max_lat < b_min_lat
        or b_max_lat < a_min_lat
    )


def spatial_conflicts(train_boxes, eval_boxes, buffer_degrees: float = 0.0):
    """Return (train_index, eval_index) pairs whose buffered boxes touch."""
    buffered = [expand_box(box, buffer_degrees) for box in train_boxes]
    return [
        (train_index, eval_index)
        for train_index, box in enumerate(buffered)
        for eval_index, other in enumerate(eval_boxes)
        if overlap(box, other)
    ]


def _axis(start: float, stop: float, step: float):
    values = []
    current = start
    while current < stop - 1e-9:
        values.append(round(current, 9))
        current += step
    return values


def grid_points(box: Box, step_degrees: float):
    """Sample points on a regular lon/lat grid, kept inside `box`.

    Used to ask a coarse reference layer what it reports at independent locations.
    Longitude varies fastest, so the list reads as rows from the south-west corner.
    """
    min_lon, min_lat, max_lon, max_lat = box
    if step_degrees <= 0:
        raise ValueError(f"step_degrees must be positive: {step_degrees}")
    if min_lon >= max_lon or min_lat >= max_lat:
        raise ValueError(f"box is empty or inverted: {box}")
    lons = _axis(min_lon, max_lon, step_degrees)
    lats = _axis(min_lat, max_lat, step_degrees)
    return [[lon, lat] for lat in lats for lon in lons]


METRES_PER_DEGREE_LAT = 111_320.0


def cell_box(center, side_meters: float, latitude: float) -> Box:
    """A square cell of `side_meters` centred on a (lon, lat) point.

    Degrees of longitude shrink with latitude, so the cell is only square on the
    ground once that is accounted for. `latitude` is normally the centre's own
    latitude.
    """
    if side_meters < 0:
        raise ValueError(f"side_meters cannot be negative: {side_meters}")
    from math import cos, radians

    half_lat = side_meters / 2 / METRES_PER_DEGREE_LAT
    half_lon = half_lat / cos(radians(latitude))
    lon, lat = center
    return (lon - half_lon, lat - half_lat, lon + half_lon, lat + half_lat)


def corner_box(ring, east_degrees: float, north_degrees: float, origin=None):
    """Slice a small closed ring out of a region ring.

    Sampling the full pilot box means reducing about 730 km^2 at 20 m, which takes
    many minutes per request; a check or a first training table only needs a few
    square kilometres. The slice never extends past the region's own north-east
    corner, so a caller asking for more than the region holds gets the region.

    `origin` moves the slice: a coarse reference scan reports where the canopy is,
    and the slow Sentinel-2 requests should be spent there rather than at the
    south-west corner of the bounding box. An origin that leaves no room for the
    slice is pulled back inside the region.
    """
    if east_degrees <= 0 or north_degrees <= 0:
        raise ValueError(
            f"slice must be positive in both directions: {east_degrees}, {north_degrees}"
        )
    lons = [point[0] for point in ring]
    lats = [point[1] for point in ring]
    region_min_lon, region_min_lat = min(lons), min(lats)
    region_max_lon, region_max_lat = max(lons), max(lats)

    if origin is None:
        lon, lat = region_min_lon, region_min_lat
    else:
        lon, lat = float(origin[0]), float(origin[1])
        if not (region_min_lon <= lon <= region_max_lon
                and region_min_lat <= lat <= region_max_lat):
            raise ValueError(
                f"origin {lon}, {lat} is outside the region "
                f"({region_min_lon} to {region_max_lon}, "
                f"{region_min_lat} to {region_max_lat})"
            )

    east = min(east_degrees, region_max_lon - region_min_lon)
    north = min(north_degrees, region_max_lat - region_min_lat)
    lon = min(lon, region_max_lon - east)
    lat = min(lat, region_max_lat - north)
    return [
        [lon, lat],
        [lon + east, lat],
        [lon + east, lat + north],
        [lon, lat + north],
        [lon, lat],
    ]


def split_regions(regions, train_keys, eval_keys, buffer_degrees: float = 0.0):
    """Pick the two disjoint groups out of a `{name: box}` mapping."""
    unknown = [key for key in (*train_keys, *eval_keys) if key not in regions]
    if unknown:
        raise KeyError(f"regions not found: {', '.join(unknown)}")
    shared = set(train_keys) & set(eval_keys)
    if shared:
        raise ValueError(f"regions in both train and eval: {', '.join(sorted(shared))}")

    train = {key: regions[key] for key in train_keys}
    eval_ = {key: regions[key] for key in eval_keys}
    conflicts = spatial_conflicts(
        list(train.values()), list(eval_.values()), buffer_degrees
    )
    if conflicts:
        pairs = ", ".join(
            f"{list(train)[train_index]} / {list(eval_)[eval_index]}"
            for train_index, eval_index in conflicts
        )
        raise ValueError(
            f"training and evaluation regions are within {buffer_degrees} degrees "
            f"of each other: {pairs}"
        )
    return train, eval_
