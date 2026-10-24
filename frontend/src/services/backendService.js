import { API_ENDPOINTS, RUN_TIMEOUT_MS, apiRequest, isApiConfigured } from './api';

// Everything in this module is a real answer from the Vanadristi backend or a thrown
// error. It has no fallback values: a number that did not come from Earth Engine
// must not appear on screen carrying its style.

export function backendConfigured() {
  return isApiConfigured;
}

export async function fetchRegions() {
  const payload = await apiRequest(API_ENDPOINTS.regions);
  return (payload.regions || []).map((region) => ({
    key: region.key,
    name: region.name,
    why: region.why,
    bounds: region.bounds,
    aoi: region.aoi,
    // The backend measures the box and decides whether one Earth Engine request can
    // finish it, so the page refuses a doomed run instead of hanging on one.
    area_km2: region.area_km2 === undefined ? null : region.area_km2,
    forcible: region.forcible !== false,
    defaults: region.defaults || {},
  }));
}

export async function runAnalysis({
  region,
  before,
  after,
  historyYears,
  useCloudProbability = true,
}) {
  return apiRequest(
    API_ENDPOINTS.run,
    {
      method: 'POST',
      timeoutMs: RUN_TIMEOUT_MS,
      body: JSON.stringify({
        region,
        before_start: before[0],
        before_end: before[1],
        after_start: after[0],
        after_end: after[1],
        history_years: historyYears,
        use_cloud_probability: useCloudProbability,
      }),
    },
  );
}

export async function inspectPoint(runId, lon, lat) {
  return apiRequest(
    API_ENDPOINTS.inspect,
    { method: 'POST', body: JSON.stringify({ run_id: runId, lon, lat }) },
  );
}

// Reads the file `scripts/train_reference_model.py` wrote. No Earth Engine call sits
// behind it, so the model page answers in milliseconds; a 404 is the backend saying no
// model has been trained and scored yet, which the page shows instead of a number.
export async function fetchModelReport() {
  return apiRequest(API_ENDPOINTS.model);
}

export function tileLayers(run) {
  const layers = (run && run.layers) || {};
  return Object.entries(layers).map(([name, layer]) => ({ name, ...layer }));
}

// The rule table's four output states, keyed exactly as forestguard/results.py
// CLASS_BY_CODE names them, so the app cannot invent a fifth class.
const CLASS_TEXT = {
  no_detected_loss: { label: 'No candidate loss', colour: '#2f9e6b' },
  possible_loss: { label: 'Possible vegetation decline', colour: '#e8912a' },
  likely_loss: { label: 'Candidate loss signal', colour: '#d7263d' },
  insufficient_evidence: { label: 'Insufficient evidence', colour: '#6b6f76' },
};

export function classRows(run) {
  const counts = (run && run.provenance && run.provenance.class_counts) || {};
  const hectares = (run && run.provenance && run.provenance.class_hectares) || {};
  return Object.entries(counts).map(([key, cells]) => ({
    key,
    label: (CLASS_TEXT[key] || { label: key }).label,
    colour: (CLASS_TEXT[key] || { colour: '#6b6f76' }).colour,
    cells,
    hectares: hectares[key] === undefined ? null : hectares[key],
  }));
}

export function qualityRows(run) {
  const quality = (run && run.quality) || {};
  return Object.entries(quality).map(([name, report]) => ({
    name,
    scenes_found: report.scenes_found,
    scenes_usable: report.scenes_usable,
    status: report.status,
    reportable: report.reportable,
    cloud_percentage: report.cloud_percentage === undefined ? null : report.cloud_percentage,
    coverage: report.coverage || null,
    window: report.start && report.end ? `${report.start} to ${report.end}` : null,
  }));
}

export function measurementGaps(run) {
  if (!run) return [];
  return [
    'Accuracy, precision, recall and false-positive rate: not measured. No labelled '
      + 'reference comparison has been run against these outputs yet.',
    'Confidence: the rule table reports an evidence state, not a probability, so no '
      + 'per-cell confidence value exists.',
    'Detection delay: not measured. It needs a known loss date to be late against.',
    'Boundaries: every figure covers 20 m analysis cells inside a coordinate box, not '
      + 'an official forest boundary.',
    run.provenance && run.provenance.do_not_publish_as
      ? `Must not be published as: ${run.provenance.do_not_publish_as}`
      : 'Must not be published as confirmed deforestation.',
  ];
}
