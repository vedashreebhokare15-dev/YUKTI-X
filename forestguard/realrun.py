import dataclasses
import datetime
import uuid

import ee

from . import baseline, change, config, dataquality, indices, results, runrequest, s2, windows


class RealPipeline:
    def __init__(self, project):
        ee.Initialize(project=project)
        self._runs = {}

    def _window(self, aoi, start, end, use_probability):
        found, usable = (
            int(value.getInfo()) for value in s2.scene_counts(aoi, start, end)
        )
        collection = s2.load(aoi, start, end, use_probability)
        dates = windows.dates_from_millis(
            collection.aggregate_array("system:time_start").getInfo()
        )
        clouds = collection.aggregate_array("CLOUDY_PIXEL_PERCENTAGE").getInfo()
        quality = dataquality.assess_window(start, end, found, usable, dates)
        report = dataclasses.asdict(quality)
        report["cloud_percentage"] = dataquality.cloud_percentage_summary(clouds)
        report["actual_date_range"] = [min(dates), max(dates)] if dates else [None, None]
        return report

    def _coverage(self, aoi, composite):
        histogram = (
            composite.select("valid_obs").unmask(0, False).clip(aoi)
            .reduceRegion(
                ee.Reducer.frequencyHistogram(), aoi,
                scale=config.ANALYSIS_SCALE_METERS, maxPixels=10 ** 9, tileScale=2,
            )
            .get("valid_obs").getInfo()
        )
        return dataquality.coverage_from_histogram(
            results.normalize_histogram(histogram),
            config.MIN_VALID_OBSERVATIONS,
            config.ANALYSIS_SCALE_METERS ** 2,
        )

    def _layer(self, image, label, **visualization):
        map_id = image.getMapId(visualization)
        return {"label": label, "tile_url": map_id["tile_fetcher"].url_format}

    def run(self, request):
        region = runrequest.REGIONS[request["region"]]
        aoi = s2.aoi_geometry(region["aoi"])
        use_probability = request["use_cloud_probability"]
        history = windows.history_windows(
            request["after"][0], request["after"][1], request["history_years"]
        )
        named_windows = [("before", *request["before"]), ("after", *request["after"])]
        named_windows.extend((f"history_{year}", start, end) for year, start, end in history)
        quality = {
            name: self._window(aoi, start, end, use_probability)
            for name, start, end in named_windows
        }
        blocked = next((report for report in quality.values() if not report["reportable"]), None)
        if blocked:
            raise LookupError(
                f"No reportable scenes for {blocked['start']} to {blocked['end']}: "
                f"{blocked['status']}, {blocked['scenes_found']} found and "
                f"{blocked['scenes_usable']} usable after screening."
            )

        composites = {
            name: s2.composite(aoi, start, end, use_probability)
            for name, start, end in named_windows
        }
        before = indices.all_indices(s2.require_observed(composites["before"])).addBands(
            composites["before"].select("valid_obs")
        )
        after = indices.all_indices(s2.require_observed(composites["after"])).addBands(
            composites["after"].select("valid_obs")
        )
        baselines = baseline.seasonal_baselines(
            region["aoi"], request["after"], request["history_years"],
            use_cloud_probability=use_probability,
        )
        evidence, classes = change.build_change(before, after, baselines)
        classes = classes.unmask(4, False).clip(aoi)

        quality["before"]["coverage"] = self._coverage(aoi, composites["before"])
        quality["after"]["coverage"] = self._coverage(aoi, composites["after"])
        class_histogram = (
            classes.reduceRegion(
                ee.Reducer.frequencyHistogram(), aoi,
                scale=config.ANALYSIS_SCALE_METERS, maxPixels=10 ** 9, tileScale=2,
            ).get("class_code").getInfo()
        )
        areas = results.class_areas(class_histogram)

        after_ndvi = after.select("NDVI")
        after_ndmi = after.select("NDMI")
        after_nbr = after.select("NBR")
        deviation = evidence.select("NDVI_deviation_sigma")
        valid_obs = composites["after"].select("valid_obs").unmask(0, False).clip(aoi)
        layers = {
            "before_true_colour": self._layer(
                composites["before"], "Before: cloud-masked Sentinel-2 true colour",
                bands=list(config.TRUE_COLOUR), min=0, max=3000, gamma=1.2,
            ),
            "after_true_colour": self._layer(
                composites["after"], "After: cloud-masked Sentinel-2 true colour",
                bands=list(config.TRUE_COLOUR), min=0, max=3000, gamma=1.2,
            ),
            "class": self._layer(
                classes, "Candidate loss classes", min=1, max=4,
                palette=["2f9e6b", "e8912a", "d7263d", "6b6f76"],
            ),
            "deviation": self._layer(
                deviation, "NDVI seasonal deviation", min=-8, max=2,
                palette=["8f0f24", "d7263d", "e8912a", "2f9e6b"],
            ),
            "ndvi": self._layer(
                after_ndvi, "After NDVI (10 m inputs)", min=-0.2, max=0.8,
                palette=["8a6b3d", "c8c46a", "4e8f43", "0d4d2a"],
            ),
            "ndmi": self._layer(
                after_ndmi, "After NDMI (20 m)", min=-0.6, max=0.6,
                palette=["8a6b3d", "e8d8a0", "4b9b72", "17618c"],
            ),
            "nbr": self._layer(
                after_nbr, "After NBR (20 m)", min=-0.6, max=0.8,
                palette=["6f1726", "d89b52", "c8c46a", "0d4d2a"],
            ),
            "evidence": self._layer(
                valid_obs, "After valid observations", min=0, max=6,
                palette=["6b6f76", "123a5c", "1f77b4", "7fc4e8", "e8f4fb"],
            ),
        }

        run_id = uuid.uuid4().hex
        self._runs[run_id] = {"evidence": evidence, "aoi_box": region["aoi"]}
        longitudes = [point[0] for point in region["aoi"]]
        latitudes = [point[1] for point in region["aoi"]]
        thresholds = baseline.config_thresholds()
        thresholds["historical_ndvi_min"] = config.HISTORICAL_NDVI_MIN
        thresholds["cloud_probability_threshold"] = config.CLOUD_PROBABILITY_CLOUDY
        return {
            "mode": "real",
            "run_id": run_id,
            "cells": [],
            "bounds": [[min(latitudes), min(longitudes)], [max(latitudes), max(longitudes)]],
            "layers": layers,
            "quality": quality,
            "provenance": {
                "origin": "REAL SENTINEL-2 MEASUREMENTS from Google Earth Engine",
                "do_not_publish_as": "confirmed deforestation or validated accuracy",
                "why": "Candidate vegetation-change signals with explicit missing-data and seasonal-evidence gates",
                "classifier": "forestguard.classify rules; no trained ML model and no measured accuracy",
                "study_region": region["name"],
                "aoi_note": "Coordinate box, not an official forest boundary",
                "forest_definition": (
                    f"Provisional historical NDVI >= {config.HISTORICAL_NDVI_MIN}; "
                    "not a validated legal or ecological forest mask"
                ),
                "before": list(request["before"]),
                "after": list(request["after"]),
                "history_windows": [list(row) for row in history],
                "datasets": [config.DATASET, config.CLOUD_PROBABILITY_DATASET],
                "cloud_probability_screened": use_probability,
                "masked_pixels_are_not_filled": True,
                "generated_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "grid": {
                    "nominal_resolution_m": config.ANALYSIS_SCALE_METERS,
                    "cell_area_m2": config.ANALYSIS_SCALE_METERS ** 2,
                    "area_note": "Nominal 20 m cell areas; not official forest statistics",
                },
                "thresholds": thresholds,
                "class_counts": areas["counts"],
                "class_hectares": areas["hectares"],
            },
        }

    def inspect(self, run_id, lon, lat):
        run = self._runs[run_id]
        if not runrequest.point_inside(run["aoi_box"], lon, lat):
            raise ValueError("inspection point is outside the selected region")
        point = ee.Geometry.Point([lon, lat])
        sample = run["evidence"].reduceRegion(
            ee.Reducer.first(), point, scale=config.ANALYSIS_SCALE_METERS,
            maxPixels=10 ** 6,
        ).getInfo() or {}
        explanation = results.explain_sample(sample)
        map_code = sample.get("class_code")
        if map_code is not None and results.CLASS_BY_CODE[int(map_code)] != explanation["label"]:
            raise RuntimeError("map class and inspector rule disagree")
        return {
            "mode": "real", "run_id": run_id, "lon": lon, "lat": lat,
            **explanation,
        }
