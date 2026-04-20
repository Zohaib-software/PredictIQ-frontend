import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useNotifications } from '../../context/NotificationContext';
import { FinancialRecordsProvider } from '../../context/FinancialRecordsContext';
import { timeAgo } from '../../utils/timeAgo';
import {
  expenseAnomalyHighlightFromNotification,
  showExpenseAnomalyChartCta,
} from '../../utils/anomalyNotification';
import {
  navigateToTwoFactorSettingsSection,
  showTwoFactorReminderCta,
} from '../../utils/securityReminderNotification';
import {
  navigateToAdminUserForConsent,
  showConsentWithdrawalAdminCta,
} from '../../utils/consentWithdrawalAdminNotification';
import { motion, AnimatePresence } from 'framer-motion';
import { MOBILE_NAV_MEDIA, getInitialSidebarOpen } from '../../utils/sidebarViewport';
import { AdminNavDropdown } from './AdminNavDropdown';
import styles from './DashboardLayout.module.css';

const WELCOME_STORAGE_PREFIX = 'predictiq_welcome_seen_';

const navItems = [
  { path: '/overview', label: 'Overview', icon: '📊' },
  { path: '/forecasting', label: 'Forecasting', icon: '🔬' },
  { path: '/reports', label: 'Reports', icon: '💰' },
  { path: '/transactions', label: 'Transactions', icon: '📋' },
];

