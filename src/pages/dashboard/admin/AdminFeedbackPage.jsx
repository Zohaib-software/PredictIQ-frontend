import { useCallback, useEffect, useState } from 'react';
import { getAdminFeedback } from '../../../api/adminApi';
import { FilterBar } from '../../../components/dashboard/FilterBar';
import pageStyles from '../DashboardPages.module.css';
import dataPageStyles from '../DataPage.module.css';
import styles from '../AdminPage.module.css';
import {
  FeedbackCard,
  PaginationBar,
  STORAGE_ADMIN_FEEDBACK_PAGE_SIZE,
  formatDate,
  formatFeedbackCategory,
  feedbackYmdRangeToIso,
  readStoredPageSize,
} from './adminShared';

export function AdminFeedbackPage() {
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [feedbackRowsPerPage, setFeedbackRowsPerPage] = useState(() =>
    readStoredPageSize(STORAGE_ADMIN_FEEDBACK_PAGE_SIZE)
  );
  const [feedbackFilterStart, setFeedbackFilterStart] = useState('');
  const [feedbackFilterEnd, setFeedbackFilterEnd] = useState('');

  const loadFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    setFeedbackError('');
    try {
      const range = feedbackYmdRangeToIso(feedbackFilterStart, feedbackFilterEnd);
      const data = await getAdminFeedback(feedbackPage, feedbackRowsPerPage, range);
      setFeedbackItems(data?.feedback ?? []);
      setFeedbackTotal(typeof data?.total === 'number' ? data.total : 0);
    } catch (error) {
      setFeedbackError(error?.message || 'Failed to load feedback.');
    } finally {
      setFeedbackLoading(false);
    }
  }, [feedbackPage, feedbackRowsPerPage, feedbackFilterStart, feedbackFilterEnd]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ADMIN_FEEDBACK_PAGE_SIZE, String(feedbackRowsPerPage));
    } catch {
      /* ignore */
    }
  }, [feedbackRowsPerPage]);

  useEffect(() => {
    setFeedbackPage(1);
  }, [feedbackFilterStart, feedbackFilterEnd]);

  const resetFeedbackFilters = useCallback(() => {
    setFeedbackFilterStart('');
    setFeedbackFilterEnd('');
    setFeedbackPage(1);
  }, []);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(feedbackTotal / feedbackRowsPerPage) || 1);
    if (feedbackPage > lastPage) {
      setFeedbackPage(lastPage);
    }
  }, [feedbackTotal, feedbackRowsPerPage, feedbackPage]);

  return (
    <>
      <header className={pageStyles.pageHeader}>
        <h1 className={pageStyles.pageTitle}>Feedback</h1>
        <p className={pageStyles.pageSubtitle}>
          Anonymous messages from visitors and signed-in users (no names or emails stored).
        </p>
      </header>

      <section className={styles.section}>
        {feedbackError && <div className={styles.error}>{feedbackError}</div>}
        <div className={styles.adminFilterToolbarOuter}>
          <div
            className={`${dataPageStyles.transactionsRecordsFilters} ${styles.adminFilterToolbarInner}`}
          >
            <FilterBar
              startDate={feedbackFilterStart}
              onStartDateChange={setFeedbackFilterStart}
              endDate={feedbackFilterEnd}
              onEndDateChange={setFeedbackFilterEnd}
              onReset={resetFeedbackFilters}
              idPrefix="admin-feedback-filter"
              variant="embedded"
              extraContentPlacement="inline"
              extraContent={
                <button
                  type="button"
                  className={dataPageStyles.filterBarSecondaryBtn}
                  onClick={loadFeedback}
                  disabled={feedbackLoading}
                >
                  {feedbackLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              }
            />
          </div>
        </div>

        {feedbackLoading && feedbackItems.length === 0 ? (
          <p className={styles.info}>Loading feedback...</p>
        ) : feedbackTotal === 0 && !feedbackLoading ? (
          <p className={styles.info}>
            {feedbackFilterStart || feedbackFilterEnd
              ? 'No feedback in this date range.'
              : 'No feedback submitted yet.'}
          </p>
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.table} aria-label="User feedback">
                <thead>
                  <tr>
                    <th>Submitted</th>
                    <th>Type</th>
                    <th>Page</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackItems.map((row) => (
                    <tr key={row._id}>
                      <td>{formatDate(row.createdAt)}</td>
                      <td>{formatFeedbackCategory(row.category)}</td>
                      <td className={styles.feedbackPageCell}>{row.page || '—'}</td>
                      <td className={styles.feedbackMessageCell} title={row.message}>
                        {row.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.cardList} aria-label="User feedback">
              {feedbackItems.map((row) => (
                <FeedbackCard key={row._id} row={row} />
              ))}
            </div>
            <PaginationBar
              page={feedbackPage}
              onPageChange={setFeedbackPage}
              rowsPerPage={feedbackRowsPerPage}
              onRowsPerPageChange={(next) => {
                setFeedbackRowsPerPage(next);
                setFeedbackPage(1);
              }}
              total={feedbackTotal}
              noun={feedbackTotal === 1 ? 'message' : 'messages'}
            />
          </>
        )}
      </section>
    </>
  );
}
