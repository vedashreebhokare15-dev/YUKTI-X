import { SAMPLE_RESULTS } from '../data/results';
import { getGeneratedResults } from './analysisService';

export function getResults() {
  const generated = getGeneratedResults();
  return [...generated, ...SAMPLE_RESULTS];
}

export function mergeResults(generated = []) {
  return [...generated, ...SAMPLE_RESULTS];
}

export const CLASS_ORDER = [
  'Likely Forest Loss',
  'Possible Forest Loss',
  'No Detected Loss',
  'Insufficient Evidence',
];

function areaOf(record) {
  const value = Number(record.areaKm2);
  return Number.isNaN(value) ? 0 : value;
}

// A report must add up to the records it prints, so every figure in the PDF and in the
// on-screen preview is derived here from the same rows rather than quoted from a
// separate summary table that the reader cannot check.
export function reportFacts(report) {
  const records = getResults().filter((record) => record.regionId === report.regionId);
  const classes = CLASS_ORDER.map((classification) => {
    const rows = records.filter((record) => record.classification === classification);
    return {
      classification,
      count: rows.length,
      areaKm2: rows.reduce((sum, record) => sum + areaOf(record), 0),
    };
  });
  const totalAreaKm2 = classes.reduce((sum, item) => sum + item.areaKm2, 0);
  const lossAreaKm2 = classes
    .filter((item) => item.classification.endsWith('Forest Loss'))
    .reduce((sum, item) => sum + item.areaKm2, 0);
  const confidences = records
    .map((record) => Number(record.confidence))
    .filter((value) => !Number.isNaN(value));
  return {
    records,
    classes,
    totalRecords: records.length,
    totalAreaKm2,
    lossAreaKm2,
    reviewCount: records.filter((record) => record.status !== 'Verified').length,
    topConfidence: confidences.length ? Math.max(...confidences) : null,
  };
}
