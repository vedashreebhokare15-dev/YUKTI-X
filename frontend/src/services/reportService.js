import { SAMPLE_REPORTS } from '../data/reports';
import { readJson, STORAGE_KEYS, writeJson } from '../utils/storage';

export function getReports() {
  return readJson(STORAGE_KEYS.reports, SAMPLE_REPORTS);
}

export function addReport(report) {
  const next = [report, ...getReports()];
  writeJson(STORAGE_KEYS.reports, next);
  return next;
}

export function deleteReport(id) {
  const next = getReports().filter((report) => report.id !== id);
  writeJson(STORAGE_KEYS.reports, next);
  return next;
}

export function updateReport(id, patch) {
  const next = getReports().map((report) => (report.id === id ? { ...report, ...patch } : report));
  writeJson(STORAGE_KEYS.reports, next);
  return next;
}

export function addDownload(id) {
  const current = getReports();
  const target = current.find((report) => report.id === id);
  if (!target) return current;
  return updateReport(id, { downloads: (target.downloads || 0) + 1 });
}
