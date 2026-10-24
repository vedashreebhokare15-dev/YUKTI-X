import { SAMPLE_ACTIVITIES, SAMPLE_TEAM_MEMBERS } from '../data/teamMembers';
import { readJson, STORAGE_KEYS, writeJson } from '../utils/storage';

export function getTeamMembers() {
  return readJson(STORAGE_KEYS.teamMembers, SAMPLE_TEAM_MEMBERS);
}

export function saveTeamMembers(members) {
  writeJson(STORAGE_KEYS.teamMembers, members);
  return members;
}

export function getActivities() {
  return readJson(STORAGE_KEYS.activities, SAMPLE_ACTIVITIES);
}

export function addActivity(activity) {
  const next = [
    {
      id: `activity-${Date.now()}`,
      timestamp: new Date().toISOString(),
      isDemo: true,
      ...activity,
    },
    ...getActivities(),
  ].slice(0, 30);
  writeJson(STORAGE_KEYS.activities, next);
  return next;
}
