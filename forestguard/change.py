import ee

from . import baseline, config


def build_change(before: ee.Image, after: ee.Image, baselines: dict):
    deviations = {
        index: baseline.deviation_sigma(after, baselines[index], index)
        for index in ("NDVI", "NDMI", "NBR")
    }
    ndvi_deviation = deviations["NDVI"]
    decline = ndvi_deviation.multiply(-1).unmask(0)
    deviation_available = ndvi_deviation.mask()

    valid = (
        before.select("valid_obs").gte(config.MIN_VALID_OBSERVATIONS)
        .And(after.select("valid_obs").gte(config.MIN_VALID_OBSERVATIONS))
        .unmask(0)
    )
    historical_forest = (
        baselines["NDVI"].select("NDVI_baseline")
        .gte(config.HISTORICAL_NDVI_MIN).unmask(0)
    )

    ndmi_available = deviations["NDMI"].mask()
    nbr_available = deviations["NBR"].mask()
    ndmi_agrees = ndmi_available.Not().Or(
        deviations["NDMI"].lte(-config.WEAK_SIGMA).unmask(0)
    )
    nbr_agrees = nbr_available.Not().Or(
        deviations["NBR"].lte(-config.WEAK_SIGMA).unmask(0)
    )
    supporting = ndmi_available.Or(nbr_available).And(ndmi_agrees).And(nbr_agrees)

    rule = (
        ee.Image.constant(6)
        .where(decline.gte(config.WEAK_SIGMA), 5)
        .where(decline.gte(config.STRONG_SIGMA).And(supporting), 4)
        .where(historical_forest.Not(), 2)
        .where(deviation_available.Not(), 3)
        .where(valid.Not(), 1)
        .rename("rule_code").toUint8()
    )
    class_image = rule.remap(
        [1, 2, 3, 4, 5, 6], [4, 4, 4, 3, 2, 1]
    ).rename("class_code").toUint8()

    evidence = (
        after.select(["NDVI", "NDMI", "NBR"])
        .addBands(before.select("NDVI").rename("NDVI_before"))
        .addBands(before.select("valid_obs").rename("valid_obs_before"))
        .addBands(after.select("valid_obs").rename("valid_obs_after"))
        .addBands(list(baselines.values()))
        .addBands(list(deviations.values()))
        .addBands(rule)
        .addBands(class_image)
    )
    return evidence, class_image
