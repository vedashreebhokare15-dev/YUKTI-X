import { downloadJson, safeFilename } from './download';

function pointFeature(result) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [result.coordinates[1], result.coordinates[0]],
    },
    properties: {
      id: result.id,
      location: result.location,
      district: result.district,
      state: result.state,
      classification: result.classification,
      areaKm2: result.areaKm2,
      confidence: result.confidence,
      observationDate: result.observationDate,
      status: result.status,
      dataSource: 'Illustrative demo data',
    },
  };
}

export function resultsToFeatureCollection(results) {
  return {
    type: 'FeatureCollection',
    name: 'VanaDrishti AI — illustrative demo results',
    features: results.map(pointFeature),
    metadata: {
      isDemo: true,
      note: 'Illustrative sample detections. Not verified satellite analysis results.',
    },
  };
}

export function exportResultsGeoJSON(results, filename = 'vanadrishti-demo-results') {
  downloadJson(`${safeFilename(filename)}.geojson`, resultsToFeatureCollection(results));
}

export function exportBoundaryGeoJSON(boundary, filename = 'vanadrishti-study-area-boundary') {
  downloadJson(`${safeFilename(filename)}.geojson`, {
    type: 'FeatureCollection',
    name: 'VanaDrishti AI — illustrative study area boundary',
    features: [
      {
        ...boundary,
        properties: {
          ...boundary.properties,
          dataSource: 'Illustrative demo boundary',
        },
      },
    ],
  });
}
