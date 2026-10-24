import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getAnalysisRuns,
  getGeneratedResults,
  getRealRuns,
  persistDemoRun,
  persistRealRun,
} from '../services/analysisService';
import { checkApiHealth } from '../services/api';
import { fetchRegions } from '../services/backendService';
import {
  getReports as readReports,
  addReport as storeReport,
  deleteReport as dropReport,
  addDownload,
} from '../services/reportService';
import { getSavedAreas, removeSavedArea, saveArea } from '../services/studyAreaService';
import { getTeamMembers, saveTeamMembers, getActivities, addActivity } from '../services/teamService';
import {
  getNotificationPrefs,
  getNotifications,
  getPreferences,
  getProfile,
  saveNotifications,
} from '../services/settingsService';
import { readJson, writeJson, STORAGE_KEYS, eraseAppStorage } from '../utils/storage';
import ToastStack from '../components/common/Toast';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [profile, setProfile] = useState(() => getProfile());
  const [preferences, setPreferences] = useState(() => getPreferences());
  const [notificationPrefs, setNotificationPrefs] = useState(() => getNotificationPrefs());
  const [savedAreas, setSavedAreas] = useState(() => getSavedAreas());
  const [analysisRuns, setAnalysisRuns] = useState(() => getAnalysisRuns());
  const [generatedResults, setGeneratedResults] = useState(() => getGeneratedResults());
  const [reports, setReports] = useState(() => readReports());
  const [teamMembers, setTeamMembers] = useState(() => getTeamMembers());
  const [activities, setActivities] = useState(() => getActivities());
  const [notifications, setNotifications] = useState(() => getNotifications());
  const [toasts, setToasts] = useState([]);
  const [realRuns, setRealRuns] = useState(() => getRealRuns());
  const [backend, setBackend] = useState({
    configured: false,
    ready: false,
    regions: [],
    message: 'No backend URL was built into this bundle, so only demo data can be shown.',
    checked: false,
  });

  useEffect(() => {
    let cancelled = false;
    checkApiHealth().then(async (health) => {
      if (cancelled) return;
      const base = {
        configured: health.ok,
        ready: health.ready,
        message: health.message,
        checked: true,
      };
      if (!health.ready) {
        setBackend({ ...base, regions: [] });
        return;
      }
      try {
        setBackend({ ...base, regions: await fetchRegions(), message: health.message });
      } catch (error) {
        setBackend({ ...base, regions: [], message: `Regions could not be fetched: ${error.message}` });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = 'success', title, message }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
      setToasts((current) => [...current.slice(-3), { id, type, title, message }]);
      window.setTimeout(() => removeToast(id), 4800);
      return id;
    },
    [removeToast],
  );

  const addNotification = useCallback((notification) => {
    setNotifications((current) => {
      const next = [
        {
          id: `note-${Date.now()}`,
          createdAt: new Date().toISOString(),
          read: false,
          isDemo: true,
          ...notification,
        },
        ...current,
      ].slice(0, 24);
      saveNotifications(next);
      return next;
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((current) => {
      const next = current.map((notification) => ({ ...notification, read: true }));
      saveNotifications(next);
      return next;
    });
  }, []);

  const markNotificationRead = useCallback((id) => {
    setNotifications((current) => {
      const next = current.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification,
      );
      saveNotifications(next);
      return next;
    });
  }, []);

  const addActivityEntry = useCallback((entry) => {
    const next = addActivity(entry);
    setActivities(next);
    return next;
  }, []);

  const saveProfile = useCallback((nextProfile) => {
    const merged = { ...getProfile(), ...nextProfile };
    writeJson(STORAGE_KEYS.profile, merged);
    setProfile(merged);
    return merged;
  }, []);

  const savePreferences = useCallback((patch) => {
    const merged = { ...getPreferences(), ...patch };
    writeJson(STORAGE_KEYS.preferences, merged);
    setPreferences(merged);
    return merged;
  }, []);

  const saveNotificationPrefs = useCallback((patch) => {
    const merged = { ...getNotificationPrefs(), ...patch };
    writeJson(STORAGE_KEYS.notificationPrefs, merged);
    setNotificationPrefs(merged);
    return merged;
  }, []);

  const saveStudyArea = useCallback((area) => {
    const next = saveArea(area);
    setSavedAreas(next);
    return next;
  }, []);

  const deleteSavedArea = useCallback((id) => {
    const next = removeSavedArea(id);
    setSavedAreas(next);
    return next;
  }, []);

  const registerAnalysisRun = useCallback(
    (run, results) => {
      const persisted = persistDemoRun(run, results);
      setAnalysisRuns(persisted.runs);
      setGeneratedResults(persisted.results);
      addActivityEntry({
        type: 'analysis',
        text: `Demo analysis run completed for ${run.regionName}`,
        actor: profile.name,
      });
      if (notificationPrefs.analysisComplete) {
        addNotification({
          type: 'analysis',
          title: 'Demo analysis complete',
          message: `${run.regionName}: simulated run ${run.id} finished with ${run.findings} illustrative findings.`,
        });
      }
      return persisted;
    },
    [addActivityEntry, addNotification, notificationPrefs.analysisComplete, profile.name],
  );

  const registerRealRun = useCallback(
    (run) => {
      setRealRuns(persistRealRun(run));
      addActivityEntry({
        type: 'analysis',
        text: `Real Earth Engine run ${run.run_id} completed for ${run.provenance?.study_region || run.region}`,
        actor: profile.name,
      });
      if (notificationPrefs.analysisComplete) {
        addNotification({
          type: 'analysis',
          title: 'Analysis run finished',
          message: `Run ${run.run_id} returned measured Sentinel-2 evidence. Accuracy is still not measured.`,
        });
      }
      return run;
    },
    [addActivityEntry, addNotification, notificationPrefs.analysisComplete, profile.name],
  );

  const addReport = useCallback(
    (report) => {
      const next = storeReport(report);
      setReports(next);
      addActivityEntry({
        type: 'report',
        text: `${report.name} generated`,
        actor: profile.name,
      });
      if (notificationPrefs.newReports) {
        addNotification({
          type: 'report',
          title: 'New demo report generated',
          message: `${report.name} is available in the Reports library.`,
        });
      }
      return next;
    },
    [addActivityEntry, addNotification, notificationPrefs.newReports, profile.name],
  );

  const removeReport = useCallback((id) => {
    const next = dropReport(id);
    setReports(next);
    return next;
  }, []);

  const incrementReportDownload = useCallback((id) => {
    const next = addDownload(id);
    setReports(next);
    return next;
  }, []);

  const addTeamMember = useCallback(
    (member) => {
      const next = saveTeamMembers([...getTeamMembers(), member]);
      setTeamMembers(next);
      addActivityEntry({
        type: 'member',
        text: `${member.name} was added to the project with the ${member.role} role`,
        actor: profile.name,
      });
      return next;
    },
    [addActivityEntry, profile.name],
  );

  const updateTeamMember = useCallback(
    (member, activityText) => {
      const next = saveTeamMembers(
        getTeamMembers().map((item) => (item.id === member.id ? { ...item, ...member } : item)),
      );
      setTeamMembers(next);
      addActivityEntry({
        type: 'role',
        text: activityText,
        actor: profile.name,
      });
      return next;
    },
    [addActivityEntry, profile.name],
  );

  const removeTeamMember = useCallback(
    (id, name) => {
      const next = saveTeamMembers(getTeamMembers().filter((item) => item.id !== id));
      setTeamMembers(next);
      addActivityEntry({
        type: 'member',
        text: `${name} was removed from the project`,
        actor: profile.name,
      });
      return next;
    },
    [addActivityEntry, profile.name],
  );

  const resetDemoData = useCallback(() => {
    // Real runs are measurements from Earth Engine, not demo state, so they survive
    // a demo reset.
    const keptRuns = getRealRuns();
    eraseAppStorage();
    writeJson(STORAGE_KEYS.realRuns, keptRuns);
    setRealRuns(keptRuns);
    setProfile(getProfile());
    setPreferences(getPreferences());
    setNotificationPrefs(getNotificationPrefs());
    setSavedAreas(getSavedAreas());
    setAnalysisRuns(getAnalysisRuns());
    setGeneratedResults(getGeneratedResults());
    setReports(readJson(STORAGE_KEYS.reports, null) || readReports());
    setTeamMembers(getTeamMembers());
    setActivities(getActivities());
    setNotifications(getNotifications());
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const value = useMemo(
    () => ({
      profile,
      preferences,
      notificationPrefs,
      savedAreas,
      analysisRuns,
      generatedResults,
      reports,
      teamMembers,
      activities,
      notifications,
      realRuns,
      backend,
      unreadCount,
      toasts,
      showToast,
      removeToast,
      addNotification,
      markAllNotificationsRead,
      markNotificationRead,
      saveProfile,
      savePreferences,
      saveNotificationPrefs,
      saveStudyArea,
      deleteSavedArea,
      registerAnalysisRun,
      registerRealRun,
      addReport,
      removeReport,
      incrementReportDownload,
      addTeamMember,
      updateTeamMember,
      removeTeamMember,
      resetDemoData,
      addActivityEntry,
    }),
    [
      profile,
      preferences,
      notificationPrefs,
      savedAreas,
      analysisRuns,
      generatedResults,
      reports,
      teamMembers,
      activities,
      notifications,
      realRuns,
      backend,
      unreadCount,
      toasts,
      showToast,
      removeToast,
      addNotification,
      markAllNotificationsRead,
      markNotificationRead,
      saveProfile,
      savePreferences,
      saveNotificationPrefs,
      saveStudyArea,
      deleteSavedArea,
      registerAnalysisRun,
      registerRealRun,
      addReport,
      removeReport,
      incrementReportDownload,
      addTeamMember,
      updateTeamMember,
      removeTeamMember,
      resetDemoData,
      addActivityEntry,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onClose={removeToast} />
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