export function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(getInitialSidebarOpen);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const notificationsRef = useRef(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { mode, toggleTheme } = useTheme();
  const location = useLocation();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const showAdminNav = user?.role === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    if (!notificationsOpen) return;
    const handleClickOutside = (e) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setNotificationsOpen(false);
    };
    // Use "click" so in-dropdown links/buttons complete navigation before the panel unmounts.
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [notificationsOpen]);

  /** Mobile / tablet drawer: close when route changes so the menu does not stay open over the new page */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia(MOBILE_NAV_MEDIA).matches) return;
    setSidebarOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname, location.search]);

  const userId = user?.id ?? user?._id;
  const welcomeKey = userId ? `${WELCOME_STORAGE_PREFIX}${userId}` : null;
  const showWelcome =
    welcomeKey &&
    !welcomeDismissed &&
    typeof localStorage !== 'undefined' &&
    !localStorage.getItem(welcomeKey);

  const dismissWelcome = () => {
    if (welcomeKey) localStorage.setItem(welcomeKey, 'true');
    setWelcomeDismissed(true);
  };

  return (
    <div className={styles.wrapper}>
      <aside
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : styles.sidebarClosed}`}
        aria-label="Dashboard navigation"
      >
        <div className={styles.sidebarHead}>
          <Link to="/" className={styles.brand} aria-label="PredictIQ home">
            PredictIQ
          </Link>
          <button
            type="button"
            className={styles.sidebarToggle}
            onClick={() => setSidebarOpen((o) => !o)}
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <span aria-hidden="true">{sidebarOpen ? '◀' : '▶'}</span>
          </button>
        </div>
        <nav className={styles.nav}>
          {navItems.map(({ path, label, icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
              aria-current={location.pathname === path ? 'page' : undefined}
            >
              <span className={styles.navIcon} aria-hidden="true">{icon}</span>
              {sidebarOpen && <span className={styles.navLabel}>{label}</span>}
            </NavLink>
          ))}
          {showAdminNav && <AdminNavDropdown sidebarOpen={sidebarOpen} />}
        </nav>
        <div className={styles.sidebarFooter}>
          <NavLink
            to="/settings/profile"
            className={() =>
              `${styles.navLink} ${styles.footerNavLink} ${
                location.pathname.startsWith('/settings') ? styles.navLinkActive : ''
              }`
            }
            aria-current={location.pathname.startsWith('/settings') ? 'page' : undefined}
          >
            <span className={styles.navIcon} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 1-3 0 1.7 1.7 0 0 0-1-.6 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 1 0-3 1.7 1.7 0 0 0 .6-1 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 1 3 0 1.7 1.7 0 0 0 1 .6 1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.26.33.46.7.6 1a1.7 1.7 0 0 1 0 3c-.14.3-.34.67-.6 1z" />
              </svg>
            </span>
            {sidebarOpen && <span className={styles.navLabel}>Settings</span>}
          </NavLink>
          <button
            type="button"
            className={styles.logoutBtn}
            onClick={handleLogout}
            aria-label="Logout and return to homepage"
          >
            <span className={styles.logoutIcon} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            {sidebarOpen && <span className={styles.logoutLabel}>Logout</span>}
          </button>
        </div>
      </aside>

      <div className={styles.mainArea}>
        <header className={styles.topbar} role="banner">
          <button
            type="button"
            className={styles.mobileMenuBtn}
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <span aria-hidden="true">☰</span>
          </button>
          <div className={styles.topbarRight}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={toggleTheme}
              aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              title={mode === 'light' ? 'Dark mode' : 'Light mode'}
            >
              <span aria-hidden="true">{mode === 'light' ? '🌙' : '☀️'}</span>
            </button>
            <div className={styles.notificationsWrap} ref={notificationsRef}>
              <button
                type="button"
                className={styles.notificationBellBtn}
                onClick={() => setNotificationsOpen((o) => !o)}
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                aria-expanded={notificationsOpen}
                aria-haspopup="true"
              >
                <span aria-hidden="true">🔔</span>
                {unreadCount > 0 && (
                  <span className={styles.notificationBadge} aria-hidden="true">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    className={styles.notificationsDropdownShell}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <div
                      className={styles.notificationsDropdown}
                      role="dialog"
                      aria-label="Notifications panel"
                    >
                    <div className={styles.notificationsDropdownHeader}>
                      Notifications
                    </div>
                    <div className={styles.notificationsList}>
                      {notifications.length === 0 ? (
                        <p className={styles.notificationsEmpty}>No notifications yet</p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n._id}
                            className={`${styles.notificationItemBlock} ${!n.read ? styles.notificationItemBlockUnread : ''}`}
                          >
                            <button
                              type="button"
                              className={styles.notificationItem}
                              onClick={() => {
                                if (!n.read) markAsRead(n._id);
                              }}
                            >
                              <span className={styles.notificationItemTitle}>{n.title}</span>
                              <span className={styles.notificationItemMessage}>{n.message}</span>
                              <span className={styles.notificationItemMeta}>
                                {timeAgo(n.createdAt)}
                              </span>
                            </button>
                            {showExpenseAnomalyChartCta(n) ? (
                              <button
                                type="button"
                                className={styles.notificationChartCta}
                                onClick={() => {
                                  if (!n.read) markAsRead(n._id);
                                  const hl = expenseAnomalyHighlightFromNotification(n);
                                  const q =
                                    hl != null
                                      ? `highlight=${encodeURIComponent(hl)}&anomalyFocus=${Date.now()}`
                                      : `anomalyFocus=${Date.now()}`;
                                  navigate(`/reports?tab=costs&${q}`);
                                  setNotificationsOpen(false);
                                }}
                              >
                                Open expense anomaly chart
                              </button>
                            ) : null}
                            {showTwoFactorReminderCta(n) ? (
                              <button
                                type="button"
                                className={styles.notificationChartCta}
                                onClick={() => {
                                  if (!n.read) markAsRead(n._id);
                                  navigateToTwoFactorSettingsSection(navigate);
                                  setNotificationsOpen(false);
                                }}
                              >
                                Open two-factor settings
                              </button>
                            ) : null}
                            {showAdminNav && showConsentWithdrawalAdminCta(n) ? (
                              <button
                                type="button"
                                className={styles.notificationChartCta}
                                onClick={() => {
                                  if (!n.read) markAsRead(n._id);
                                  navigateToAdminUserForConsent(navigate, n.relatedUserId);
                                  setNotificationsOpen(false);
                                }}
                              >
                                Open user in admin
                              </button>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                    <div className={styles.notificationsFooter}>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          className={styles.notificationsFooterBtn}
                          onClick={markAllAsRead}
                        >
                          Mark all as read
                        </button>
                      )}
                      <Link
                        to="/notifications"
                        className={styles.notificationsFooterLink}
                        onClick={() => setNotificationsOpen(false)}
                      >
                        View all
                      </Link>
                    </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className={styles.profile} aria-label={`Logged in as ${user?.businessName || user?.email}`}>
              <span className={styles.profileAvatar} aria-hidden="true">
                {(user?.businessName || user?.email || 'U').charAt(0).toUpperCase()}
              </span>
              <span className={styles.profileName}>
                {user?.businessName || user?.email || 'User'}
              </span>
            </div>
          </div>
        </header>

        <main id="main-content" className={styles.content}>
          <AnimatePresence>
            {showWelcome && (
              <motion.div
                className={styles.welcomeBanner}
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                <p className={styles.welcomeBannerText}>
                  👋 Welcome to PredictIQ! Use <strong>Trend projection</strong> under each time-series chart
                  to explore linear extensions on your data.
                </p>
                <button
                  type="button"
                  className={styles.welcomeBannerDismiss}
                  onClick={dismissWelcome}
                  aria-label="Dismiss welcome message"
                >
                  Dismiss
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          <FinancialRecordsProvider>
            <Outlet />
          </FinancialRecordsProvider>
        </main>
      </div>

      {/* Overlay when sidebar is open on mobile */}
      <div
        className={styles.overlay}
        aria-hidden="true"
        data-visible={sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />
    </div>
  );
}
