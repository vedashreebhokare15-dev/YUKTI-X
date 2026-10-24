"""Vegetation indices with explicit band-resolution handling.

NDVI uses only 10 m bands. NDMI and NBR pair a 10 m band with a 20 m band, so
they are computed at 20 m: the near-infrared term is aggregated to the coarser
grid instead of the short-wave term being invented at 10 m.
"""

import ee

from . import config

DENOMINATOR_EPSILON = 1e-6


def _indices_image(image: ee.Image) -> ee.Image:
    return image.select(list(config.BANDS_10M) + list(config.BANDS_20M)).divide(
        config.INDEX_SCALE_FACTOR
    )


def _ratio(numerator: ee.Image, denominator: ee.Image, name: str) -> ee.Image:
    usable = denominator.abs().gt(DENOMINATOR_EPSILON)
    result = numerator.divide(denominator)
    return (
        result.updateMask(usable)
        .updateMask(numerator.mask())
        .updateMask(denominator.mask())
        .rename(name)
    )


def _to_coarser(narrow: ee.Image) -> ee.Image:
    """Aggregate the 10 m near-infrared term onto the 20 m analysis grid.

    A composite built by reducing several scenes reports every band as an abstract
    EPSG:4326 projection with no scale, and `reduceResolution` refuses such an image
    ("The input to reduceResolution does not have a valid default projection"). Both
    grids are therefore declared instead of inherited: the Sentinel-2 10 m grid for
    the term being aggregated, and the 20 m analysis grid as the target - the same
    grid every other band is read on. `maxPixels` is raised above the default of 8
    because the two grids are not perfectly nested; without it Earth Engine aborts
    instead of averaging the few extra source pixels that overlap a 20 m cell.

    The short-wave bands are never lifted to 10 m. Averaging the near-infrared down
    is the only resampling performed here.
    """
    declared = narrow.setDefaultProjection(
        crs=config.INDEX_GRID_CRS, scale=config.INDEX_FINE_SCALE_METERS
    )
    return declared.reduceResolution(
        reducer=ee.Reducer.mean(),
        maxPixels=config.RESAMPLE_MAX_INPUT_PIXELS,
    ).reproject(crs=config.INDEX_GRID_CRS, scale=config.ANALYSIS_SCALE_METERS)


def ndvi(image: ee.Image) -> ee.Image:
    bands = _indices_image(image)
    nir, red = bands.select("B8"), bands.select("B4")
    return _ratio(nir.subtract(red), nir.add(red), "NDVI").set(
        {"nominal_resolution_m": 10, "source_bands": "B8,B4"}
    )


def ndmi(image: ee.Image) -> ee.Image:
    bands = _indices_image(image)
    nir, swir = _to_coarser(bands.select("B8")), bands.select("B11")
    return _ratio(nir.subtract(swir), nir.add(swir), "NDMI").set(
        {"nominal_resolution_m": 20, "source_bands": "B8@20m,B11"}
    )


def nbr(image: ee.Image) -> ee.Image:
    bands = _indices_image(image)
    nir, swir = _to_coarser(bands.select("B8")), bands.select("B12")
    return _ratio(nir.subtract(swir), nir.add(swir), "NBR").set(
        {"nominal_resolution_m": 20, "source_bands": "B8@20m,B12"}
    )


def all_indices(image: ee.Image) -> ee.Image:
    return image.addBands([ndvi(image), ndmi(image), nbr(image)], overwrite=True)
