import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSystemLogs } from '../../../api/adminApi';
import { FilterBar } from '../../../components/dashboard/FilterBar';
import pageStyles from '../DashboardPages.module.css';
import dataPageStyles from '../DataPage.module.css';
import styles from '../AdminPage.module.css';
import {
  AdminLogCard,
  PaginationBar,
  STORAGE_ADMIN_LOGS_PAGE_SIZE,
  formatDate,
  isDateInRange,
  readStoredPageSize,
} from './adminShared';

export function AdminLogsPage() {
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [logsPage, setLogsPage] = useState(1);
  const [logsRowsPerPage, setLogsRowsPerPage] = useState(() =>
    readStoredPageSize(STORAGE_ADMIN_LOGS_PAGE_SIZE)
  );
  const [logsFilterStart, setLogsFilterStart] = useState('');
  const [logsFilterEnd, setLogsFilterEnd] = useState('');

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
      localStorage.setItem(STORAGE_ADMIN_LOGS_PAGE_SIZE, String(logsRowsPerPage));
    } catch {
      /* ignore */
    }
  }, [logsRowsPerPage]);

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => isDateInRange(log.timestamp, logsFilterStart, logsFilterEnd)),
    [logs, logsFilterStart, logsFilterEnd]
  );

  const paginatedLogs = useMemo(() => {
    const start = (logsPage - 1) * logsRowsPerPage;
    return filteredLogs.slice(start, start + logsRowsPerPage);
  }, [filteredLogs, logsPage, logsRowsPerPage]);

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filteredLogs.length / logsRowsPerPage) || 1);
    if (logsPage > maxPage) {
      setLogsPage(maxPage);
    }
  }, [filteredLogs.length, logsRowsPerPage, logsPage]);

  useEffect(() => {
    setLogsPage(1);
  }, [logsFilterStart, logsFilterEnd]);

  const resetLogsFilters = useCallback(() => {
    setLogsFilterStart('');
    setLogsFilterEnd('');
    setLogsPage(1);
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const getStatusCodeClass = (statusCode) => {
    if (statusCode >= 500) return styles.statusError;
    if (statusCode >= 400) return styles.statusWarn;
    return styles.statusSuccess;
  };

  return (
    <>
      <header className={pageStyles.pageHeader}>
        <h1 className={pageStyles.pageTitle}>System logs</h1>
        <p className={pageStyles.pageSubtitle}>
          Recent API request metadata (method, route, status, timing, optional user id).
        </p>
      </header>

      <section className={styles.section}>
        {logsError && <div className={styles.error}>{logsError}</div>}
        {logsLoading && logs.length === 0 ? (
          <>
            <div className={styles.logsToolbarMinimal}>
              <button
                type="button"
                className={dataPageStyles.filterBarSecondaryBtn}
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
                className={dataPageStyles.filterBarSecondaryBtn}
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
                  extraContentPlacement="inline"
                  extraContent={
                    <button
                      type="button"
                      className={dataPageStyles.filterBarSecondaryBtn}
                      onClick={loadLogs}
                      disabled={logsLoading}
                    >
                      {logsLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  }
                />
              </div>
            </div>
            {filteredLogs.length === 0 ? (
              <p className={styles.info}>No log entries in this date range.</p>
            ) : (
              <>
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
    </>
  );
}
