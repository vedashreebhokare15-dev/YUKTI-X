import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  Database,
  Download,
  Eye,
  EyeOff,
  FileJson,
  HardDrive,
  Info,
  KeyRound,
  Laptop,
  Map,
  MapPin,
  Plug,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import FormField from '../components/common/FormField';
import DemoNotice from '../components/common/DemoNotice';
import ToggleSwitch from '../components/common/ToggleSwitch';
import ConfirmationModal from '../components/common/ConfirmationModal';
import StatusBadge from '../components/common/StatusBadge';
import ForestMap from '../components/maps/ForestMap';
import { useApp } from '../context/AppContext';
import { REGIONS, getRegionById } from '../data/studyAreas';
import { ROLE_OPTIONS } from '../data/teamMembers';
import {
  API_BASE_URL,
  API_ENDPOINTS,
  checkApiHealth,
  isApiConfigured,
} from '../services/api';
import { getInitials, formatDate, todayIso } from '../utils/formatters';
import { downloadJson } from '../utils/download';
import { getStorageFootprint } from '../utils/storage';

const TABS = [
  { id: 'account', label: 'Account', icon: UserRound },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'map', label: 'Map & Visualization', icon: Map },
  { id: 'data', label: 'Data & Integration', icon: Plug },
  { id: 'system', label: 'System', icon: Laptop },
];

const NOTIFICATION_OPTIONS = [
  {
    key: 'analysisComplete',
    label: 'Analysis Complete',
    help: 'In-app alert when a demo analysis workflow finishes.',
  },
  {
    key: 'newReports',
    label: 'New Reports',
    help: 'Notice when a demonstration report is added to the library.',
  },
  {
    key: 'systemUpdates',
    label: 'System Updates',
    help: 'Product and maintenance messages. Service-driven updates require a backend.',
  },
  {
    key: 'errorAlerts',
    label: 'Error Alerts',
    help: 'Warnings for failed demo workflows or invalid configuration.',
  },
  {
    key: 'emailNotifications',
    label: 'Email Notifications',
    help: 'Saved as a preference only. Email delivery requires a connected notification service.',
  },
];

