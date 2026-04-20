import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConfirmationModal } from '../../../components/common/ConfirmationModal';
import { useAuth } from '../../../context/AuthContext';
import {
  deleteAdminUser,
  getAdminUsers,
  patchAdminUserForecastingAccess,
  updateAdminUserRole,
} from '../../../api/adminApi';
import { FilterBar } from '../../../components/dashboard/FilterBar';
import pageStyles from '../DashboardPages.module.css';
import dataPageStyles from '../DataPage.module.css';
import styles from '../AdminPage.module.css';
import {
  AdminUserCard,
  PaginationBar,
  STORAGE_ADMIN_USERS_PAGE_SIZE,
  formatDate,
  isDateInRange,
  readStoredPageSize,
} from './adminShared';

export function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightUserId = searchParams.get('highlight');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [pendingDeleteUser, setPendingDeleteUser] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [roleUpdatingUserId, setRoleUpdatingUserId] = useState('');
  const [forecastUpdatingUserId, setForecastUpdatingUserId] = useState('');
  const [pendingForecastEnableUser, setPendingForecastEnableUser] = useState(null);
  const [forecastEnableConfirmLoading, setForecastEnableConfirmLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersRowsPerPage, setUsersRowsPerPage] = useState(() =>
    readStoredPageSize(STORAGE_ADMIN_USERS_PAGE_SIZE)
  );
  const [usersFilterStart, setUsersFilterStart] = useState('');
  const [usersFilterEnd, setUsersFilterEnd] = useState('');

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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ADMIN_USERS_PAGE_SIZE, String(usersRowsPerPage));
    } catch {
      /* ignore */
    }
  }, [usersRowsPerPage]);

  const filteredUsers = useMemo(
    () =>
      users.filter((u) => isDateInRange(u.createdAt, usersFilterStart, usersFilterEnd)),
    [users, usersFilterStart, usersFilterEnd]
  );

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * usersRowsPerPage;
    return filteredUsers.slice(start, start + usersRowsPerPage);
  }, [filteredUsers, usersPage, usersRowsPerPage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredUsers.length / usersRowsPerPage) || 1);
    if (usersPage > maxPage) {
      setUsersPage(maxPage);
    }
  }, [filteredUsers.length, usersRowsPerPage, usersPage]);

  useEffect(() => {
    setUsersPage(1);
  }, [usersFilterStart, usersFilterEnd]);

  const resetUsersFilters = useCallback(() => {
    setUsersFilterStart('');
    setUsersFilterEnd('');
    setUsersPage(1);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (!highlightUserId || usersLoading) return;
    const id = window.setTimeout(() => {
      document.getElementById(`admin-user-${highlightUserId}`)?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }, 120);
    return () => window.clearTimeout(id);
  }, [highlightUserId, usersLoading, users]);

  const applyForecastingToggle = async (targetUser) => {
    const userId = targetUser?._id;
    if (!userId) return false;
    const nextEnabled = targetUser.forecastingAccessEnabled === false;
    setForecastUpdatingUserId(userId);
    setUsersError('');
    try {
      const data = await patchAdminUserForecastingAccess(userId, nextEnabled);
      const updated = data?.user;
      setUsers((prev) =>
        prev.map((item) =>
          item._id === userId
            ? {
                ...item,
                forecastingAccessEnabled:
                  updated?.forecastingAccessEnabled !== undefined
                    ? updated.forecastingAccessEnabled
                    : nextEnabled,
              }
            : item
        )
      );
      return true;
    } catch (error) {
      setUsersError(error?.message || 'Failed to update forecasting access.');
      return false;
    } finally {
      setForecastUpdatingUserId('');
    }
  };

  /** Enabling while consent is withdrawn requires explicit confirmation. */
  const requestForecastingToggle = (targetUser) => {
    const userId = targetUser?._id;
    if (!userId) return;
    const enabling = targetUser.forecastingAccessEnabled === false;
    if (enabling && targetUser.consentGiven === false) {
      setPendingForecastEnableUser(targetUser);
      return;
    }
    void applyForecastingToggle(targetUser);
  };

  const handleConfirmForecastEnableDespiteConsent = async () => {
    if (!pendingForecastEnableUser?._id) return;
    setForecastEnableConfirmLoading(true);
    const ok = await applyForecastingToggle(pendingForecastEnableUser);
    setForecastEnableConfirmLoading(false);
    if (ok) setPendingForecastEnableUser(null);
  };

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

  return (
    <>
      <header className={pageStyles.pageHeader}>
        <h1 className={pageStyles.pageTitle}>Users</h1>
        <p className={pageStyles.pageSubtitle}>
          View accounts, change roles, and remove users (you cannot delete your own account).
        </p>
      </header>

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
            </div>
            {filteredUsers.length === 0 ? (
              <p className={styles.info}>No users in this date range.</p>
            ) : (
              <>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Joined date</th>
                        <th>Consent status</th>
                        <th>Forecasting tools</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.map((row) => {
                        const isCurrentAdmin = row._id === currentUserId;
                        const disableHint = isCurrentAdmin ? 'You cannot modify your own account' : '';
                        const roleUpdating = roleUpdatingUserId === row._id;
                        const forecastUpdating = forecastUpdatingUserId === row._id;
                        const forecastingOn = row.forecastingAccessEnabled !== false;
                        const isHighlighted = highlightUserId && String(row._id) === highlightUserId;
                        return (
                          <tr
                            key={row._id}
                            id={`admin-user-${row._id}`}
                            className={isHighlighted ? styles.rowHighlight : undefined}
                          >
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
                                className={styles.roleToggle}
                                disabled={forecastUpdating}
                                onClick={() => requestForecastingToggle(row)}
                              >
                                {forecastUpdating
                                  ? 'Updating…'
                                  : forecastingOn
                                    ? 'Disable forecasting'
                                    : 'Enable forecasting'}
                              </button>
                            </td>
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
                    const forecastUpdating = forecastUpdatingUserId === row._id;
                    const isHighlighted = highlightUserId && String(row._id) === highlightUserId;
                    return (
                      <AdminUserCard
                        key={row._id}
                        row={row}
                        isCurrentAdmin={isCurrentAdmin}
                        roleUpdating={roleUpdating}
                        forecastUpdating={forecastUpdating}
                        disableHint={disableHint}
                        onRoleToggle={() => handleRoleToggle(row)}
                        onDelete={() => setPendingDeleteUser(row)}
                        onForecastingToggle={() => requestForecastingToggle(row)}
                        isHighlighted={isHighlighted}
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

      <ConfirmationModal
        isOpen={!!pendingForecastEnableUser}
        title="User has withdrawn forecasting consent"
        message={
          pendingForecastEnableUser ?
            `${pendingForecastEnableUser.name || pendingForecastEnableUser.email || 'This user'} has withdrawn consent for PredictIQ to process their financial data for forecasting. You should not turn forecasting tools back on unless they have agreed to restore consent in Settings. If you enable access anyway, they still cannot use forecasting until they turn consent back on.`
          : ''
        }
        cancelLabel="Cancel"
        confirmLabel="Enable forecasting anyway"
        onCancel={() => {
          if (!forecastEnableConfirmLoading) setPendingForecastEnableUser(null);
        }}
        onConfirm={handleConfirmForecastEnableDespiteConsent}
        isConfirmLoading={forecastEnableConfirmLoading}
        confirmVariant="danger"
      />
    </>
  );
}
