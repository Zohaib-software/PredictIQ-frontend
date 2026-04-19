import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import { useAuth } from '../../context/AuthContext';
import {
  deleteAdminUser,
  getAdminUsers,
  getSystemLogs,
  updateAdminUserRole,
} from '../../api/adminApi';
import pageStyles from './DashboardPages.module.css';
import styles from './AdminPage.module.css';

const TABS = {
  users: 'users',
  logs: 'logs',
};

function formatDate(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

export function AdminPage() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState(TABS.users);
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [logsError, setLogsError] = useState('');
  const [pendingDeleteUser, setPendingDeleteUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [roleUpdatingUserId, setRoleUpdatingUserId] = useState('');

  const currentUserId = useMemo(
    () => currentUser?._id || currentUser?.id || '',
    [currentUser?._id, currentUser?.id]
  );

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const data = await getAdminUsers();
      setUsers(data?.users ?? []);
    } catch (error) {
      setUsersError(error?.message || 'Failed to load users.');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError('');
    try {
      const data = await getSystemLogs();
      setLogs(data?.logs ?? []);
    } catch (error) {
      setLogsError(error?.message || 'Failed to load system logs.');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === TABS.users) {
      loadUsers();
    }
  }, [activeTab, loadUsers]);

  useEffect(() => {
    if (activeTab === TABS.logs) {
      loadLogs();
    }
  }, [activeTab, loadLogs]);

  const handleRoleToggle = async (targetUser) => {
    const userId = targetUser?._id;
    if (!userId) return;
    const nextRole = targetUser.role === 'admin' ? 'user' : 'admin';

    setRoleUpdatingUserId(userId);
    setUsersError('');
    try {
      const data = await updateAdminUserRole(userId, nextRole);
      const updatedUser = data?.user;
      setUsers((prev) =>
        prev.map((item) =>
          item._id === userId ? { ...item, role: updatedUser?.role ?? nextRole } : item
        )
      );
    } catch (error) {
      setUsersError(error?.message || 'Failed to update role.');
    } finally {
      setRoleUpdatingUserId('');
    }
  };

  const handleDeleteUser = async () => {
    if (!pendingDeleteUser?._id) return;
    setDeleteLoading(true);
    setUsersError('');
    try {
      await deleteAdminUser(pendingDeleteUser._id);
      setUsers((prev) => prev.filter((item) => item._id !== pendingDeleteUser._id));
      setPendingDeleteUser(null);
    } catch (error) {
      setUsersError(error?.message || 'Failed to delete user.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const getStatusCodeClass = (statusCode) => {
    if (statusCode >= 500) return styles.statusError;
    if (statusCode >= 400) return styles.statusWarn;
    return styles.statusSuccess;
  };

  return (
    <motion.div
      className={pageStyles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <header className={pageStyles.pageHeader}>
        <h1 className={pageStyles.pageTitle}>Admin</h1>
        <p className={pageStyles.pageSubtitle}>Manage users and inspect recent system activity.</p>
      </header>

      <div className={styles.tabRow}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === TABS.users ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab(TABS.users)}
        >
          Users
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === TABS.logs ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab(TABS.logs)}
        >
          System Logs
        </button>
      </div>

      {activeTab === TABS.users && (
        <section className={styles.section}>
          {usersError && <div className={styles.error}>{usersError}</div>}
          {usersLoading ? (
            <p className={styles.info}>Loading users...</p>
          ) : users.length === 0 ? (
            <p className={styles.info}>No users found.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined date</th>
                    <th>Consent status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((row) => {
                    const isCurrentAdmin = row._id === currentUserId;
                    const disableHint = isCurrentAdmin ? 'You cannot modify your own account' : '';
                    const roleUpdating = roleUpdatingUserId === row._id;
                    return (
                      <tr key={row._id}>
                        <td>{row.name || 'Unknown'}</td>
                        <td>{row.email}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.roleToggle}
                            disabled={isCurrentAdmin || roleUpdating}
                            onClick={() => handleRoleToggle(row)}
                            title={disableHint}
                          >
                            {roleUpdating ? 'Updating...' : row.role}
                          </button>
                        </td>
                        <td>{formatDate(row.createdAt)}</td>
                        <td>{row.consentGiven ? 'Granted' : 'Withdrawn'}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            disabled={isCurrentAdmin}
                            onClick={() => setPendingDeleteUser(row)}
                            title={disableHint}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === TABS.logs && (
        <section className={styles.section}>
          <div className={styles.logsHeader}>
            <button
              type="button"
              className={styles.refreshBtn}
              onClick={loadLogs}
              disabled={logsLoading}
            >
              {logsLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          {logsError && <div className={styles.error}>{logsError}</div>}
          {logsLoading && logs.length === 0 ? (
            <p className={styles.info}>Loading logs...</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Method</th>
                    <th>Route</th>
                    <th>Status Code</th>
                    <th>User ID</th>
                    <th>Response Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <tr key={`${log.timestamp}-${log.route}-${index}`}>
                      <td>{formatDate(log.timestamp)}</td>
                      <td>{log.method}</td>
                      <td>{log.route}</td>
                      <td>
                        <span className={getStatusCodeClass(log.statusCode)}>{log.statusCode}</span>
                      </td>
                      <td>{log.userId || 'N/A'}</td>
                      <td>{log.responseTimeMs} ms</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan="6" className={styles.infoCell}>
                        No logs available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <ConfirmationModal
        isOpen={!!pendingDeleteUser}
        title="Delete User Account"
        message={`Are you sure you want to delete ${pendingDeleteUser?.name || pendingDeleteUser?.email || 'this user'}?`}
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onCancel={() => {
          if (!deleteLoading) setPendingDeleteUser(null);
        }}
        onConfirm={handleDeleteUser}
        isConfirmLoading={deleteLoading}
        confirmVariant="danger"
      />
    </motion.div>
  );
}
