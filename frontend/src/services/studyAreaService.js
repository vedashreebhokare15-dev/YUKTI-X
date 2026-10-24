import { SEED_SAVED_AREAS } from '../data/studyAreas';
import { readJson, STORAGE_KEYS, writeJson } from '../utils/storage';

export function getSavedAreas() {
  return readJson(STORAGE_KEYS.savedAreas, SEED_SAVED_AREAS);
}

export function saveArea(area) {
  const current = getSavedAreas();
  const existingIndex = current.findIndex(
    (item) => item.regionId === area.regionId && item.startDate === area.startDate && item.endDate === area.endDate,
  );
  let next;
  if (existingIndex >= 0) {
    next = current.map((item, index) => (index === existingIndex ? { ...item, ...area } : item));
  } else {
    next = [{ ...area, id: area.id || `saved-${Date.now()}`, isDemo: true }, ...current];
  }
  writeJson(STORAGE_KEYS.savedAreas, next);
  return next;
}

export function removeSavedArea(id) {
  const next = getSavedAreas().filter((item) => item.id !== id);
  writeJson(STORAGE_KEYS.savedAreas, next);
  return next;
}
