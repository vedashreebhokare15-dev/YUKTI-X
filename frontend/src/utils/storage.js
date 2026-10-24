const PREFIX = 'vanadrishti.';

export const STORAGE_KEYS = {
  profile: `${PREFIX}profile`,
  preferences: `${PREFIX}preferences`,
  notificationPrefs: `${PREFIX}notificationPrefs`,
  savedAreas: `${PREFIX}savedAreas`,
  analysisRuns: `${PREFIX}analysisRuns`,
  generatedResults: `${PREFIX}generatedResults`,
  reports: `${PREFIX}reports`,
  teamMembers: `${PREFIX}teamMembers`,
  activities: `${PREFIX}activities`,
  notifications: `${PREFIX}notifications`,
  realRuns: `${PREFIX}realRuns`,
};

export function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage may be unavailable */
  }
}

export function eraseAppStorage() {
  Object.values(STORAGE_KEYS).forEach((key) => removeStored(key));
}

export function getStorageFootprint() {
  let bytes = 0;
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      const value = window.localStorage.getItem(key);
      if (value) bytes += value.length * 2;
    });
  } catch {
    return { bytes: 0, kb: '0.0' };
  }
  return { bytes, kb: (bytes / 1024).toFixed(1) };
}
