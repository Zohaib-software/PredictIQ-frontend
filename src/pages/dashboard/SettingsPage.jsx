import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { mergeNotificationPreferences } from '../../constants/notificationPreferences.js';
import { Link, NavLink, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useReducedMotionSetting } from '../../context/ReducedMotionContext';
import { useNotifications } from '../../context/NotificationContext';
import { useFinancialRecords } from '../../context/FinancialRecordsContext';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import {
  changeMyPassword,
  deleteMyAccount,
  deleteMyData,
  fetchMyDataExport,
  patchNotificationPreferences,
  updateConsent,
} from '../../api/userApi';
import {
  disableTwoFactorApi,
  fetchSessions,
  logoutAllSessionsApi,
  logoutSessionApi,
  regenerateBackupCodesApi,
  setupTwoFactorApi,
  verifyTwoFactorSetupApi,
} from '../../api/authApi';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import layoutStyles from '../../components/dashboard/DashboardLayout.module.css';
import { TWO_FACTOR_SETTINGS_ANCHOR_ID } from '../../utils/securityReminderNotification';
import { MOBILE_NAV_MEDIA, getInitialSidebarOpen } from '../../utils/sidebarViewport';
import pageStyles from './DashboardPages.module.css';
import styles from './SettingsPage.module.css';

/** Plain class markers; responsive rules live under `settingsPageRoot` in DashboardPages.module.css */
const SR = {
  sidebar: 'settings-r-sidebar',
  sidebarNav: 'settings-r-sidebar-nav',
  navBtn: 'settings-r-nav-btn',
  sidebarToggle: 'settings-r-sidebar-toggle',
  main: 'settings-r-main',
  infoGrid: 'settings-r-info-grid',
  passwordGrid: 'settings-r-password-grid',
  twoFactorSetupPanel: 'settings-r-two-factor-setup-panel',
  twoFactorSetupMedia: 'settings-r-two-factor-setup-media',
  twoFactorSetupBody: 'settings-r-two-factor-setup-body',
  twoFactorSetupStep1Row: 'settings-r-two-factor-setup-step1-row',
  twoFactorQr: 'settings-r-two-factor-qr',
  backupCodesGrid: 'settings-r-backup-codes-grid',
  controlRow: 'settings-r-control-row',
  controlCta: 'settings-r-control-cta',
  settingRow: 'settings-r-setting-row',
  sessionCard: 'settings-r-session-card',
  sessionActions: 'settings-r-session-actions',
};

const SETTINGS_SECTIONS = [
  { id: 'profile', label: 'Profile', icon: 'profile' },
  { id: 'notifications', label: 'General settings', icon: 'general' },
  { id: 'security', label: 'Security', icon: 'security' },
  { id: 'data', label: 'Data & uploads', icon: 'data' },
];

const SETTINGS_DATA_SLUG = 'data-uploads';

/** Wait at least this long and for `fetchSessions` before showing Logged-in devices (avoids a loading-line flash). */
const SESSIONS_REVEAL_DELAY_MS = 360;
/** Auto-dismiss transient settings toasts (embedded + global), aligned with prior error-only 2.5s behavior. */
const SETTINGS_FEEDBACK_AUTO_DISMISS_MS = 2500;

/** Copy for each primary settings panel (desktop card header + narrow top app bar). */
const SETTINGS_PANEL_META = {
  profile: {
    headingId: 'profile-heading',
    title: 'Profile',
    subtitle: 'View your account details.',
  },
  security: {
    headingId: 'security-heading',
    title: 'Security',
    subtitle: 'Manage sign-in sessions across your devices.',
  },
  data: {
    headingId: 'data-heading',
    title: 'Data & uploads',
    subtitle: 'Manage consent, exports, and deletions.',
  },
};

const NOTIFICATIONS_PANEL_META = {
  headingId: 'notifications-heading',
  title: 'Notifications',
  subtitle:
    'Control in-app alerts (bell menu and Notifications page). Grouped like notification channels on iOS and Android so you can turn off whole categories.',
};

const ACCESSIBILITY_PANEL_META = {
  headingId: 'accessibility-heading',
  title: 'Accessibility & appearance',
  subtitle: 'Adjust how PredictIQ looks. Your choices are saved on this device.',
};

function subscribeToMatchMedia(query, onStoreChange) {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia(query);
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function useMatchMedia(query) {
  return useSyncExternalStore(
    (onStoreChange) => subscribeToMatchMedia(query, onStoreChange),
    () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false),
    () => false,
  );
}

function settingsPathForSectionId(sectionId) {
  if (sectionId === 'notifications') return '/settings/general-settings';
  if (sectionId === 'data') return `/settings/${SETTINGS_DATA_SLUG}`;
  if (sectionId === 'security') return '/settings/security';
  return '/settings/profile';
}

function sectionIdFromSettingsSlug(slug) {
  if (!slug) return null;
  if (slug === 'profile') return 'profile';
  if (slug === 'general-settings') return 'notifications';
  if (slug === 'security') return 'security';
  if (slug === SETTINGS_DATA_SLUG) return 'data';
  return null;
}

function GeneralSettingsGearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsNavIcon({ type }) {
  if (type === 'profile') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === 'security') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === 'data') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3c-4.97 0-9 1.79-9 4s4.03 4 9 4 9-1.79 9-4-4.03-4-9-4zM3 7v5c0 2.21 4.03 4 9 4s9-1.79 9-4V7M3 12v5c0 2.21 4.03 4 9 4s9-1.79 9-4v-5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return <GeneralSettingsGearIcon />;
}

