import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useNotifications } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { deleteNotificationsBulkAll } from '../../api/notificationsApi';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { timeAgo } from '../../utils/timeAgo';
import {
  expenseAnomalyHighlightFromNotification,
  expenseAnomalyPeriodHint,
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
import styles from './NotificationsPage.module.css';

export function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const showAdminNav = user?.role === 'admin';
  const { notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications } = useNotifications();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const ids = useMemo(() => notifications.map((n) => String(n._id)), [notifications]);
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.has(id));

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const s = String(id);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ids));
    }
  };

  const handleConfirmBulkDelete = async () => {
    const toDelete = [...selectedIds];
    if (toDelete.length === 0) return;
    setBulkDeleting(true);
    try {
      const { deletedCount } = await deleteNotificationsBulkAll(toDelete);
      setToast({ type: 'success', message: `Deleted ${deletedCount} notification(s)` });
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      setSelectionMode(false);
      await fetchNotifications();
    } catch (e) {
      setToast({ type: 'error', message: e?.message || 'Delete failed' });
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>Notifications</h1>
            <p className={styles.subtitle}>
              {notifications.length} total · {unreadCount} unread
            </p>
          </div>
          {!selectionMode ? (
            <div className={styles.headerActions}>
              {unreadCount > 0 && (
                <button type="button" className={styles.markAllBtn} onClick={markAllAsRead}>
                  Mark all as read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  className={styles.btnSelectMode}
                  onClick={() => setSelectionMode(true)}
                >
                  Select to delete…
                </button>
              )}
            </div>
          ) : (
            <div className={styles.selectionModeActions} role="toolbar" aria-label="Bulk selection">
              <span className={styles.bulkBarMeta}>
                {selectedIds.size > 0 ? (
                  <>
                    <strong>{selectedIds.size}</strong> selected
                  </>
                ) : (
                  'Tick notifications to select them'
                )}
              </span>
              <button
                type="button"
                className={styles.btnSelectMode}
                onClick={toggleSelectAll}
                disabled={notifications.length === 0}
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
              <button
                type="button"
                className={styles.btnCancelSelect}
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedIds(new Set());
                  setBulkDeleteOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnBulkDelete}
                disabled={selectedIds.size === 0}
                onClick={() => setBulkDeleteOpen(true)}
              >
                Delete selected
              </button>
            </div>
          )}
        </div>
      </header>

      <ul className={styles.list} role="list">
        {notifications.length === 0 ? (
          <li className={styles.empty}>No notifications yet.</li>
        ) : (
          notifications.map((n) => {
            const anomalyHint = expenseAnomalyPeriodHint(n);
            return (
            <li key={n._id} className={`${styles.item} ${!n.read ? styles.itemUnread : ''}`}>
              <div className={styles.itemRow}>
                {selectionMode && (
                  <div className={styles.selectCell}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(String(n._id))}
                      onChange={() => toggleRow(n._id)}
                      aria-label={`Select: ${n.title || 'notification'}`}
                    />
                  </div>
                )}
                <div className={styles.itemMain}>
                  {selectionMode ? (
                    <div className={styles.itemStatic}>
                      <span className={styles.itemTitle}>{n.title}</span>
                      <span className={styles.itemMessage}>{n.message}</span>
                      {anomalyHint ? <span className={styles.periodHint}>{anomalyHint}</span> : null}
                      <span className={styles.itemTime}>{timeAgo(n.createdAt)}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.itemBtn}
                      onClick={() => !n.read && markAsRead(n._id)}
                    >
                      <span className={styles.itemTitle}>{n.title}</span>
                      <span className={styles.itemMessage}>{n.message}</span>
                      {anomalyHint ? <span className={styles.periodHint}>{anomalyHint}</span> : null}
                      <span className={styles.itemTime}>{timeAgo(n.createdAt)}</span>
                    </button>
                  )}
                  {showExpenseAnomalyChartCta(n) ? (
                    <div className={styles.itemChartLinkWrap}>
                      <button
                        type="button"
                        className={styles.viewChartCta}
                        onClick={() => {
                          if (!n.read) markAsRead(n._id);
                          const hl = expenseAnomalyHighlightFromNotification(n);
                          const q =
                            hl != null
                              ? `highlight=${encodeURIComponent(hl)}&anomalyFocus=${Date.now()}`
                              : `anomalyFocus=${Date.now()}`;
                          navigate(`/reports?tab=costs&${q}`);
                        }}
                      >
                        Open expense anomaly chart
                      </button>
                    </div>
                  ) : null}
                  {showTwoFactorReminderCta(n) ? (
                    <div className={styles.itemChartLinkWrap}>
                      <button
                        type="button"
                        className={styles.viewChartCta}
                        onClick={() => {
                          if (!n.read) markAsRead(n._id);
                          navigateToTwoFactorSettingsSection(navigate);
                        }}
                      >
                        Open two-factor settings
                      </button>
                    </div>
                  ) : null}
                  {showAdminNav && showConsentWithdrawalAdminCta(n) ? (
                    <div className={styles.itemChartLinkWrap}>
                      <button
                        type="button"
                        className={styles.viewChartCta}
                        onClick={() => {
                          if (!n.read) markAsRead(n._id);
                          navigateToAdminUserForConsent(navigate, n.relatedUserId);
                        }}
                      >
                        Open user in admin
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
            );
          })
        )}
      </ul>

      <ConfirmationModal
        isOpen={bulkDeleteOpen}
        title="Delete selected notifications"
        message={`Permanently delete ${selectedIds.size} notification${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`}
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmVariant="danger"
        isConfirmLoading={bulkDeleting}
        onCancel={() => !bulkDeleting && setBulkDeleteOpen(false)}
        onConfirm={handleConfirmBulkDelete}
      />

      {toast && (
        <div className={styles.toast} role="status">
          {toast.message}
        </div>
      )}
    </motion.div>
  );
}
