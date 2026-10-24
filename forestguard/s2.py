"""Sentinel-2 loading, quality screening and compositing.

Composites carry a per-pixel valid-observation count and never substitute a value
for a pixel that was masked in every scene: a hidden pixel stays hidden.
"""

import ee

from . import config

OPAQUE_CLOUD_BIT = 10
CIRRUS_BIT = 11


def aoi_geometry(box) -> ee.Geometry:
    return ee.Geometry.Polygon([list(box)])


def _attach_probability(image: ee.Image) -> ee.Image:
    probability = (ee.Image(image.get("cloud_prob"))
                   .select("probability").rename("cloud_prob"))
    return image.addBands(probability)


def load(aoi: ee.Geometry, start: str, end: str,
         use_cloud_probability: bool = False) -> ee.ImageCollection:
    collection = (
        ee.ImageCollection(config.DATASET)
        .filterBounds(aoi)
        .filterDate(start, end)
        .select(list(config.BANDS_10M) + list(config.BANDS_20M) + ["QA60"])
    )
    if not use_cloud_probability:
        return collection

    probabilities = (
        ee.ImageCollection(config.CLOUD_PROBABILITY_DATASET)
        .filterBounds(aoi)
        .filterDate(start, end)
    )
    joined = ee.Join.saveFirst("cloud_prob").apply(
        collection,
        probabilities,
        ee.Filter.equals(leftField="system:index", rightField="system:index"),
    )
    return joined.map(_attach_probability)


def quality_screen(image: ee.Image, use_cloud_probability: bool = False) -> ee.Image:
    """Add a `valid` band: 1 where the observation may be trusted."""
    qa60 = image.select("QA60")
    cloud = qa60.bitwiseAnd(1 << OPAQUE_CLOUD_BIT).gt(0)
    cirrus = qa60.bitwiseAnd(1 << CIRRUS_BIT).gt(0)
    if use_cloud_probability:
        cloud = cloud.Or(image.select("cloud_prob")
                         .gte(config.CLOUD_PROBABILITY_CLOUDY))
    cloud = cloud.Or(cirrus).rename("cloud")

    nir = image.select("B8").divide(config.INDEX_SCALE_FACTOR)
    scene_mean_nir = ee.Number(
        nir.reduceRegion(ee.Reducer.mean(), image.geometry(), scale=20, bestEffort=True).get("B8")
    )
    dark = nir.lt(scene_mean_nir.multiply(config.SHADOW_NIR_FRACTION))
    near_cloud = cloud.focal_max(
        radius=config.CLOUD_BUFFER_METERS, kernel="circle", units="meters", iterations=1
    )
    shadow = near_cloud.gt(0).And(dark)

    return image.addBands(cloud.Not().And(shadow.Not()).rename("valid"))


def _self_mask_valid(image: ee.Image) -> ee.Image:
    return image.selfMask()


def _apply_valid_mask(image: ee.Image) -> ee.Image:
    return image.updateMask(image.select("valid"))


def composite(aoi: ee.Geometry, start: str, end: str,
              use_cloud_probability: bool = False) -> ee.Image:
    """Median of screened observations, with evidence counts preserved."""
    bands = list(config.BANDS_10M) + list(config.BANDS_20M)
    scenes = load(aoi, start, end, use_cloud_probability).map(
        lambda image: quality_screen(image, use_cloud_probability)
    )

    median = (
        scenes.select(bands).map(_apply_valid_mask)
        .reduce(ee.Reducer.median())
        .rename(bands)
    )
    valid_obs = (
        scenes.select(["valid"]).map(_self_mask_valid)
        .reduce(ee.Reducer.sum())
        .rename(["valid_obs"])
    )
    return median.addBands(valid_obs.toInt()).set(
        "study_period", [start, end]
    )


def scene_dates(aoi: ee.Geometry, start: str, end: str) -> list:
    """Client-side record of which acquisitions fed the period."""
    return (
        load(aoi, start, end)
        .aggregate_array("system:time_start")
        .getInfo()
    )


def require_observed(composite_image: ee.Image) -> ee.Image:
    """Drop pixels with no valid observation instead of trusting a value."""
    return composite_image.updateMask(composite_image.select("valid_obs").gt(0))