function formatSessionDate(value) {
  if (!value) return 'Unavailable';

  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { section: sectionSlug } = useParams();
  const resolvedSectionId = sectionIdFromSettingsSlug(sectionSlug);
  const activeSection = resolvedSectionId ?? 'profile';
  const narrowLayout = useMatchMedia(MOBILE_NAV_MEDIA);
  const mobileTopBar = useMemo(() => {
    if (activeSection === 'notifications') {
      const nav = SETTINGS_SECTIONS.find((s) => s.id === 'notifications');
      return {
        headingId: 'settings-general-heading',
        title: nav?.label ?? 'General settings',
        subtitle: 'Notifications, theme, contrast, and motion.',
      };
    }
    const meta = SETTINGS_PANEL_META[activeSection];
    if (!meta) {
      return { headingId: 'settings-heading', title: 'Settings', subtitle: '' };
    }
    return { headingId: meta.headingId, title: meta.title, subtitle: meta.subtitle };
  }, [activeSection]);
  const { user, logout, updateUser } = useAuth();
  const { mode, setMode } = useTheme();
  const { reducedMotionEnabled, setReducedMotionEnabled } = useReducedMotionSetting();
  const { clearNotifications, fetchNotifications } = useNotifications();
  const { clearFinancialRecords } = useFinancialRecords();
  const [feedback, setFeedback] = useState(null);
  const [consentLoading, setConsentLoading] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarOpen);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  /** True only after min delay + fetch complete when opening Security (list stays hidden until then). */
  const [sessionsDevicesReady, setSessionsDevicesReady] = useState(false);
  /** Manual Refresh only; keeps the session list visible while refetching. */
  const [sessionsRefreshing, setSessionsRefreshing] = useState(false);
  const [sessionActionKey, setSessionActionKey] = useState('');
  const [twoFactorSetup, setTwoFactorSetup] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorDisablePassword, setTwoFactorDisablePassword] = useState('');
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState([]);
  const [twoFactorSetupPhase, setTwoFactorSetupPhase] = useState('idle'); // idle | setup | backupCodes
  const [backupActionState, setBackupActionState] = useState('');
  const isTwoFactorFeedback = feedback?.scope === 'security-2fa';
  const isExportFeedback = feedback?.scope === 'data-export';
  const isNotificationsFeedback = feedback?.scope === 'notifications';
  const isSessionsFeedback = feedback?.scope === 'sessions-devices';

  const [notificationPrefsLoading, setNotificationPrefsLoading] = useState(false);

  const notificationPrefs = useMemo(() => mergeNotificationPreferences(user), [user]);

  const saveNotificationPrefs = useCallback(
    async (partial) => {
      const prev = mergeNotificationPreferences(user);
      updateUser({ notificationPreferences: { ...prev, ...partial } });

      setNotificationPrefsLoading(true);
      try {
        const data = await patchNotificationPreferences(partial);
        if (data?.user) {
          updateUser({
            ...data.user,
            notificationPreferences:
              data.notificationPreferences ?? data.user.notificationPreferences,
          });
        } else if (data?.notificationPreferences) {
          updateUser({ notificationPreferences: data.notificationPreferences });
        }
      } catch (e) {
        updateUser({ notificationPreferences: prev });
        setFeedback({
          type: 'error',
          message: e?.message || 'Could not save notification preferences.',
          scope: 'notifications',
        });
      } finally {
        setNotificationPrefsLoading(false);
      }
      try {
        await fetchNotifications();
      } catch {
        /* list refresh is best-effort; prefs already saved */
      }
    },
    [user, updateUser, fetchNotifications]
  );

  const consentGiven = user?.consentGiven ?? true;
  const isDeleteAccount = modalType === 'account';
  const isDisableTwoFactorModal = modalType === 'disable2fa';
  const joinedDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Not available';

  const modalConfig = useMemo(() => {
    if (modalType === 'data') {
      return {
        title: 'Delete uploaded data',
        message:
          'This will permanently remove your uploaded financial records and notifications. Your account will remain active. This action cannot be undone.',
        confirmLabel: 'Delete data',
      };
    }

    if (modalType === 'account') {
      return {
        title: 'Delete account',
        message:
          'This will permanently delete your account and all associated data. Type DELETE to confirm.',
        confirmLabel: 'Delete account',
      };
    }

    if (modalType === 'disable2fa') {
      return {
        title: 'Disable two-factor authentication',
        message:
          'This removes the extra verification step for your account. If someone has your password, they will be able to sign in without an authenticator code.',
        confirmLabel: 'Disable 2FA',
      };
    }

    return null;
  }, [modalType]);

  const refreshSessions = useCallback(async () => {
    setSessionsRefreshing(true);
    try {
      const nextSessions = await fetchSessions();
      setSessions(nextSessions);
    } catch (error) {
      setFeedback({
        type: 'error',
        scope: 'sessions-devices',
        message: error?.message || 'Failed to load active sessions.',
      });
    } finally {
      setSessionsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection !== 'security') {
      setSessionsDevicesReady(false);
      return;
    }

    let cancelled = false;
    setSessions([]);
    setSessionsDevicesReady(false);

    (async () => {
      const minDelay = new Promise((resolve) => {
        window.setTimeout(resolve, SESSIONS_REVEAL_DELAY_MS);
      });
      try {
        const [, nextSessions] = await Promise.all([minDelay, fetchSessions()]);
        if (!cancelled) {
          setSessions(Array.isArray(nextSessions) ? nextSessions : []);
        }
      } catch (error) {
        if (!cancelled) {
          setFeedback({
            type: 'error',
            scope: 'sessions-devices',
            message: error?.message || 'Failed to load active sessions.',
          });
          setSessions([]);
        }
      } finally {
        if (!cancelled) {
          setSessionsDevicesReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSection]);

  useEffect(() => {
    if (activeSection !== 'security') return;
    const want = `#${TWO_FACTOR_SETTINGS_ANCHOR_ID}`;
    if (location.hash !== want) return;
    const el = document.getElementById(TWO_FACTOR_SETTINGS_ANCHOR_ID);
    if (!el) return;
    const raf = window.requestAnimationFrame(() => {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeSection, location.hash, location.pathname]);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback(null);
    }, SETTINGS_FEEDBACK_AUTO_DISMISS_MS);

    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  /** Narrow viewports: collapse settings nav strip when the section URL changes (matches dashboard drawer UX). */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia(MOBILE_NAV_MEDIA).matches) return;
    setSidebarOpen(false);
  }, [location.pathname, location.search]);

  if (sectionSlug === 'data-%26-uploads' || sectionSlug === 'data-&-uploads') {
    return <Navigate to={`/settings/${SETTINGS_DATA_SLUG}`} replace />;
  }

  if (sectionSlug && resolvedSectionId === null) {
    return <Navigate to="/settings/profile" replace />;
  }

  const handleConsentChange = async (nextValue) => {
    setFeedback(null);
    setConsentLoading(true);
    try {
      const data = await updateConsent(nextValue);
      updateUser({ consentGiven: data?.consentGiven ?? nextValue });
      setFeedback({
        type: 'success',
        message: `Consent ${nextValue ? 'enabled' : 'withdrawn'} successfully.`,
      });
    } catch (error) {
      setFeedback({ type: 'error', message: error?.message || 'Failed to update consent.' });
    } finally {
      setConsentLoading(false);
    }
  };

  const handleDeleteData = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const data = await deleteMyData();
      clearFinancialRecords();
      clearNotifications();
      setFeedback({
        type: 'success',
        message:
          data?.deletedFinancialRecords != null && data?.deletedNotifications != null
            ? `Deleted ${data.deletedFinancialRecords} financial records and ${data.deletedNotifications} notifications.`
            : 'Your uploaded data has been deleted successfully.',
      });
      setModalType(null);
    } catch (error) {
      setFeedback({ type: 'error', message: error?.message || 'Failed to delete data.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setActionLoading(true);
    setFeedback(null);
    try {
      await deleteMyAccount();
      clearFinancialRecords();
      clearNotifications();
      logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setFeedback({ type: 'error', message: error?.message || 'Failed to delete account.' });
      setActionLoading(false);
    }
  };

  const handleModalClose = () => {
    if (actionLoading || (isDisableTwoFactorModal && twoFactorLoading)) return;
    setModalType(null);
    setDeleteConfirmText('');
  };

  const handleModalConfirm = () => {
    if (modalType === 'data') {
      handleDeleteData();
      return;
    }
    if (modalType === 'account') {
      handleDeleteAccount();
      return;
    }
    if (modalType === 'disable2fa') {
      handleDisableTwoFactor();
    }
  };

  const handleDownloadMyData = async () => {
    setFeedback(null);
    setDownloadLoading(true);
    try {
      const payload = await fetchMyDataExport();
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const link = document.createElement('a');
      link.href = url;
      link.download = `predictiq-my-data-${stamp}.json`;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setFeedback({
        type: 'success',
        scope: 'data-export',
        message: 'Your data download has started. Check your downloads folder.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        scope: 'data-export',
        message: error?.message || 'Failed to download your data.',
      });
    } finally {
      setDownloadLoading(false);
    }
  };

  const handlePasswordFieldChange = (field, value) => {
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
    setPasswordErrors((prev) => ({ ...prev, [field]: '' }));
    setFeedback(null);
  };

  const validatePasswordForm = () => {
    const nextErrors = {};

    if (!passwordForm.currentPassword) {
      nextErrors.currentPassword = 'Enter your current password.';
    }

    if (!passwordForm.newPassword) {
      nextErrors.newPassword = 'Enter a new password.';
    } else if (passwordForm.newPassword.length < 8) {
      nextErrors.newPassword = 'New password must be at least 8 characters long.';
    } else if (passwordForm.newPassword.length > 72) {
      nextErrors.newPassword = 'New password must be less than 73 characters long.';
    } else if (passwordForm.newPassword === passwordForm.currentPassword) {
      nextErrors.newPassword = 'New password must be different from your current password.';
    }

    if (!passwordForm.confirmNewPassword) {
      nextErrors.confirmNewPassword = 'Confirm your new password.';
    } else if (passwordForm.confirmNewPassword !== passwordForm.newPassword) {
      nextErrors.confirmNewPassword = 'New password and confirmation do not match.';
    }

    setPasswordErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setFeedback(null);

    if (!validatePasswordForm()) {
      return;
    }

    setPasswordLoading(true);
    try {
      await changeMyPassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setPasswordErrors({});
      setFeedback({
        type: 'success',
        message: 'Your password has been updated successfully. Please use the new password next time you sign in.',
      });
    } catch (error) {
      const message = error?.message || 'Failed to update password.';
      if (/current password/i.test(message) || /incorrect/i.test(message)) {
        setPasswordErrors((prev) => ({
          ...prev,
          currentPassword: 'The current password you entered is incorrect.',
        }));
      }
      setFeedback({ type: 'error', message });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogoutCurrentSession = async (sessionId) => {
    setSessionActionKey(sessionId);
    setFeedback(null);
    try {
      await logoutSessionApi(sessionId);
      await logout({ skipServer: true });
      navigate('/login', { replace: true });
    } catch (error) {
      setFeedback({
        type: 'error',
        scope: 'sessions-devices',
        message: error?.message || 'Failed to log out this session.',
      });
    } finally {
      setSessionActionKey('');
    }
  };

  const handleLogoutSingleSession = async (sessionId, isCurrent) => {
    if (isCurrent) {
      await handleLogoutCurrentSession(sessionId);
      return;
    }

    setSessionActionKey(sessionId);
    setFeedback(null);
    try {
      await logoutSessionApi(sessionId);
      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
      setFeedback({
        type: 'success',
        scope: 'sessions-devices',
        message: 'That session has been logged out.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        scope: 'sessions-devices',
        message: error?.message || 'Failed to log out that session.',
      });
    } finally {
      setSessionActionKey('');
    }
  };

  const handleLogoutAllSessions = async () => {
    setSessionActionKey('all');
    setFeedback(null);
    try {
      await logoutAllSessionsApi();
      await logout({ skipServer: true });
      navigate('/login', { replace: true });
    } catch (error) {
      setFeedback({
        type: 'error',
        scope: 'sessions-devices',
        message: error?.message || 'Failed to log out all sessions.',
      });
    } finally {
      setSessionActionKey('');
    }
  };

  const handleStartTwoFactorSetup = async () => {
    setTwoFactorLoading(true);
    setFeedback(null);
    try {
      const data = await setupTwoFactorApi();
      setTwoFactorSetup(data);
      setTwoFactorCode('');
      setBackupCodes([]);
      setTwoFactorSetupPhase('setup');
    } catch (error) {
      setFeedback({
        type: 'error',
        scope: 'security-2fa',
        message: error?.message || 'Failed to start two-factor authentication setup.',
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleVerifyTwoFactorSetup = async (event) => {
    event.preventDefault();
    if (!twoFactorCode.trim()) {
      setFeedback({
        type: 'error',
        scope: 'security-2fa',
        message: 'Enter the 6-digit code from your authenticator app.',
      });
      return;
    }

    setTwoFactorLoading(true);
    setFeedback(null);
    try {
      const data = await verifyTwoFactorSetupApi(twoFactorCode.trim());
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      setBackupCodes(data?.backupCodes ?? []);
      setTwoFactorSetupPhase('backupCodes');
      updateUser({
        twoFactorEnabled: data?.user?.twoFactorEnabled ?? true,
        twoFactorEnabledAt: data?.user?.twoFactorEnabledAt ?? new Date().toISOString(),
      });
      setFeedback({
        type: 'success',
        scope: 'security-2fa',
        message: 'Two-factor authentication is now enabled. Save your backup codes somewhere safe.',
      });
      try {
        await fetchNotifications();
      } catch {
        /* best-effort: removes enable-2FA reminder from list */
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        scope: 'security-2fa',
        message: error?.message || 'Failed to verify your authentication code.',
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDoneSavingBackupCodes = () => {
    setTwoFactorSetupPhase('idle');
    setBackupCodes([]);
    setTwoFactorSetup(null);
    setTwoFactorCode('');
    setFeedback(null);
  };

  const handleDisableTwoFactor = async () => {
    if (!twoFactorDisablePassword) {
      setFeedback({
        type: 'error',
        scope: 'security-2fa',
        message: 'Enter your current password to disable two-factor authentication.',
      });
      return;
    }

    setTwoFactorLoading(true);
    setFeedback(null);
    try {
      const data = await disableTwoFactorApi(twoFactorDisablePassword);
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      setTwoFactorDisablePassword('');
      setBackupCodes([]);
      setTwoFactorSetupPhase('idle');
      updateUser({
        twoFactorEnabled: data?.user?.twoFactorEnabled ?? false,
        twoFactorEnabledAt: data?.user?.twoFactorEnabledAt ?? null,
      });
      setFeedback({
        type: 'success',
        scope: 'security-2fa',
        message: 'Two-factor authentication has been disabled.',
      });
      setModalType(null);
      try {
        await fetchNotifications();
      } catch {
        /* best-effort: may re-show enable-2FA reminder */
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        scope: 'security-2fa',
        message: error?.message || 'Failed to disable two-factor authentication.',
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const handleDisableTwoFactorSubmit = (event) => {
    event.preventDefault();
    if (!twoFactorDisablePassword) {
      setFeedback({
        type: 'error',
        scope: 'security-2fa',
        message: 'Enter your current password to disable two-factor authentication.',
      });
      return;
    }
    setModalType('disable2fa');
  };

  const handleRegenerateBackupCodes = async () => {
    setTwoFactorLoading(true);
    setFeedback(null);
    try {
      const data = await regenerateBackupCodesApi();
      setBackupCodes(data?.backupCodes ?? []);
      setFeedback({
        type: 'success',
        scope: 'security-2fa',
        message: 'Backup codes regenerated. Store the new codes safely.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        scope: 'security-2fa',
        message: error?.message || 'Failed to regenerate backup codes.',
      });
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const showBackupActionSuccess = (action) => {
    setBackupActionState(action);
    window.setTimeout(() => {
      setBackupActionState((current) => (current === action ? '' : current));
    }, 1000);
  };

  const handleCopyBackupCodes = async () => {
    if (!backupCodes.length || !navigator?.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(backupCodes.join('\n'));
      showBackupActionSuccess('copied');
      setFeedback({
        type: 'success',
        scope: 'security-2fa',
        message: 'Backup codes copied to your clipboard.',
      });
    } catch {
      setFeedback({
        type: 'error',
        scope: 'security-2fa',
        message: 'Could not copy backup codes. Please copy them manually.',
      });
    }
  };

  const handleDownloadBackupCodes = () => {
    if (!backupCodes.length) return;
    const text = backupCodes.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'predictiq-backup-codes.txt';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showBackupActionSuccess('downloaded');
  };

  return (
    <div className={`${styles.shell} ${pageStyles.settingsPageRoot}`}>
      {/* Do not apply DashboardLayout `sidebarClosed` here; its mobile rules translate the aside off-screen. */}
      <aside
        className={`${styles.sidebar} ${SR.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}
        aria-label="Settings sections"
      >
        <div className={styles.sidebarHead}>
          <Link to="/overview" className={styles.brand}>
            PredictIQ
          </Link>
          <button
            type="button"
            className={`${styles.sidebarToggle} ${SR.sidebarToggle}`}
            onClick={() => setSidebarOpen((o) => !o)}
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? 'Collapse settings sidebar' : 'Expand settings sidebar'}
          >
            <span aria-hidden="true">{sidebarOpen ? '◀' : '▶'}</span>
          </button>
        </div>

        <div className={styles.sidebarBody}>
          <nav className={`${styles.sidebarNav} ${SR.sidebarNav}`} aria-label="Account settings navigation">
            {SETTINGS_SECTIONS.map((section) => (
              <NavLink
                key={section.id}
                to={settingsPathForSectionId(section.id)}
                className={({ isActive }) =>
                  `${styles.navButtonReset} ${SR.navBtn} ${layoutStyles.navLink} ${
                    isActive ? layoutStyles.navLinkActive : ''
                  }`
                }
                aria-current={activeSection === section.id ? 'page' : undefined}
              >
                <span className={layoutStyles.navIcon} aria-hidden="true">
                  <SettingsNavIcon type={section.icon} />
                </span>
                <span className={`${layoutStyles.navLabel} ${styles.navText}`}>{section.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className={styles.sidebarFooter}>
          <Link
            to="/overview"
            className={`${layoutStyles.navLink} ${layoutStyles.footerNavLink} ${layoutStyles.navLinkActive}`}
          >
            <span className={layoutStyles.navIcon} aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M19 12H5M12 19l-7-7 7-7"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className={`${layoutStyles.navLabel} ${styles.navText}`}>Back to dashboard</span>
          </Link>
          <button
            type="button"
            className={layoutStyles.logoutBtn}
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            <span className={layoutStyles.logoutIcon} aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span className={`${layoutStyles.logoutLabel} ${styles.navText}`}>Logout</span>
          </button>
        </div>
      </aside>

      {sidebarOpen ? (
        <div
          className={styles.drawerOverlay}
          aria-hidden={false}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div id="settings-page-main" role="main" className={`${styles.main} ${SR.main}`}>
        {narrowLayout ? (
          <div className={styles.mobileTopBar}>
            <button
              type="button"
              className={styles.mobileDrawerOpenBtn}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open settings sections menu"
            >
              <span aria-hidden="true">☰</span>
            </button>
            <div className={styles.mobileTopBarCopy}>
              <h1 id={mobileTopBar.headingId} className={styles.mobileTopBarTitle}>
                {mobileTopBar.title}
              </h1>
              {mobileTopBar.subtitle ? (
                <p className={styles.mobileTopBarSubtitle}>{mobileTopBar.subtitle}</p>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className={styles.content}>
          {feedback &&
            !isTwoFactorFeedback &&
            !isExportFeedback &&
            !isNotificationsFeedback &&
            !isSessionsFeedback && (
            <div
              className={`${styles.feedback} ${
                feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess
              }`}
              role="status"
            >
              {feedback.message}
            </div>
          )}

          {activeSection === 'profile' && (
            <section className={styles.panel} aria-labelledby="profile-heading">
              {!narrowLayout && (
                <header className={styles.panelHeader}>
                  <h2 id="profile-heading" className={styles.panelTitle}>
                    {SETTINGS_PANEL_META.profile.title}
                  </h2>
                  <p className={styles.panelSubtitle}>{SETTINGS_PANEL_META.profile.subtitle}</p>
                </header>
              )}

              <div className={`${styles.panelBody} ${styles.settingsStackBody}`}>
                <div className={styles.settingsSubsection}>
                  <h3 className={styles.sectionTitle}>Account Information</h3>
                  <div className={`${styles.infoGrid} ${SR.infoGrid}`}>
                    <div>
                      <p className={styles.infoLabel}>Name</p>
                      <p className={styles.infoValue}>{user?.businessName || 'Not available'}</p>
                    </div>
                    <div>
                      <p className={styles.infoLabel}>Email</p>
                      <p className={styles.infoValue}>{user?.email || 'Not available'}</p>
                    </div>
                    <div>
                      <p className={styles.infoLabel}>Phone number</p>
                      <p className={styles.infoValue}>{user?.phoneNumber || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className={styles.infoLabel}>Member since</p>
                      <p className={styles.infoValue}>{joinedDate}</p>
                    </div>
                  </div>
                </div>

                <div className={styles.settingsSubsection}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h3 className={styles.sectionTitle}>Password & security</h3>
                      <p className={styles.sectionText}>
                        Keep your account secure by confirming your current password before setting a new one.
                      </p>
                    </div>
                  </div>

                  <form className={styles.passwordForm} onSubmit={handlePasswordSubmit}>
                    <div className={`${styles.passwordGrid} ${SR.passwordGrid}`}>
                      <Input
                        label="Current password"
                        type="password"
                        autoComplete="current-password"
                        value={passwordForm.currentPassword}
                        onChange={(e) => handlePasswordFieldChange('currentPassword', e.target.value)}
                        error={passwordErrors.currentPassword}
                        required
                      />
                      <Input
                        label="New password"
                        type="password"
                        autoComplete="new-password"
                        value={passwordForm.newPassword}
                        onChange={(e) => handlePasswordFieldChange('newPassword', e.target.value)}
                        error={passwordErrors.newPassword}
                        required
                      />
                      <Input
                        label="Confirm new password"
                        type="password"
                        autoComplete="new-password"
                        value={passwordForm.confirmNewPassword}
                        onChange={(e) =>
                          handlePasswordFieldChange('confirmNewPassword', e.target.value)
                        }
                        error={passwordErrors.confirmNewPassword}
                        required
                      />
                    </div>

                    <p className={styles.helperText}>
                      Use at least 8 characters. For better security, avoid reusing an old password.
                    </p>

                    <div className={styles.passwordActions}>
                      <Button type="submit" disabled={passwordLoading}>
                        {passwordLoading ? 'Updating...' : 'Update password'}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'security' && (
            <section className={styles.panel} aria-labelledby="security-heading">
              {!narrowLayout && (
                <header className={styles.panelHeader}>
                  <h2 id="security-heading" className={styles.panelTitle}>
                    {SETTINGS_PANEL_META.security.title}
                  </h2>
                  <p className={styles.panelSubtitle}>{SETTINGS_PANEL_META.security.subtitle}</p>
                </header>
              )}

              <div className={`${styles.panelBody} ${styles.settingsStackBody}`}>
                <div id={TWO_FACTOR_SETTINGS_ANCHOR_ID} className={styles.settingsSubsection}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h3 className={styles.sectionTitle}>Two-factor authentication</h3>
                      <p className={styles.sectionText}>
                        {user?.twoFactorEnabled ? (
                          <>
                            Two-factor authentication is active.
                            {user?.twoFactorEnabledAt
                              ? ` Enabled on ${formatSessionDate(user.twoFactorEnabledAt)}.`
                              : ''}
                          </>
                        ) : (
                          'Add an extra verification step when signing in to better protect your account.'
                        )}
                      </p>
                    </div>
                    <span
                      className={`${styles.badge} ${styles.badgeStatus} ${
                        user?.twoFactorEnabled ? styles.badgeSuccess : ''
                      }`}
                    >
                      {user?.twoFactorEnabled ? 'Enabled' : 'Not enabled'}
                    </span>
                  </div>

                  {isTwoFactorFeedback && twoFactorSetupPhase !== 'setup' && (
                    <div
                      className={`${styles.feedback} ${
                        feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess
                      } ${styles.inlineSubsectionFeedback}`}
                      role="status"
                    >
                      {feedback.message}
                    </div>
                  )}

                  {!user?.twoFactorEnabled && twoFactorSetupPhase === 'idle' && (
                    <div className={styles.securityActions}>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.primaryBtn}`}
                        onClick={handleStartTwoFactorSetup}
                        disabled={twoFactorLoading}
                      >
                        {twoFactorLoading ? 'Preparing...' : 'Set up authenticator app'}
                      </button>
                    </div>
                  )}

                  {twoFactorSetupPhase === 'setup' && twoFactorSetup && (
                    <div className={`${styles.twoFactorSetupPanel} ${SR.twoFactorSetupPanel}`}>
                      {isTwoFactorFeedback && (
                        <div
                          className={`${styles.feedback} ${
                            feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess
                          } ${styles.twoFactorEmbeddedFeedback}`}
                          role="status"
                        >
                          {feedback.message}
                        </div>
                      )}
                      <div className={`${styles.twoFactorSetupMedia} ${SR.twoFactorSetupMedia}`}>
                        <div className={styles.twoFactorStepHeaderRow}>
                          <span className={`${styles.badge} ${styles.stepBadge}`}>Step 1</span>
                          <span className={styles.twoFactorDash}>-</span>
                          <span className={styles.twoFactorStepTitle}>Set up authenticator</span>
                        </div>
                          <div className={`${styles.twoFactorSetupStep1Row} ${SR.twoFactorSetupStep1Row}`}>
                            <img
                              src={twoFactorSetup.qrCodeDataUrl}
                              alt="QR code for authenticator app setup"
                              className={`${styles.twoFactorQr} ${SR.twoFactorQr}`}
                            />
                            <div className={styles.twoFactorSetupStep1Text}>
                              <p className={styles.sectionText}>
                                In your authenticator app, either scan the QR code or enter the
                                manual setup key.
                              </p>
                              <p className={styles.sectionText}>
                                Manual setup key:{" "}
                                <span className={styles.manualEntryKey}>
                                  {twoFactorSetup.manualEntryKey}
                                </span>
                              </p>
                            </div>
                          </div>
                      </div>
                      <div className={`${styles.twoFactorSetupBody} ${SR.twoFactorSetupBody}`}>
                        <div className={styles.twoFactorStepHeaderRow}>
                          <span className={`${styles.badge} ${styles.stepBadge}`}>Step 2</span>
                          <span className={styles.twoFactorDash}>-</span>
                          <span className={styles.twoFactorStepTitle}>Verify code</span>
                        </div>
                        <p className={styles.sectionText}>
                          Enter the 6-digit code shown in your authenticator app.
                        </p>
                        <form className={styles.twoFactorVerifyForm} onSubmit={handleVerifyTwoFactorSetup}>
                          <Input
                            label="Authentication code"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={twoFactorCode}
                            onChange={(event) => setTwoFactorCode(event.target.value)}
                            required
                          />
                          <div className={styles.securityActions}>
                            <Button type="submit" disabled={twoFactorLoading}>
                              {twoFactorLoading ? 'Verifying...' : 'Verify and enable'}
                            </Button>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => {
                                setTwoFactorSetup(null);
                                setTwoFactorCode('');
                                setBackupCodes([]);
                                setTwoFactorSetupPhase('idle');
                              }}
                              disabled={twoFactorLoading}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {twoFactorSetupPhase === 'backupCodes' && (
                    <div className={styles.backupCodesPanel}>
                      <div className={styles.sectionHeader}>
                        <div>
                          <div className={styles.twoFactorHeaderRow}>
                            <span className={`${styles.badge} ${styles.stepBadge}`}>Step 3 of 3</span>
                            <span className={styles.twoFactorDash}>-</span>
                            <h4 className={styles.controlTitle}>Save your backup codes</h4>
                          </div>
                          <p className={styles.controlText}>
                            Each code can be used once. Keep them somewhere safe.
                          </p>
                        </div>
                        <div className={styles.securityActions}>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.backupActionBtn} ${
                              backupActionState === 'copied' ? styles.backupActionBtnSuccess : ''
                            }`}
                            onClick={handleCopyBackupCodes}
                            disabled={!backupCodes.length}
                          >
                            <span
                              className={`${styles.backupActionLabel} ${
                                backupActionState === 'copied' ? styles.backupActionLabelHidden : ''
                              }`}
                            >
                              Copy
                            </span>
                            <span
                              className={`${styles.backupActionTick} ${
                                backupActionState === 'copied' ? styles.backupActionTickVisible : ''
                              }`}
                              aria-hidden="true"
                            >
                              ✓
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.backupActionBtn} ${
                              backupActionState === 'downloaded' ? styles.backupActionBtnSuccess : ''
                            }`}
                            onClick={handleDownloadBackupCodes}
                            disabled={!backupCodes.length}
                          >
                            <span
                              className={`${styles.backupActionLabel} ${
                                backupActionState === 'downloaded' ? styles.backupActionLabelHidden : ''
                              }`}
                            >
                              Download
                            </span>
                            <span
                              className={`${styles.backupActionTick} ${
                                backupActionState === 'downloaded' ? styles.backupActionTickVisible : ''
                              }`}
                              aria-hidden="true"
                            >
                              ✓
                            </span>
                          </button>
                        </div>
                      </div>

                      {backupCodes.length ? (
                        <>
                          <div className={`${styles.backupCodesGrid} ${SR.backupCodesGrid}`}>
                            {backupCodes.map((code) => (
                              <code key={code} className={styles.backupCode}>
                                {code}
                              </code>
                            ))}
                          </div>

                          <div className={styles.securityActions}>
                            <Button
                              type="button"
                              onClick={handleDoneSavingBackupCodes}
                              disabled={twoFactorLoading}
                            >
                              Done
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className={styles.helperText}>No backup codes available. Please try again.</p>
                      )}
                    </div>
                  )}

                  {user?.twoFactorEnabled && twoFactorSetupPhase === 'idle' && (
                    <div className={styles.twoFactorEnabledPanel}>
                      <div className={styles.twoFactorRow}>
                        <div className={styles.controlCopy}>
                          <h4 className={styles.controlTitle}>Backup recovery codes</h4>
                          <p className={styles.controlText}>
                            Backup codes are shown only once. Regenerate them if you need a new set.
                          </p>
                        </div>
                        <div className={`${styles.controlCta} ${SR.controlCta}`}>
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.backupActionBtn}`}
                            onClick={handleRegenerateBackupCodes}
                            disabled={twoFactorLoading}
                          >
                            {twoFactorLoading ? 'Working...' : 'Regenerate codes'}
                          </button>
                        </div>
                      </div>

                      {backupCodes.length > 0 && (
                        <>
                          <div className={styles.divider} role="separator" />
                          <div className={styles.backupCodesPanel}>
                          <div className={styles.sectionHeader}>
                            <div>
                              <h4 className={styles.controlTitle}>Your backup codes</h4>
                              <p className={styles.controlText}>
                                Each code can be used once. Save them somewhere safe.
                              </p>
                            </div>
                            <div className={styles.securityActions}>
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.backupActionBtn} ${
                                  backupActionState === 'copied' ? styles.backupActionBtnSuccess : ''
                                }`}
                                onClick={handleCopyBackupCodes}
                                disabled={!backupCodes.length}
                              >
                                <span
                                  className={`${styles.backupActionLabel} ${
                                    backupActionState === 'copied' ? styles.backupActionLabelHidden : ''
                                  }`}
                                >
                                  Copy
                                </span>
                                <span
                                  className={`${styles.backupActionTick} ${
                                    backupActionState === 'copied' ? styles.backupActionTickVisible : ''
                                  }`}
                                  aria-hidden="true"
                                >
                                  ✓
                                </span>
                              </button>

                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.backupActionBtn} ${
                                  backupActionState === 'downloaded' ? styles.backupActionBtnSuccess : ''
                                }`}
                                onClick={handleDownloadBackupCodes}
                                disabled={!backupCodes.length}
                              >
                                <span
                                  className={`${styles.backupActionLabel} ${
                                    backupActionState === 'downloaded'
                                      ? styles.backupActionLabelHidden
                                      : ''
                                  }`}
                                >
                                  Download
                                </span>
                                <span
                                  className={`${styles.backupActionTick} ${
                                    backupActionState === 'downloaded'
                                      ? styles.backupActionTickVisible
                                      : ''
                                  }`}
                                  aria-hidden="true"
                                >
                                  ✓
                                </span>
                              </button>
                            </div>
                          </div>
                          <div className={`${styles.backupCodesGrid} ${SR.backupCodesGrid}`}>
                            {backupCodes.map((code) => (
                              <code key={code} className={styles.backupCode}>
                                {code}
                              </code>
                            ))}
                          </div>
                          </div>
                        </>
                      )}

                      <div className={styles.divider} role="separator" />

                      <div className={styles.twoFactorDangerArea} aria-label="Disable two-factor authentication">
                        <div className={styles.twoFactorRow}>
                          <div className={styles.controlCopy}>
                            <h4 className={`${styles.controlTitle} ${styles.controlTitleDanger}`}>
                              Disable two-factor authentication
                            </h4>
                            <p className={styles.controlText}>
                              You’ll stop using authenticator codes during sign-in. You can re-enable 2FA
                              at any time.
                            </p>
                          </div>
                        </div>

                        <form className={styles.twoFactorDisableForm} onSubmit={handleDisableTwoFactorSubmit}>
                          <Input
                            label="Current password"
                            type="password"
                            autoComplete="current-password"
                            value={twoFactorDisablePassword}
                            onChange={(event) => setTwoFactorDisablePassword(event.target.value)}
                            required
                          />
                          <div className={styles.securityActions}>
                            <button
                              type="submit"
                              className={`${styles.actionBtn} ${styles.dangerBtn}`}
                              disabled={twoFactorLoading}
                            >
                              {twoFactorLoading ? 'Working...' : 'Disable 2FA'}
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.settingsSubsection} aria-busy={!sessionsDevicesReady}>
                  <div className={`${styles.sectionHeader} ${styles.sectionHeaderSessionTools}`}>
                    <div>
                      <h3 className={styles.sectionTitle}>Logged-in devices</h3>
                      <p className={styles.sectionText}>
                        These are the sessions currently signed in to your account.
                      </p>
                    </div>
                    <div className={styles.securityActions}>
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={refreshSessions}
                        disabled={
                          !sessionsDevicesReady || sessionsRefreshing || sessionActionKey === 'all'
                        }
                      >
                        {sessionsRefreshing ? 'Refreshing...' : 'Refresh'}
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.dangerBtn}`}
                        onClick={handleLogoutAllSessions}
                        disabled={
                          !sessions.length ||
                          sessionsRefreshing ||
                          !sessionsDevicesReady ||
                          sessionActionKey === 'all'
                        }
                      >
                        {sessionActionKey === 'all' ? 'Logging out...' : 'Log out all sessions'}
                      </button>
                    </div>
                  </div>

                  {isSessionsFeedback && (
                    <div
                      className={`${styles.feedback} ${
                        feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess
                      } ${styles.inlineSubsectionFeedback}`}
                      role="status"
                    >
                      {feedback.message}
                    </div>
                  )}

                  {!sessionsDevicesReady ? null : sessions.length ? (
                    <div className={styles.sessionList} role="list">
                      {sessions.map((session) => (
                        <div key={session.id} className={`${styles.sessionCard} ${SR.sessionCard}`} role="listitem">
                          <div className={styles.sessionInfo}>
                            <div className={styles.sessionHeaderRow}>
                              <h4 className={styles.sessionTitle}>{session.deviceLabel}</h4>
                              {session.current && <span className={styles.sessionBadge}>This device</span>}
                            </div>
                            <p className={styles.sessionMeta}>
                              Signed in {formatSessionDate(session.createdAt)}
                            </p>
                            <p className={styles.sessionMeta}>
                              Last active {formatSessionDate(session.lastActiveAt)}
                            </p>
                            <p className={styles.sessionAgent}>{session.userAgent || 'Unknown device'}</p>
                          </div>
                          <div className={`${styles.sessionActions} ${SR.sessionActions}`}>
                            <button
                              type="button"
                              className={`pq-btn-danger-red ${styles.sessionLogoutBtn}`}
                              onClick={() => handleLogoutSingleSession(session.id, session.current)}
                              disabled={!!sessionActionKey}
                            >
                              {sessionActionKey === session.id
                                ? 'Logging out...'
                                : session.current
                                  ? 'Log out this device'
                                  : 'Log out'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.sectionText}>No active sessions were found for your account.</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeSection === 'data' && (
            <section className={styles.panel} aria-labelledby="data-heading">
              {!narrowLayout && (
                <header className={styles.panelHeader}>
                  <h2 id="data-heading" className={styles.panelTitle}>
                    {SETTINGS_PANEL_META.data.title}
                  </h2>
                  <p className={styles.panelSubtitle}>{SETTINGS_PANEL_META.data.subtitle}</p>
                </header>
              )}

              <div className={`${styles.panelBody} ${styles.settingsStackBody}`}>
                <div className={styles.settingsSubsection}>
                  <h3 className={styles.sectionTitle}>Your Data & Privacy</h3>
                  <p className={styles.sectionText}>
                    PredictIQ stores your uploaded financial records and account details so it can
                    generate cash flow forecasts and liquidity insights tailored to your business.
                  </p>
                  <p className={styles.sectionText}>
                    Your data is used only inside PredictIQ and is not shared with third parties.
                    Use the controls below to download an archive, remove uploads, or delete your
                    account.
                  </p>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={consentGiven}
                      disabled={consentLoading}
                      onChange={(e) => handleConsentChange(e.target.checked)}
                    />
                    <span>
                      I consent to PredictIQ processing my financial data for forecasting purposes
                    </span>
                  </label>
                  {!consentGiven && (
                    <p className={styles.warning}>
                      Forecasting features will be limited without data processing consent
                    </p>
                  )}
                </div>

                <div className={styles.settingsSubsection}>
                  <div className={styles.flatControls}>
                    {isExportFeedback && (
                      <div
                        className={`${styles.feedback} ${
                          feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess
                        } ${styles.twoFactorEmbeddedFeedback}`}
                        role="status"
                      >
                        {feedback.message}
                      </div>
                    )}
                    <div className={`${styles.controlRow} ${styles.controlRowExportDownload} ${SR.controlRow}`}>
                      <div className={styles.controlCopy}>
                        <h3 className={styles.controlTitle}>Export data</h3>
                        <p className={styles.controlText}>
                          Download your profile, financial records, and notifications as a JSON file.
                        </p>
                      </div>
                      <div className={`${styles.controlCta} ${SR.controlCta}`}>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.backupActionBtn}`}
                          onClick={handleDownloadMyData}
                          disabled={downloadLoading}
                        >
                          {downloadLoading ? 'Preparing…' : 'Download'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={styles.settingsSubsection}>
                <div className={styles.dangerZone} aria-label="Danger zone">
                  <div className={styles.dangerZoneHeader}>
                    <h3 className={styles.dangerZoneTitle}>Danger zone</h3>
                    <p className={styles.dangerZoneSubtitle}>
                      These actions are permanent and can’t be undone.
                    </p>
                  </div>

                  <div className={styles.controlList} role="list">
                    <div className={`${styles.controlRow} ${SR.controlRow}`} role="listitem">
                      <div className={styles.controlCopy}>
                        <h4 className={styles.controlTitle}>Delete uploaded data</h4>
                        <p className={styles.controlText}>
                          Permanently removes your financial records and notifications. Your account
                          stays active.
                        </p>
                      </div>
                      <div className={`${styles.controlCta} ${SR.controlCta}`}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => setModalType('data')}
                        >
                          Delete data
                        </button>
                      </div>
                    </div>

                    <div className={`${styles.controlRow} ${SR.controlRow}`} role="listitem">
                      <div className={styles.controlCopy}>
                        <h4 className={`${styles.controlTitle} ${styles.controlTitleDanger}`}>
                          Delete account
                        </h4>
                        <p className={styles.controlText}>
                          Permanently deletes your account and everything tied to it.
                        </p>
                      </div>
                      <div className={`${styles.controlCta} ${SR.controlCta}`}>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.dangerBtn}`}
                          onClick={() => setModalType('account')}
                        >
                          Delete account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </section>
          )}

          {activeSection === 'notifications' && (
            <>
              <section className={styles.panel} aria-labelledby="notifications-heading">
                {!narrowLayout && (
                  <header className={styles.panelHeader}>
                    <h2 id="notifications-heading" className={styles.panelTitle}>
                      {NOTIFICATIONS_PANEL_META.title}
                    </h2>
                    <p className={styles.panelSubtitle}>{NOTIFICATIONS_PANEL_META.subtitle}</p>
                  </header>
                )}

                <div className={`${styles.panelBody} ${styles.settingsStackBody}`}>
                  {narrowLayout ? (
                    <h2
                      id="notifications-heading"
                      className={styles.mobilePanelSectionTitle}
                    >
                      {NOTIFICATIONS_PANEL_META.title}
                    </h2>
                  ) : null}
                  <div className={styles.settingsSubsection}>
                    <div className={styles.flatControls}>
                      {isNotificationsFeedback && (
                        <div
                          className={`${styles.feedback} ${
                            feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess
                          } ${styles.notificationPrefsFeedback}`}
                          role={feedback.type === 'error' ? 'alert' : 'status'}
                        >
                          {feedback.message}
                        </div>
                      )}

                      <div className={`${styles.settingRow} ${SR.settingRow}`}>
                        <div className={styles.controlCopy}>
                          <h3 className={styles.controlTitle}>All notifications</h3>
                          <p className={styles.controlText}>
                            Master switch. When off, nothing new appears in your feed until you turn this
                            back on.
                          </p>
                        </div>
                        <div className={`${styles.controlCta} ${SR.controlCta}`}>
                          <label className={styles.switch}>
                            <input
                              type="checkbox"
                              role="switch"
                              aria-label="Enable all in-app notifications"
                              checked={notificationPrefs.enabled}
                              disabled={notificationPrefsLoading}
                              onChange={(e) => saveNotificationPrefs({ enabled: e.target.checked })}
                            />
                            <span
                              className={`${styles.switchTrack} ${
                                notificationPrefs.enabled ? styles.switchTrackOn : ''
                              }`}
                              aria-hidden="true"
                            >
                              <span className={styles.switchThumb} />
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.settingsSubsection}>
                    <p className={styles.notificationChannelIntro}>
                      By category, turn off types you do not want while keeping the rest.
                    </p>

                    <div className={styles.controlList} role="list" aria-label="Notification categories">
                    <div className={styles.notificationGroupHeader} id="notif-grp-financial">
                      Financial alerts
                    </div>
                    <div className={`${styles.settingRow} ${SR.settingRow}`} role="listitem">
                      <div className={styles.controlCopy}>
                        <h3 className={styles.controlTitle}>Cash flow & liquidity</h3>
                        <p className={styles.controlText}>
                          Warnings when forecasts suggest low or negative cash (e.g. 30/60/90-day
                          outlook).
                        </p>
                      </div>
                      <div className={`${styles.controlCta} ${SR.controlCta}`}>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            role="switch"
                            aria-label="Cash flow and liquidity notifications"
                            checked={notificationPrefs.liquidityAlerts}
                            disabled={notificationPrefsLoading || !notificationPrefs.enabled}
                            onChange={(e) => saveNotificationPrefs({ liquidityAlerts: e.target.checked })}
                          />
                          <span
                            className={`${styles.switchTrack} ${
                              notificationPrefs.liquidityAlerts ? styles.switchTrackOn : ''
                            }`}
                            aria-hidden="true"
                          >
                            <span className={styles.switchThumb} />
                          </span>
                        </label>
                      </div>
                    </div>
                    <div className={`${styles.settingRow} ${SR.settingRow}`} role="listitem">
                      <div className={styles.controlCopy}>
                        <h3 className={styles.controlTitle}>Forecasts</h3>
                        <p className={styles.controlText}>
                          Alerts when new forecast results or forecast-related events are ready.
                        </p>
                      </div>
                      <div className={`${styles.controlCta} ${SR.controlCta}`}>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            role="switch"
                            aria-label="Forecast notifications"
                            checked={notificationPrefs.forecastAlerts}
                            disabled={notificationPrefsLoading || !notificationPrefs.enabled}
                            onChange={(e) => saveNotificationPrefs({ forecastAlerts: e.target.checked })}
                          />
                          <span
                            className={`${styles.switchTrack} ${
                              notificationPrefs.forecastAlerts ? styles.switchTrackOn : ''
                            }`}
                            aria-hidden="true"
                          >
                            <span className={styles.switchThumb} />
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className={styles.notificationGroupHeader} id="notif-grp-data">
                      Data &amp; quality
                    </div>
                    <div className={`${styles.settingRow} ${SR.settingRow}`} role="listitem">
                      <div className={styles.controlCopy}>
                        <h3 className={styles.controlTitle}>Expense anomalies</h3>
                        <p className={styles.controlText}>
                          Reminders to review flagged months on the expense anomaly chart.
                        </p>
                      </div>
                      <div className={`${styles.controlCta} ${SR.controlCta}`}>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            role="switch"
                            aria-label="Expense anomaly notifications"
                            checked={notificationPrefs.anomalyAlerts}
                            disabled={notificationPrefsLoading || !notificationPrefs.enabled}
                            onChange={(e) => saveNotificationPrefs({ anomalyAlerts: e.target.checked })}
                          />
                          <span
                            className={`${styles.switchTrack} ${
                              notificationPrefs.anomalyAlerts ? styles.switchTrackOn : ''
                            }`}
                            aria-hidden="true"
                          >
                            <span className={styles.switchThumb} />
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className={styles.notificationGroupHeader} id="notif-grp-insights">
                      Insights
                    </div>
                    <div className={`${styles.settingRow} ${SR.settingRow}`} role="listitem">
                      <div className={styles.controlCopy}>
                        <h3 className={styles.controlTitle}>Model &amp; data hints</h3>
                        <p className={styles.controlText}>
                          Non-urgent insights such as forecast accuracy (MAPE) and similar tips.
                        </p>
                      </div>
                      <div className={`${styles.controlCta} ${SR.controlCta}`}>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            role="switch"
                            aria-label="Model and data hint notifications"
                            checked={notificationPrefs.insightAlerts}
                            disabled={notificationPrefsLoading || !notificationPrefs.enabled}
                            onChange={(e) => saveNotificationPrefs({ insightAlerts: e.target.checked })}
                          />
                          <span
                            className={`${styles.switchTrack} ${
                              notificationPrefs.insightAlerts ? styles.switchTrackOn : ''
                            }`}
                            aria-hidden="true"
                          >
                            <span className={styles.switchThumb} />
                          </span>
                        </label>
                      </div>
                    </div>

                    <div className={styles.notificationGroupHeader} id="notif-grp-security">
                      Account &amp; security
                    </div>
                    <div className={`${styles.settingRow} ${SR.settingRow}`} role="listitem">
                      <div className={styles.controlCopy}>
                        <h3 className={styles.controlTitle}>Sign-in &amp; 2FA</h3>
                        <p className={styles.controlText}>
                          Future alerts for two-factor setup, new devices, and other security events
                          (in-app).
                        </p>
                      </div>
                      <div className={`${styles.controlCta} ${SR.controlCta}`}>
                        <label className={styles.switch}>
                          <input
                            type="checkbox"
                            role="switch"
                            aria-label="Security and two-factor notifications"
                            checked={notificationPrefs.securityAlerts}
                            disabled={notificationPrefsLoading || !notificationPrefs.enabled}
                            onChange={(e) => saveNotificationPrefs({ securityAlerts: e.target.checked })}
                          />
                          <span
                            className={`${styles.switchTrack} ${
                              notificationPrefs.securityAlerts ? styles.switchTrackOn : ''
                            }`}
                            aria-hidden="true"
                          >
                            <span className={styles.switchThumb} />
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              </section>

              <section className={styles.panel} aria-labelledby="accessibility-heading">
                {!narrowLayout && (
                  <header className={styles.panelHeader}>
                    <h2 id="accessibility-heading" className={styles.panelTitle}>
                      {ACCESSIBILITY_PANEL_META.title}
                    </h2>
                    <p className={styles.panelSubtitle}>{ACCESSIBILITY_PANEL_META.subtitle}</p>
                  </header>
                )}

                <div className={`${styles.panelBody} ${styles.settingsStackBody}`}>
                  {narrowLayout ? (
                    <h2
                      id="accessibility-heading"
                      className={styles.mobilePanelSectionTitle}
                    >
                      {ACCESSIBILITY_PANEL_META.title}
                    </h2>
                  ) : null}
                  <div className={styles.settingsSubsection}>
                    <div className={styles.controlList} role="list">
                      <div className={`${styles.settingRow} ${SR.settingRow}`} role="listitem">
                        <div className={styles.controlCopy}>
                          <h3 className={styles.controlTitle}>Dark mode</h3>
                          <p className={styles.controlText}>
                            Use a dark background with light text across the app and charts.
                          </p>
                        </div>
                        <div className={`${styles.controlCta} ${SR.controlCta}`}>
                          <label className={styles.switch}>
                            <input
                              type="checkbox"
                              role="switch"
                              aria-label="Toggle dark mode"
                              checked={mode === 'dark'}
                              onChange={(e) => setMode(e.target.checked ? 'dark' : 'light')}
                            />
                            <span
                              className={`${styles.switchTrack} ${mode === 'dark' ? styles.switchTrackOn : ''}`}
                              aria-hidden="true"
                            >
                              <span className={styles.switchThumb} />
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className={`${styles.settingRow} ${SR.settingRow}`} role="listitem">
                        <div className={styles.controlCopy}>
                          <h3 className={styles.controlTitle}>Reduced motion</h3>
                          <p className={styles.controlText}>
                            Turn off transitions and chart motion in PredictIQ. Other animated
                            elements follow your system “Reduce motion” setting when it is on. Your
                            choice is saved on this device.
                          </p>
                        </div>
                        <div className={`${styles.controlCta} ${SR.controlCta}`}>
                          <label className={styles.switch}>
                            <input
                              type="checkbox"
                              role="switch"
                              aria-label="Reduce motion across PredictIQ"
                              checked={reducedMotionEnabled}
                              onChange={(e) => setReducedMotionEnabled(e.target.checked)}
                            />
                            <span
                              className={`${styles.switchTrack} ${
                                reducedMotionEnabled ? styles.switchTrackOn : ''
                              }`}
                              aria-hidden="true"
                            >
                              <span className={styles.switchThumb} />
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!modalType}
        title={modalConfig?.title}
        message={modalConfig?.message}
        cancelLabel="Cancel"
        confirmLabel={modalConfig?.confirmLabel}
        onCancel={handleModalClose}
        onConfirm={handleModalConfirm}
        isConfirmDisabled={
          (isDeleteAccount && deleteConfirmText !== 'DELETE') ||
          (isDisableTwoFactorModal && !twoFactorDisablePassword)
        }
        isConfirmLoading={actionLoading || (isDisableTwoFactorModal && twoFactorLoading)}
        confirmVariant="danger"
      >
        {isDeleteAccount && (
          <div className={styles.confirmInputWrap}>
            <input
              type="text"
              className={styles.confirmInput}
              placeholder="Type DELETE"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />
          </div>
        )}
      </ConfirmationModal>
    </div>
  );
}