const ENDPOINT_ROWS = [
  { method: 'GET', path: API_ENDPOINTS.health },
  { method: 'GET', path: API_ENDPOINTS.studyAreas },
  { method: 'POST', path: API_ENDPOINTS.analysisRun },
  { method: 'GET', path: API_ENDPOINTS.analysisRuns },
  { method: 'GET', path: API_ENDPOINTS.results },
  { method: 'GET', path: API_ENDPOINTS.reports },
  { method: 'POST', path: API_ENDPOINTS.generateReport },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PasswordField({ id, label, value, onChange, visible, onToggle, error }) {
  return (
    <FormField label={label} htmlFor={id} required error={error}>
      <div className="password-wrap">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          className="input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? 'true' : undefined}
          autoComplete="new-password"
        />
        <button
          type="button"
          className="password-toggle"
          onClick={onToggle}
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </FormField>
  );
}

export default function Settings() {
  const {
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
    saveProfile,
    savePreferences,
    saveNotificationPrefs,
    resetDemoData,
    showToast,
  } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab = TABS.some((tab) => tab.id === requestedTab) ? requestedTab : 'account';

  const [profileForm, setProfileForm] = useState({
    name: profile.name,
    email: profile.email,
    role: profile.role,
    organization: profile.organization,
  });
  const [profileErrors, setProfileErrors] = useState({});

  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordVisible, setPasswordVisible] = useState({
    current: false,
    next: false,
    confirm: false,
  });

  const [preferencesForm, setPreferencesForm] = useState({ ...preferences });
  const [preferencesErrors, setPreferencesErrors] = useState({});
  const [notificationForm, setNotificationForm] = useState({ ...notificationPrefs });

  const [backendResult, setBackendResult] = useState(null);
  const [checkingBackend, setCheckingBackend] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    setProfileForm({
      name: profile.name,
      email: profile.email,
      role: profile.role,
      organization: profile.organization,
    });
  }, [profile]);

  useEffect(() => {
    setPreferencesForm({ ...preferences });
  }, [preferences]);

  useEffect(() => {
    setNotificationForm({ ...notificationPrefs });
  }, [notificationPrefs]);

  const storageFootprint = getStorageFootprint();
  const previewRegion = getRegionById(preferencesForm.defaultRegionId) || REGIONS[0];

  const userDataPayload = useMemo(
    () => ({
      app: 'VanaDrishti AI',
      kind: 'demo-user-data-export',
      exportedAt: new Date().toISOString(),
      isDemo: true,
      note: 'Illustrative browser-local demo data. No server account data is included.',
      profile,
      preferences,
      notificationPrefs,
      savedAreas,
      activities,
    }),
    [profile, preferences, notificationPrefs, savedAreas, activities],
  );

  const backupPayload = useMemo(
    () => ({
      app: 'VanaDrishti AI',
      kind: 'demo-backup',
      exportedAt: new Date().toISOString(),
      isDemo: true,
      note: 'Backup of illustrative browser-local demo data. Not satellite data or a server backup.',
      data: {
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
      },
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
    ],
  );

  const selectTab = (tabId) => {
    setSearchParams({ tab: tabId }, { replace: true });
  };

  const handleSaveProfile = (event) => {
    event.preventDefault();
    const next = {};
    if (!profileForm.name.trim() || profileForm.name.trim().length < 2) {
      next.name = 'Enter at least two characters.';
    }
    if (!profileForm.email.trim()) {
      next.email = 'Enter an email address.';
    } else if (!EMAIL_PATTERN.test(profileForm.email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    if (!ROLE_OPTIONS.includes(profileForm.role)) next.role = 'Select a valid role.';
    if (!profileForm.organization.trim()) next.organization = 'Enter an organization.';
    setProfileErrors(next);
    if (Object.keys(next).length > 0) return;

    saveProfile({
      name: profileForm.name.trim(),
      email: profileForm.email.trim(),
      role: profileForm.role,
      organization: profileForm.organization.trim(),
    });
    showToast({
      type: 'success',
      title: 'Demo profile saved',
      message: 'Your profile details were stored locally in this browser.',
    });
  };

  const handleUpdatePassword = (event) => {
    event.preventDefault();
    const next = {};
    if (!passwordForm.current) next.current = 'Enter the current password.';
    if (!passwordForm.next) {
      next.next = 'Enter a new password.';
    } else if (passwordForm.next.length < 8) {
      next.next = 'Use at least 8 characters for the demo validation.';
    } else if (passwordForm.next === passwordForm.current) {
      next.next = 'The new password must differ from the current password.';
    }
    if (!passwordForm.confirm) {
      next.confirm = 'Confirm the new password.';
    } else if (passwordForm.confirm !== passwordForm.next) {
      next.confirm = 'The passwords do not match.';
    }
    setPasswordErrors(next);
    if (Object.keys(next).length > 0) return;

    setPasswordForm({ current: '', next: '', confirm: '' });
    showToast({
      type: 'warning',
      title: 'Password unchanged — demo mode',
      message:
        'No password was changed. Real authentication requires a connected backend; this form validates input only.',
    });
  };

  const handleSavePreferences = (event) => {
    event.preventDefault();
    const next = {};
    if (!['satellite', 'streets'].includes(preferencesForm.mapView)) {
      next.mapView = 'Select a map view.';
    }
    if (!getRegionById(preferencesForm.defaultRegionId)) {
      next.defaultRegionId = 'Select a default analysis region.';
    }
    setPreferencesErrors(next);
    if (Object.keys(next).length > 0) return;

    savePreferences({
      mapView: preferencesForm.mapView,
      defaultRegionId: preferencesForm.defaultRegionId,
      language: preferencesForm.language,
      timeZone: preferencesForm.timeZone,
      autoSave: preferencesForm.autoSave,
    });
    showToast({
      type: 'success',
      title: 'Preferences saved',
      message: 'Map view, default region and display preferences were stored locally.',
    });
  };

  const handleSaveNotifications = () => {
    saveNotificationPrefs({ ...notificationForm });
    showToast({
      type: 'success',
      title: 'Notification preferences saved',
      message: 'In-app delivery honours these toggles. Email requires a connected service.',
    });
  };

  const handleBackup = () => {
    downloadJson(`vanadrishti-demo-backup-${todayIso()}.json`, backupPayload);
    showToast({
      type: 'success',
      title: 'Demo backup downloaded',
      message: 'The JSON file contains browser-local demo records only.',
    });
  };

  const handleExportUserData = () => {
    downloadJson(`vanadrishti-user-data-${todayIso()}.json`, userDataPayload);
    showToast({
      type: 'success',
      title: 'User data exported',
      message: 'Profile, preferences and saved demo study areas were exported as JSON.',
    });
  };

  const handleCheckBackend = async () => {
    setCheckingBackend(true);
    setBackendResult(null);
    const result = await checkApiHealth();
    setBackendResult(result);
    setCheckingBackend(false);
    showToast({
      type: result.ok ? 'success' : 'info',
      title: result.ok ? 'Backend responded' : 'Backend not connected',
      message: result.message,
    });
  };

  const handleDeleteAccount = () => {
    setDeleteAccountOpen(false);
    showToast({
      type: 'warning',
      title: 'No account was deleted',
      message:
        'Account deletion needs backend authentication. This demo has not removed your profile or local data.',
    });
  };

  const handleResetDemo = () => {
    resetDemoData();
    setResetOpen(false);
    setBackendResult(null);
    showToast({
      type: 'success',
      title: 'Demo data restored',
      message: 'Local demo records were cleared and the seed dataset restored.',
    });
  };

  const tabPanel = () => {
    if (activeTab === 'account') {
      return (
        <div className="settings-layout" role="tabpanel" id="settings-panel-account">
          <div className="settings-main">
            <section className="card" aria-labelledby="account-settings-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="account-settings-title">
                    <UserRound size={16} aria-hidden="true" />
                    Account Settings
                  </h2>
                  <p className="card-subtitle">Manage the demonstration profile</p>
                </div>
                <span className="chip">Local demo</span>
              </div>
              <form onSubmit={handleSaveProfile}>
                <div className="card-body">
                  <div className="profile-head">
                    <span className="user-avatar lg" aria-hidden="true">
                      {getInitials(profileForm.name || profile.name)}
                    </span>
                    <div className="profile-head-copy">
                      <h3>{profileForm.name || profile.name}</h3>
                      <p>{profileForm.role} · demonstration account</p>
                      <span className="badge badge-info">
                        <span className="dot" aria-hidden="true" />
                        No real authentication
                      </span>
                    </div>
                  </div>

                  <div className="form-grid">
                    <FormField
                      label="Full Name"
                      htmlFor="settings-name"
                      required
                      error={profileErrors.name}
                    >
                      <input
                        id="settings-name"
                        type="text"
                        className="input"
                        value={profileForm.name}
                        onChange={(event) => {
                          setProfileForm((current) => ({ ...current, name: event.target.value }));
                          setProfileErrors((current) => ({ ...current, name: undefined }));
                        }}
                      />
                    </FormField>
                    <FormField
                      label="Email Address"
                      htmlFor="settings-email"
                      required
                      error={profileErrors.email}
                    >
                      <input
                        id="settings-email"
                        type="email"
                        className="input"
                        value={profileForm.email}
                        onChange={(event) => {
                          setProfileForm((current) => ({ ...current, email: event.target.value }));
                          setProfileErrors((current) => ({ ...current, email: undefined }));
                        }}
                      />
                    </FormField>
                    <FormField label="Role" htmlFor="settings-role" required error={profileErrors.role}>
                      <select
                        id="settings-role"
                        className="select"
                        value={profileForm.role}
                        onChange={(event) => {
                          setProfileForm((current) => ({ ...current, role: event.target.value }));
                          setProfileErrors((current) => ({ ...current, role: undefined }));
                        }}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField
                      label="Organization"
                      htmlFor="settings-organization"
                      required
                      error={profileErrors.organization}
                    >
                      <input
                        id="settings-organization"
                        type="text"
                        className="input"
                        value={profileForm.organization}
                        onChange={(event) => {
                          setProfileForm((current) => ({
                            ...current,
                            organization: event.target.value,
                          }));
                          setProfileErrors((current) => ({ ...current, organization: undefined }));
                        }}
                      />
                    </FormField>
                  </div>

                  <div className="form-actions" style={{ marginTop: 14 }}>
                    <button type="submit" className="btn btn-primary">
                      <Save size={14} aria-hidden="true" />
                      Save Changes
                    </button>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Stored in this browser only.
                    </span>
                  </div>
                </div>
              </form>
            </section>

            <section className="card" aria-labelledby="change-password-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="change-password-title">
                    <ShieldCheck size={16} aria-hidden="true" />
                    Change Password
                  </h2>
                  <p className="card-subtitle">
                    Input validation preview — no password is actually changed
                  </p>
                </div>
                <span className="chip warning">Demo only</span>
              </div>
              <form onSubmit={handleUpdatePassword}>
                <div className="card-body">
                  <PasswordField
                    id="settings-current-password"
                    label="Current Password"
                    value={passwordForm.current}
                    onChange={(value) => {
                      setPasswordForm((current) => ({ ...current, current: value }));
                      setPasswordErrors((current) => ({ ...current, current: undefined }));
                    }}
                    visible={passwordVisible.current}
                    onToggle={() =>
                      setPasswordVisible((current) => ({ ...current, current: !current.current }))
                    }
                    error={passwordErrors.current}
                  />
                  <div className="form-grid" style={{ marginTop: 12 }}>
                    <PasswordField
                      id="settings-new-password"
                      label="New Password"
                      value={passwordForm.next}
                      onChange={(value) => {
                        setPasswordForm((current) => ({ ...current, next: value }));
                        setPasswordErrors((current) => ({ ...current, next: undefined }));
                      }}
                      visible={passwordVisible.next}
                      onToggle={() =>
                        setPasswordVisible((current) => ({ ...current, next: !current.next }))
                      }
                      error={passwordErrors.next}
                    />
                    <PasswordField
                      id="settings-confirm-password"
                      label="Confirm New Password"
                      value={passwordForm.confirm}
                      onChange={(value) => {
                        setPasswordForm((current) => ({ ...current, confirm: value }));
                        setPasswordErrors((current) => ({ ...current, confirm: undefined }));
                      }}
                      visible={passwordVisible.confirm}
                      onToggle={() =>
                        setPasswordVisible((current) => ({
                          ...current,
                          confirm: !current.confirm,
                        }))
                      }
                      error={passwordErrors.confirm}
                    />
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <DemoNotice>
                      Passwords are never stored or transmitted by this demo. A secure
                      authentication backend is required to change real credentials.
                    </DemoNotice>
                  </div>
                  <div className="form-actions" style={{ marginTop: 12 }}>
                    <button type="submit" className="btn btn-primary">
                      Update Password
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setPasswordForm({ current: '', next: '', confirm: '' });
                        setPasswordErrors({});
                      }}
                    >
                      Clear fields
                    </button>
                  </div>
                </div>
              </form>
            </section>
          </div>

          <div className="settings-stack">
            <section className="card" aria-labelledby="account-overview-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="account-overview-title">
                    Account Overview
                  </h2>
                  <p className="card-subtitle">Demonstration identity</p>
                </div>
              </div>
              <div className="card-body">
                <div className="account-overview-list">
                  <div className="account-overview-row">
                    <span className="k">Name</span>
                    <span className="v">{profile.name}</span>
                  </div>
                  <div className="account-overview-row">
                    <span className="k">Email</span>
                    <span className="v">{profile.email}</span>
                  </div>
                  <div className="account-overview-row">
                    <span className="k">Role</span>
                    <span className="v">{profile.role}</span>
                  </div>
                  <div className="account-overview-row">
                    <span className="k">Organization</span>
                    <span className="v">{profile.organization}</span>
                  </div>
                  <div className="account-overview-row">
                    <span className="k">Account Created</span>
                    <span className="v">{formatDate(profile.createdAt)}</span>
                  </div>
                  <div className="account-overview-row">
                    <span className="k">Account Status</span>
                    <span className="v">
                      <StatusBadge value={profile.status} />
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <DemoNotice>
                    Generic demo profile. It is not connected to a real identity provider.
                  </DemoNotice>
                </div>
              </div>
            </section>

            <section className="card" aria-labelledby="quick-actions-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="quick-actions-title">
                    Quick Actions
                  </h2>
                  <p className="card-subtitle">Local tools and demo safeguards</p>
                </div>
              </div>
              <div className="card-body">
                <div className="quick-actions-grid">
                  <button
                    type="button"
                    className="quick-action-btn"
                    onClick={() => {
                      selectTab('data');
                      showToast({
                        type: 'info',
                        title: 'Integration settings opened',
                        message: 'API credentials belong on the backend; this demo has no stored keys.',
                      });
                    }}
                  >
                    <KeyRound size={16} aria-hidden="true" />
                    Manage API Keys
                  </button>
                  <button
                    type="button"
                    className="quick-action-btn"
                    onClick={handleBackup}
                  >
                    <Database size={16} aria-hidden="true" />
                    Backup Data
                  </button>
                  <button
                    type="button"
                    className="quick-action-btn"
                    onClick={handleExportUserData}
                  >
                    <FileJson size={16} aria-hidden="true" />
                    Export User Data
                  </button>
                  <button
                    type="button"
                    className="quick-action-btn danger"
                    onClick={() => setDeleteAccountOpen(true)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Delete Account
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      );
    }

    if (activeTab === 'notifications') {
      return (
        <div className="settings-layout" role="tabpanel" id="settings-panel-notifications">
          <div className="settings-main">
            <section className="card" aria-labelledby="notification-settings-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="notification-settings-title">
                    <Bell size={16} aria-hidden="true" />
                    Notification Settings
                  </h2>
                  <p className="card-subtitle">
                    Choose which in-app alerts this demo workspace should create
                  </p>
                </div>
                <span className="chip">Stored locally</span>
              </div>
              <div className="card-body">
                {NOTIFICATION_OPTIONS.map((option) => (
                  <div className="toggle-row" key={option.key}>
                    <div className="toggle-copy">
                      <span className="toggle-label">{option.label}</span>
                      <p className="toggle-help">{option.help}</p>
                    </div>
                    <ToggleSwitch
                      checked={Boolean(notificationForm[option.key])}
                      onChange={(checked) =>
                        setNotificationForm((current) => ({ ...current, [option.key]: checked }))
                      }
                      label={option.label}
                    />
                  </div>
                ))}
                <div style={{ marginTop: 14 }}>
                  <DemoNotice>
                    Actual email or push delivery requires a connected notification service. These
                    toggles change local demo behaviour only.
                  </DemoNotice>
                </div>
                <div className="form-actions" style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveNotifications}
                  >
                    <Save size={14} aria-hidden="true" />
                    Save Notification Preferences
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="settings-stack">
            <section className="card" aria-labelledby="delivery-channels-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="delivery-channels-title">
                    Delivery Channels
                  </h2>
                  <p className="card-subtitle">Current demo capabilities</p>
                </div>
              </div>
              <div className="card-body">
                <div className="integration-row">
                  <div className="integration-copy">
                    <div className="integration-title">In-app notifications</div>
                    <p className="integration-desc">
                      Shown in the header notification panel and stored locally.
                    </p>
                  </div>
                  <span className="badge badge-success">
                    <span className="dot" aria-hidden="true" />
                    Active
                  </span>
                </div>
                <div className="integration-row">
                  <div className="integration-copy">
                    <div className="integration-title">Email delivery</div>
                    <p className="integration-desc">
                      Requires a notification backend and verified sender.
                    </p>
                  </div>
                  <span className="badge badge-warning">
                    <span className="dot" aria-hidden="true" />
                    Backend required
                  </span>
                </div>
                <div className="integration-row">
                  <div className="integration-copy">
                    <div className="integration-title">Push notifications</div>
                    <p className="integration-desc">
                      Not implemented in this frontend demonstration.
                    </p>
                  </div>
                  <span className="badge badge-neutral">
                    <span className="dot" aria-hidden="true" />
                    Not available
                  </span>
                </div>
              </div>
            </section>

            <section className="card" aria-labelledby="notification-summary-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="notification-summary-title">
                    Current Choices
                  </h2>
                  <p className="card-subtitle">Unsaved changes are shown here</p>
                </div>
              </div>
              <div className="card-body">
                <div className="account-overview-list">
                  {NOTIFICATION_OPTIONS.map((option) => (
                    <div className="account-overview-row" key={option.key}>
                      <span className="k">{option.label}</span>
                      <span className="v">{notificationForm[option.key] ? 'On' : 'Off'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      );
    }

    if (activeTab === 'map') {
      return (
        <div className="settings-layout" role="tabpanel" id="settings-panel-map">
          <div className="settings-main">
            <section className="card" aria-labelledby="application-preferences-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="application-preferences-title">
                    <Map size={16} aria-hidden="true" />
                    Application Preferences
                  </h2>
                  <p className="card-subtitle">Defaults for maps, study areas and display</p>
                </div>
                <span className="chip">Local</span>
              </div>
              <form onSubmit={handleSavePreferences}>
                <div className="card-body">
                  <div className="form-grid">
                    <FormField
                      label="Default Map View"
                      htmlFor="settings-map-view"
                      error={preferencesErrors.mapView}
                    >
                      <select
                        id="settings-map-view"
                        className="select"
                        value={preferencesForm.mapView}
                        onChange={(event) => {
                          setPreferencesForm((current) => ({
                            ...current,
                            mapView: event.target.value,
                          }));
                          setPreferencesErrors((current) => ({ ...current, mapView: undefined }));
                        }}
                      >
                        <option value="satellite">Satellite — Esri World Imagery</option>
                        <option value="streets">Map — OpenStreetMap</option>
                      </select>
                    </FormField>
                    <FormField
                      label="Default Analysis Region"
                      htmlFor="settings-default-region"
                      error={preferencesErrors.defaultRegionId}
                    >
                      <select
                        id="settings-default-region"
                        className="select"
                        value={preferencesForm.defaultRegionId}
                        onChange={(event) => {
                          setPreferencesForm((current) => ({
                            ...current,
                            defaultRegionId: event.target.value,
                          }));
                          setPreferencesErrors((current) => ({
                            ...current,
                            defaultRegionId: undefined,
                          }));
                        }}
                      >
                        {REGIONS.map((region) => (
                          <option key={region.id} value={region.id}>
                            {region.name} — {region.state}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Language" htmlFor="settings-language">
                      <select
                        id="settings-language"
                        className="select"
                        value={preferencesForm.language}
                        onChange={(event) =>
                          setPreferencesForm((current) => ({
                            ...current,
                            language: event.target.value,
                          }))
                        }
                      >
                        <option value="English">English</option>
                        <option value="Hindi">Hindi (demo preference)</option>
                        <option value="Marathi">Marathi (demo preference)</option>
                      </select>
                    </FormField>
                    <FormField label="Time Zone" htmlFor="settings-timezone">
                      <select
                        id="settings-timezone"
                        className="select"
                        value={preferencesForm.timeZone}
                        onChange={(event) =>
                          setPreferencesForm((current) => ({
                            ...current,
                            timeZone: event.target.value,
                          }))
                        }
                      >
                        <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST)</option>
                        <option value="UTC">UTC</option>
                        <option value="Asia/Dubai (GST)">Asia/Dubai (GST)</option>
                      </select>
                    </FormField>
                  </div>

                  <div className="toggle-row" style={{ marginTop: 6 }}>
                    <div className="toggle-copy">
                      <span className="toggle-label">Auto Save</span>
                      <p className="toggle-help">
                        Remember unsaved map and filter choices between pages in this browser.
                      </p>
                    </div>
                    <ToggleSwitch
                      checked={Boolean(preferencesForm.autoSave)}
                      onChange={(checked) =>
                        setPreferencesForm((current) => ({ ...current, autoSave: checked }))
                      }
                      label="Auto Save"
                    />
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <DemoNotice>
                      Map view and default region are applied on supported pages. Language and time
                      zone are saved preferences only — interface copy and date formatting remain in
                      English and local browser time for this demo.
                    </DemoNotice>
                  </div>

                  <div className="form-actions" style={{ marginTop: 12 }}>
                    <button type="submit" className="btn btn-primary">
                      <Save size={14} aria-hidden="true" />
                      Save Preferences
                    </button>
                  </div>
                </div>
              </form>
            </section>
          </div>

          <div className="settings-stack">
            <section className="card" aria-labelledby="map-preview-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="map-preview-title">
                    <MapPin size={16} aria-hidden="true" />
                    Map Preview
                  </h2>
                  <p className="card-subtitle">Preview the selected map style and region</p>
                </div>
              </div>
              <div className="map-card-body">
                <ForestMap
                  key={`${preferencesForm.mapView}-${preferencesForm.defaultRegionId}`}
                  center={previewRegion.center}
                  zoom={9}
                  boundary={previewRegion.boundary}
                  forestPatches={previewRegion.forestPatches}
                  markers={[]}
                  showBoundary
                  showForestCover
                  showLoss={false}
                  showControls={false}
                  showLegend={false}
                  showSampleLabel={false}
                  defaultBasemap={preferencesForm.mapView}
                  height={230}
                />
              </div>
              <div className="card-body" style={{ paddingTop: 12 }}>
                <div className="account-overview-list">
                  <div className="account-overview-row">
                    <span className="k">Region</span>
                    <span className="v">{previewRegion.name}</span>
                  </div>
                  <div className="account-overview-row">
                    <span className="k">Map view</span>
                    <span className="v">
                      {preferencesForm.mapView === 'satellite'
                        ? 'Satellite (Esri World Imagery)'
                        : 'Map (OpenStreetMap)'}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <DemoNotice>
                    The preview boundary is illustrative. Map tiles are provided by their respective
                    services with attribution.
                  </DemoNotice>
                </div>
              </div>
            </section>
          </div>
        </div>
      );
    }

    if (activeTab === 'data') {
      return (
        <div className="settings-layout" role="tabpanel" id="settings-panel-data">
          <div className="settings-main">
            <section className="card" aria-labelledby="backend-integration-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="backend-integration-title">
                    <Plug size={16} aria-hidden="true" />
                    Backend Integration
                  </h2>
                  <p className="card-subtitle">Contract for the future Flask or FastAPI service</p>
                </div>
                <span className={`badge ${isApiConfigured ? 'badge-success' : 'badge-neutral'}`}>
                  <span className="dot" aria-hidden="true" />
                  {isApiConfigured ? 'Configured' : 'Not configured'}
                </span>
              </div>
              <div className="card-body">
                <div className="integration-row">
                  <div className="integration-copy">
                    <div className="integration-title">API base URL</div>
                    <p className="integration-desc">
                      Set <code>VITE_API_BASE_URL</code> at build time to point the service layer at a
                      backend.
                    </p>
                    <div className="endpoint-list">
                      <div className="endpoint-row">
                        <span className="endpoint-method">URL</span>
                        {API_BASE_URL || 'Not configured — demo data in use'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCheckBackend}
                    disabled={checkingBackend}
                  >
                    {checkingBackend ? <span className="spinner" aria-hidden="true" /> : null}
                    Check Backend
                  </button>
                </div>

                {backendResult && (
                  <div
                    className="settings-note"
                    style={{
                      marginTop: 10,
                      borderColor: backendResult.ok ? 'var(--green-100)' : 'var(--border)',
                      background: backendResult.ok ? 'var(--mint)' : '#f8fbfa',
                    }}
                    role="status"
                  >
                    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                      {backendResult.ok ? (
                        <CheckCircle2 size={14} aria-hidden="true" />
                      ) : (
                        <Info size={14} aria-hidden="true" />
                      )}
                      <span>{backendResult.message}</span>
                    </div>
                  </div>
                )}

                <div className="integration-row">
                  <div className="integration-copy">
                    <div className="integration-title">Processing data source</div>
                    <p className="integration-desc">
                      Optical Sentinel-2 Level-2A surface reflectance. Sentinel-1 radar is not used.
                    </p>
                  </div>
                  <span className="chip neutral">Optical</span>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="integration-title">Proposed API endpoints</div>
                  <div className="endpoint-list">
                    {ENDPOINT_ROWS.map((endpoint) => (
                      <div className="endpoint-row" key={`${endpoint.method}-${endpoint.path}`}>
                        <span className="endpoint-method">{endpoint.method}</span>
                        {endpoint.path}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <DemoNotice>
                    Endpoints are a frontend contract only. They are not live routes until a backend
                    implements them. No satellite files are fetched by this demo.
                  </DemoNotice>
                </div>
              </div>
            </section>

            <section className="card" aria-labelledby="data-management-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="data-management-title">
                    <HardDrive size={16} aria-hidden="true" />
                    Data Management
                  </h2>
                  <p className="card-subtitle">Browser-local demo records</p>
                </div>
              </div>
              <div className="card-body">
                <div className="storage-bar-wrap">
                  <div className="storage-meta">
                    <span>Estimated local storage usage</span>
                    <span>{storageFootprint.kb} KB</span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(2, (storageFootprint.bytes / (5 * 1024 * 1024)) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted-soft)', marginTop: 5 }}>
                    Bars are scaled to an illustrative 5 MB budget, not a storage quota.
                  </div>
                </div>

                <div className="integration-row">
                  <div className="integration-copy">
                    <div className="integration-title">Backup all demo records</div>
                    <p className="integration-desc">
                      Downloads one JSON snapshot of saved areas, runs, results, reports and team data.
                    </p>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleBackup}>
                    <Download size={13} aria-hidden="true" />
                    Backup Data
                  </button>
                </div>
                <div className="integration-row">
                  <div className="integration-copy">
                    <div className="integration-title">Export user data</div>
                    <p className="integration-desc">
                      Exports the demo profile, preferences and saved study areas.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleExportUserData}
                  >
                    <FileJson size={13} aria-hidden="true" />
                    Export User Data
                  </button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <DemoNotice>
                    Everything remains in this browser. Backups are not encrypted and must not contain
                    sensitive information. Server-side retention and export policies belong to the
                    backend.
                  </DemoNotice>
                </div>
              </div>
            </section>
          </div>

          <div className="settings-stack">
            <section className="card" aria-labelledby="api-keys-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="api-keys-title">
                    <KeyRound size={16} aria-hidden="true" />
                    API Keys
                  </h2>
                  <p className="card-subtitle">Not stored in the frontend</p>
                </div>
              </div>
              <div className="card-body">
                <div className="settings-note">
                  No API keys are configured in this demo. Production satellite or model credentials
                  must be held server-side in the Flask/FastAPI backend and must never be exposed in
                  Vite environment variables.
                </div>
                <div className="account-overview-list" style={{ marginTop: 12 }}>
                  <div className="account-overview-row">
                    <span className="k">Frontend keys</span>
                    <span className="v">None</span>
                  </div>
                  <div className="account-overview-row">
                    <span className="k">Backend configured</span>
                    <span className="v">{isApiConfigured ? 'Base URL set' : 'No'}</span>
                  </div>
                  <div className="account-overview-row">
                    <span className="k">Recommended</span>
                    <span className="v">Server-side secret store</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="card" aria-labelledby="integration-note-title">
              <div className="card-head">
                <div>
                  <h2 className="card-title" id="integration-note-title">
                    Integration Notes
                  </h2>
                  <p className="card-subtitle">Demo boundaries</p>
                </div>
              </div>
              <div className="card-body">
                <div className="method-note">
                  <Info size={15} aria-hidden="true" />
                  <span>
                    The dashboard, analysis workflow and results are simulated locally. Once backend
                    routes exist, the service layer can replace the demo data with real Sentinel-2
                    processing outputs.
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      );
    }

    return (
      <div className="settings-layout" role="tabpanel" id="settings-panel-system">
        <div className="settings-main">
          <section className="card" aria-labelledby="system-information-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="system-information-title">
                  <Laptop size={16} aria-hidden="true" />
                  System Information
                </h2>
                <p className="card-subtitle">Current demonstration environment</p>
              </div>
              <span className="chip">Demo build</span>
            </div>
            <div className="card-body">
              <div className="account-overview-list">
                <div className="account-overview-row">
                  <span className="k">Application</span>
                  <span className="v">VanaDrishti AI</span>
                </div>
                <div className="account-overview-row">
                  <span className="k">Version</span>
                  <span className="v">1.0.0 — frontend demo</span>
                </div>
                <div className="account-overview-row">
                  <span className="k">Frontend stack</span>
                  <span className="v">React 18, Vite, React Router, Leaflet, Recharts</span>
                </div>
                <div className="account-overview-row">
                  <span className="k">Data source</span>
                  <span className="v">Illustrative browser-local fixtures</span>
                </div>
                <div className="account-overview-row">
                  <span className="k">Processing backend</span>
                  <span className="v">Not connected</span>
                </div>
                <div className="account-overview-row">
                  <span className="k">Authentication</span>
                  <span className="v">Demo profile — no real accounts</span>
                </div>
                <div className="account-overview-row">
                  <span className="k">Intended imagery</span>
                  <span className="v">Sentinel-2 Level-2A optical</span>
                </div>
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="maintenance-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="maintenance-title">
                  <RotateCcw size={16} aria-hidden="true" />
                  Demo Workspace Maintenance
                </h2>
                <p className="card-subtitle">Restore the original sample records</p>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                Resetting removes saved study areas, generated demo runs and results, report and team
                changes, and restores the seed demonstration dataset. The profile name and preferences
                return to their defaults.
              </p>
              <div className="form-actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setResetOpen(true)}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  Reset Demo Data
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="settings-stack">
          <section className="card" aria-labelledby="demo-limitations-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="demo-limitations-title">
                  Demo Limitations
                </h2>
                <p className="card-subtitle">What this build does not do</p>
              </div>
            </div>
            <div className="card-body">
              <div className="toggle-help" style={{ display: 'grid', gap: 8, fontSize: 11.5 }}>
                <span>• No real user account or password changes.</span>
                <span>• No Sentinel-2 downloads or model inference.</span>
                <span>• No email or push notification delivery.</span>
                <span>• No authoritative forest boundaries or measured results.</span>
              </div>
              <div style={{ marginTop: 12 }}>
                <DemoNotice>
                  All findings, reports and maps in this workspace are illustrative demonstrations.
                </DemoNotice>
              </div>
            </div>
          </section>

          <section className="card" aria-labelledby="support-title">
            <div className="card-head">
              <div>
                <h2 className="card-title" id="support-title">
                  Need a real deployment?
                </h2>
                <p className="card-subtitle">Connect the processing service</p>
              </div>
            </div>
            <div className="card-body">
              <div className="method-note">
                <ShieldCheck size={15} aria-hidden="true" />
                <span>
                  Configure <code>VITE_API_BASE_URL</code>, implement the documented endpoints and move
                  credentials and model execution to the backend.
                </span>
              </div>
              <div className="form-actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => selectTab('data')}
                >
                  Open integration settings
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage your account, application preferences, and system configurations."
        meta={
          <>
            <span className="badge badge-info">
              <span className="dot" aria-hidden="true" />
              Demo workspace
            </span>
            <span className="chip neutral">Preferences stored in this browser</span>
          </>
        }
      />

      <div className="card settings-tabs-card">
        <div className="tabs" role="tablist" aria-label="Settings sections">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`settings-tab-${tab.id}`}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`.trim()}
                aria-selected={activeTab === tab.id}
                aria-controls={`settings-panel-${tab.id}`}
                onClick={() => selectTab(tab.id)}
              >
                <Icon size={14} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {tabPanel()}

      <div style={{ marginTop: 16 }}>
        <DemoNotice>
          The Settings page manages a demonstration profile and local preferences only. Account
          security, API credentials and notification delivery require a connected backend.
        </DemoNotice>
      </div>

      <ConfirmationModal
        open={deleteAccountOpen}
        title="Delete account?"
        message="This is an explicit confirmation prompt for the demo. No server account exists, and confirming will not remove your profile or any browser-local demo data."
        confirmLabel="Delete account"
        onConfirm={handleDeleteAccount}
        onClose={() => setDeleteAccountOpen(false)}
      >
        <div style={{ marginTop: 10 }}>
          <DemoNotice>
            Account deletion is disabled in this frontend-only build. Implement it server-side with
            authentication and a verified deletion workflow.
          </DemoNotice>
        </div>
      </ConfirmationModal>

      <ConfirmationModal
        open={resetOpen}
        title="Reset all demo data?"
        message="Saved study areas, generated analysis runs and results, reports, team changes and notifications will be cleared, and the seed demonstration dataset restored. This cannot be undone."
        confirmLabel="Reset demo data"
        onConfirm={handleResetDemo}
        onClose={() => setResetOpen(false)}
      >
        <div style={{ marginTop: 10 }}>
          <DemoNotice>
            This affects only this browser&apos;s localStorage. Download a backup first if you want to
            keep your demo records.
          </DemoNotice>
        </div>
      </ConfirmationModal>
    </>
  );
}
