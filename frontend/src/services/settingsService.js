import { SAMPLE_NOTIFICATIONS } from '../data/notifications';
import { readJson, STORAGE_KEYS, writeJson } from '../utils/storage';

export function getNotifications() {
  return readJson(STORAGE_KEYS.notifications, SAMPLE_NOTIFICATIONS);
}

export function saveNotifications(notifications) {
  writeJson(STORAGE_KEYS.notifications, notifications);
  return notifications;
}

export function getProfile() {
  return readJson(STORAGE_KEYS.profile, {
    name: 'Project User',
    email: 'project.user@vanadrishti.demo',
    role: 'Project Owner',
    organization: 'VanaDrishti Conservation Lab',
    createdAt: '2024-01-12T09:00:00.000Z',
    status: 'Active',
    isDemo: true,
  });
}

export function getPreferences() {
  return readJson(STORAGE_KEYS.preferences, {
    mapView: 'satellite',
    defaultRegionId: 'region-mulshi',
    language: 'English',
    timeZone: 'Asia/Kolkata (IST)',
    autoSave: true,
  });
}

export function getNotificationPrefs() {
  return readJson(STORAGE_KEYS.notificationPrefs, {
    analysisComplete: true,
    newReports: true,
    systemUpdates: false,
    errorAlerts: true,
    emailNotifications: false,
  });
}
