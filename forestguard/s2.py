"""Sentinel-2 loading, quality screening and compositing.

Composites carry a per-pixel valid-observation count and never substitute a value
for a pixel that was masked in every scene: a hidden pixel stays hidden.

Two audit rules shape this module. A window that contains no scene must be
detected before compositing, because Earth Engine reducers fail on an empty
collection and a caller that swallows that error produces a blank map that looks
like "no loss". And a scene whose cloud-probability image cannot be matched is
dropped from a probability-screened run and counted, rather than being silently
screened by a weaker rule than its neighbours.
"""

import ee

from . import config, windows

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
        .select(config.bands_to_load())
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
    # Unmatched scenes have no `cloud_prob` property; keeping them would raise
    # when the band is read, so they are filtered out and counted instead.
    return (ee.ImageCollection(joined)
            .filter(ee.Filter.notNull(["cloud_prob"]))
            .map(_attach_probability))


def scene_counts(aoi: ee.Geometry, start: str, end: str):
    """Deferred (scenes found, scenes usable after the probability join) pair.

    The second number is lower wherever COPERNICUS/S2_CLOUD_PROBABILITY has no
    matching image, which is how a probability-screened run loses observations.
    """
    return (
        load(aoi, start, end, use_cloud_probability=False).size(),
        load(aoi, start, end, use_cloud_probability=True).size(),
    )



def quality_screen(image: ee.Image, aoi: ee.Geometry,
                   use_cloud_probability: bool = False) -> ee.Image:
    """Add a `valid` band: 1 where the observation may be trusted.

    QA60 is native 60 m, so it becomes a mask that Earth Engine resamples onto
    each band's own grid. Reflectance is never resampled to 60 m or promoted to
    a finer one.
    """
    qa60 = image.select("QA60")
    cloud = qa60.bitwiseAnd(1 << OPAQUE_CLOUD_BIT).gt(0)
    cirrus = qa60.bitwiseAnd(1 << CIRRUS_BIT).gt(0)
    if use_cloud_probability:
        cloud = cloud.Or(image.select("cloud_prob").gte(config.CLOUD_PROBABILITY_CLOUDY))
    cloud = cloud.Or(cirrus).rename("cloud")

    nir = image.select("B8").divide(config.INDEX_SCALE_FACTOR)
    # The brightness reference is the study area, not the whole 109 km scene:
    # a distant half of the tile that is entirely cloud would move the shadow
    # threshold under the pixels we actually report on.
    scene_mean_nir = ee.Number(
        nir.reduceRegion(ee.Reducer.mean(), aoi, scale=20, bestEffort=True,
                         maxPixels=10 ** 8).get("B8")
    )
    dark = nir.lt(scene_mean_nir.multiply(config.SHADOW_NIR_FRACTION))
    near_cloud = cloud.focal_max(
        radius=config.CLOUD_BUFFER_METERS, kernel="circle", units="meters", iterations=1
    )
    shadow = near_cloud.gt(0).And(dark)

    return image.addBands(cloud.Not().And(shadow.Not()).rename("valid"))


def composite(aoi: ee.Geometry, start: str, end: str,
              use_cloud_probability: bool = False) -> ee.Image:
    """Median of screened observations, with evidence counts preserved.

    Callers must first show the window is not empty (`scene_counts`); Earth
    Engine reducers raise on an empty collection.
    """
    bands = config.reflectance_bands()
    scenes = load(aoi, start, end, use_cloud_probability).map(
        lambda image: quality_screen(image, aoi, use_cloud_probability)
    )

    median = (
        scenes.select(bands).map(lambda image: image.updateMask(image.select("valid")))
        .reduce(ee.Reducer.median())
        .rename(bands)
    )
    valid_obs = (
        scenes.select(["valid"]).map(lambda image: image.selfMask())
        .reduce(ee.Reducer.sum())
        .rename(["valid_obs"])
    )
    return median.addBands(valid_obs.toInt()).set(
        {
            "study_period": [start, end],
            "dataset": config.DATASET,
            "cloud_probability_screened": use_cloud_probability,
            "cloud_probability_threshold": config.CLOUD_PROBABILITY_CLOUDY,
            "cloud_buffer_meters": config.CLOUD_BUFFER_METERS,
            "aggregation": "per-pixel median of scenes that passed the quality screen",
            "masked_pixels_are_not_filled": True,
        }
    )


def scene_dates(aoi: ee.Geometry, start: str, end: str) -> list:
    """Client-side record of which acquisitions fed the period."""
    return windows.dates_from_millis(
        load(aoi, start, end).aggregate_array("system:time_start").getInfo()
    )


def require_observed(composite_image: ee.Image) -> ee.Image:
    """Drop pixels with no valid observation instead of trusting a value."""
    return composite_image.updateMask(composite_image.select("valid_obs").gt(0))
