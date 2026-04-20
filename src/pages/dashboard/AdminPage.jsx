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
import { FilterBar } from '../../components/dashboard/FilterBar';
import pageStyles from './DashboardPages.module.css';
import dataPageStyles from './DataPage.module.css';
import styles from './AdminPage.module.css';

const TABS = {
  users: 'users',
  logs: 'logs',
};

const STORAGE_ADMIN_USERS_PAGE_SIZE = 'predictiq_admin_users_rows_per_page';
const STORAGE_ADMIN_LOGS_PAGE_SIZE = 'predictiq_admin_logs_rows_per_page';
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 25, 50];

function readStoredPageSize(storageKey) {
  if (typeof window === 'undefined') return DEFAULT_PAGE_SIZE;
  try {
    const n = Number.parseInt(localStorage.getItem(storageKey), 10);
    return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

function formatDate(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

/** Inclusive date-range match on the calendar day in local time (YYYY-MM-DD bounds from date inputs). */
function isDateInRange(dateValue, startYmd, endYmd) {
  if (!startYmd && !endYmd) return true;
  if (dateValue == null) return false;
  const t = new Date(dateValue);
  if (Number.isNaN(t.getTime())) return false;
  const dayMs = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  if (startYmd) {
    const [y, m, d] = startYmd.split('-').map(Number);
    const start = new Date(y, m - 1, d).getTime();
    if (dayMs < start) return false;
  }
  if (endYmd) {
    const [y, m, d] = endYmd.split('-').map(Number);
    const end = new Date(y, m - 1, d).getTime();
    if (dayMs > end) return false;
  }
  return true;
}

function AdminUserCard({
  row,
  isCurrentAdmin,
  roleUpdating,
  disableHint,
  onRoleToggle,
  onDelete,
}) {
  return (
    <article className={styles.adminCard}>
      <div className={styles.adminCardHeader}>
        <h3 className={styles.adminCardTitle}>{row.name || 'Unknown'}</h3>
        <p className={styles.adminCardSubtitle}>{row.email}</p>
      </div>
      <dl className={styles.adminCardGrid}>
        <div className={styles.adminCardStat}>
          <dt>Joined</dt>
          <dd>{formatDate(row.createdAt)}</dd>
        </div>
        <div className={styles.adminCardStat}>
          <dt>Consent</dt>
          <dd>{row.consentGiven ? 'Granted' : 'Withdrawn'}</dd>
        </div>
        <div className={`${styles.adminCardStat} ${styles.adminCardStatWide}`}>
          <dt>Role</dt>
          <dd className={styles.adminCardRoleCell}>
            <button
              type="button"
              className={styles.roleToggle}
              disabled={isCurrentAdmin || roleUpdating}
              onClick={onRoleToggle}
              title={disableHint}
            >
              {roleUpdating ? 'Updating...' : row.role}
            </button>
          </dd>
        </div>
      </dl>
      <div className={styles.adminCardActions}>
        <button
          type="button"
          className={styles.deleteBtn}
          disabled={isCurrentAdmin}
          onClick={onDelete}
          title={disableHint}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function PaginationBar({
  page,
  onPageChange,
  rowsPerPage,
  onRowsPerPageChange,
  total,
  noun,
}) {
  const from = total === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const to = Math.min(page * rowsPerPage, total);
  const lastPage = Math.max(1, Math.ceil(total / rowsPerPage) || 1);

  return (
    <div className={styles.pagination}>
      <div className={styles.paginationMeta}>
        <span>
          Showing {total === 0 ? 0 : `${from}–${to}`} of {total} {noun}
        </span>
        <label className={styles.rowsPerPage}>
          <span>Rows per page</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              const next = Number(e.target.value) || DEFAULT_PAGE_SIZE;
              onRowsPerPageChange(next);
              onPageChange(1);
            }}
            aria-label="Rows per page"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.paginationBtns}>
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= lastPage || total === 0}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function AdminLogCard({ log, statusClassName }) {
  return (
    <article className={styles.adminCard}>
      <div className={styles.adminCardHeader}>
        <h3 className={styles.adminCardTitle}>{formatDate(log.timestamp)}</h3>
        <p className={styles.adminCardRoute}>
          <span className={styles.adminCardMethod}>{log.method}</span>{' '}
          <span className={styles.adminCardRoutePath}>{log.route}</span>
        </p>
      </div>
      <dl className={styles.adminCardGrid}>
        <div className={styles.adminCardStat}>
          <dt>Status</dt>
          <dd>
            <span className={statusClassName}>{log.statusCode}</span>
          </dd>
        </div>
        <div className={styles.adminCardStat}>
          <dt>User ID</dt>
          <dd className={styles.adminCardMono}>{log.userId || 'N/A'}</dd>
        </div>
        <div className={`${styles.adminCardStat} ${styles.adminCardStatWide}`}>
          <dt>Response time</dt>
          <dd>{log.responseTimeMs} ms</dd>
        </div>
      </dl>
    </article>
  );
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
  const [usersPage, setUsersPage] = useState(1);
  const [usersRowsPerPage, setUsersRowsPerPage] = useState(() =>
    readStoredPageSize(STORAGE_ADMIN_USERS_PAGE_SIZE)
  );
  const [logsPage, setLogsPage] = useState(1);
  const [logsRowsPerPage, setLogsRowsPerPage] = useState(() =>
    readStoredPageSize(STORAGE_ADMIN_LOGS_PAGE_SIZE)
  );
  const [usersFilterStart, setUsersFilterStart] = useState('');
  const [usersFilterEnd, setUsersFilterEnd] = useState('');
  const [logsFilterStart, setLogsFilterStart] = useState('');
  const [logsFilterEnd, setLogsFilterEnd] = useState('');

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
    try {
      localStorage.setItem(STORAGE_ADMIN_USERS_PAGE_SIZE, String(usersRowsPerPage));
    } catch {
      /* ignore */
    }
  }, [usersRowsPerPage]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ADMIN_LOGS_PAGE_SIZE, String(logsRowsPerPage));
    } catch {
      /* ignore */
    }
  }, [logsRowsPerPage]);

  const filteredUsers = useMemo(
    () =>
      users.filter((u) => isDateInRange(u.createdAt, usersFilterStart, usersFilterEnd)),
    [users, usersFilterStart, usersFilterEnd]
  );

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => isDateInRange(log.timestamp, logsFilterStart, logsFilterEnd)),
    [logs, logsFilterStart, logsFilterEnd]
  );

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * usersRowsPerPage;
    return filteredUsers.slice(start, start + usersRowsPerPage);
  }, [filteredUsers, usersPage, usersRowsPerPage]);

  const paginatedLogs = useMemo(() => {
    const start = (logsPage - 1) * logsRowsPerPage;
    return filteredLogs.slice(start, start + logsRowsPerPage);
  }, [filteredLogs, logsPage, logsRowsPerPage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredUsers.length / usersRowsPerPage) || 1);
    if (usersPage > maxPage) {
      setUsersPage(maxPage);
    }
  }, [filteredUsers.length, usersRowsPerPage, usersPage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredLogs.length / logsRowsPerPage) || 1);
    if (logsPage > maxPage) {
      setLogsPage(maxPage);
    }
  }, [filteredLogs.length, logsRowsPerPage, logsPage]);

  useEffect(() => {
    setUsersPage(1);
  }, [usersFilterStart, usersFilterEnd]);

  useEffect(() => {
    setLogsPage(1);
  }, [logsFilterStart, logsFilterEnd]);

  const resetUsersFilters = useCallback(() => {
    setUsersFilterStart('');
    setUsersFilterEnd('');
    setUsersPage(1);
  }, []);

  const resetLogsFilters = useCallback(() => {
    setLogsFilterStart('');
    setLogsFilterEnd('');
    setLogsPage(1);
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
            <>
              <div className={styles.adminFilterToolbarOuter}>
                <div
                  className={`${dataPageStyles.transactionsRecordsFilters} ${styles.adminFilterToolbarInner}`}
                >
                  <FilterBar
                    startDate={usersFilterStart}
                    onStartDateChange={setUsersFilterStart}
                    endDate={usersFilterEnd}
                    onEndDateChange={setUsersFilterEnd}
                    onReset={resetUsersFilters}
                    idPrefix="admin-users-filter"
                    variant="embedded"
                  />
                </div>
                <p
                  className={`${styles.filterHint} ${styles.adminFilterToolbarFootnote}`}
                  id="admin-users-filter-hint"
                >
                  The date range filters users by <strong>joined date</strong>. Pagination applies to the
                  filtered list.
                </p>
              </div>
              {filteredUsers.length === 0 ? (
                <p className={styles.info}>No users in this date range.</p>
              ) : (
                <>
                  <div className={styles.tableWrap}>
                    <table className={styles.table} aria-describedby="admin-users-filter-hint">
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
                        {paginatedUsers.map((row) => {
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
                  <div className={styles.cardList} aria-label="Users">
                    {paginatedUsers.map((row) => {
                      const isCurrentAdmin = row._id === currentUserId;
                      const disableHint = isCurrentAdmin ? 'You cannot modify your own account' : '';
                      const roleUpdating = roleUpdatingUserId === row._id;
                      return (
                        <AdminUserCard
                          key={row._id}
                          row={row}
                          isCurrentAdmin={isCurrentAdmin}
                          roleUpdating={roleUpdating}
                          disableHint={disableHint}
                          onRoleToggle={() => handleRoleToggle(row)}
                          onDelete={() => setPendingDeleteUser(row)}
                        />
                      );
                    })}
                  </div>
                  <PaginationBar
                    page={usersPage}
                    onPageChange={setUsersPage}
                    rowsPerPage={usersRowsPerPage}
                    onRowsPerPageChange={setUsersRowsPerPage}
                    total={filteredUsers.length}
                    noun={filteredUsers.length === 1 ? 'user' : 'users'}
                  />
                </>
              )}
            </>
          )}
        </section>
      )}

      {activeTab === TABS.logs && (
        <section className={styles.section}>
          {logsError && <div className={styles.error}>{logsError}</div>}
          {logsLoading && logs.length === 0 ? (
            <>
              <div className={styles.logsToolbarMinimal}>
                <button
                  type="button"
                  className={styles.refreshBtn}
                  onClick={loadLogs}
                  disabled={logsLoading}
                >
                  Refreshing...
                </button>
              </div>
              <p className={styles.info}>Loading logs...</p>
            </>
          ) : logs.length === 0 ? (
            <>
              <div className={styles.logsToolbarMinimal}>
                <button
                  type="button"
                  className={styles.refreshBtn}
                  onClick={loadLogs}
                  disabled={logsLoading}
                >
                  {logsLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              <p className={styles.info}>No logs available yet.</p>
            </>
          ) : (
            <>
              <div className={styles.adminFilterToolbarOuter}>
                <div
                  className={`${dataPageStyles.transactionsRecordsFilters} ${styles.adminFilterToolbarInner}`}
                >
                  <FilterBar
                    startDate={logsFilterStart}
                    onStartDateChange={setLogsFilterStart}
                    endDate={logsFilterEnd}
                    onEndDateChange={setLogsFilterEnd}
                    onReset={resetLogsFilters}
                    idPrefix="admin-logs-filter"
                    variant="embedded"
                    extraContent={
                      <button
                        type="button"
                        className={styles.refreshBtn}
                        onClick={loadLogs}
                        disabled={logsLoading}
                      >
                        {logsLoading ? 'Refreshing...' : 'Refresh'}
                      </button>
                    }
                  />
                </div>
                <p
                  className={`${styles.filterHint} ${styles.adminFilterToolbarFootnote}`}
                  id="admin-logs-filter-hint"
                >
                  The date range filters log rows by <strong>request timestamp</strong>. Pagination applies
                  to the filtered list.
                </p>
              </div>
              {filteredLogs.length === 0 ? (
                <p className={styles.info}>No log entries in this date range.</p>
              ) : (
                <>
                  <div className={styles.tableWrap}>
                    <table className={styles.table} aria-describedby="admin-logs-filter-hint">
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
                        {paginatedLogs.map((log, index) => (
                          <tr key={`${logsPage}-${log.timestamp}-${log.route}-${index}`}>
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
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.cardList} aria-label="System logs">
                    {paginatedLogs.map((log, index) => (
                      <AdminLogCard
                        key={`${logsPage}-${log.timestamp}-${log.route}-${index}`}
                        log={log}
                        statusClassName={getStatusCodeClass(log.statusCode)}
                      />
                    ))}
                  </div>
                  <PaginationBar
                    page={logsPage}
                    onPageChange={setLogsPage}
                    rowsPerPage={logsRowsPerPage}
                    onRowsPerPageChange={setLogsRowsPerPage}
                    total={filteredLogs.length}
                    noun={filteredLogs.length === 1 ? 'entry' : 'entries'}
                  />
                </>
              )}
            </>
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
