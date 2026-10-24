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


def _to_20m(narrow: ee.Image) -> ee.Image:
    return narrow.reduceResolution(ee.Reducer.mean()).reproject(scale=20)


def ndvi(image: ee.Image) -> ee.Image:
    bands = _indices_image(image)
    nir, red = bands.select("B8"), bands.select("B4")
    return _ratio(nir.subtract(red), nir.add(red), "NDVI").set(
        {"nominal_resolution_m": 10, "source_bands": "B8,B4"}
    )


def ndmi(image: ee.Image) -> ee.Image:
    bands = _indices_image(image)
    nir, swir = _to_20m(bands.select("B8")), bands.select("B11")
    return _ratio(nir.subtract(swir), nir.add(swir), "NDMI").set(
        {"nominal_resolution_m": 20, "source_bands": "B8@20m,B11"}
    )


def nbr(image: ee.Image) -> ee.Image:
    bands = _indices_image(image)
    nir, swir = _to_20m(bands.select("B8")), bands.select("B12")
    return _ratio(nir.subtract(swir), nir.add(swir), "NBR").set(
        {"nominal_resolution_m": 20, "source_bands": "B8@20m,B12"}
    )


def all_indices(image: ee.Image) -> ee.Image:
    return image.addBands([ndvi(image), ndmi(image), nbr(image)], overwrite=True)
