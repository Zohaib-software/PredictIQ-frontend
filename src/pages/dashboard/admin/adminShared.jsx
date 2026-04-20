import styles from '../AdminPage.module.css';

export const STORAGE_ADMIN_USERS_PAGE_SIZE = 'predictiq_admin_users_rows_per_page';
export const STORAGE_ADMIN_LOGS_PAGE_SIZE = 'predictiq_admin_logs_rows_per_page';
export const STORAGE_ADMIN_FEEDBACK_PAGE_SIZE = 'predictiq_admin_feedback_rows_per_page';
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 20, 25, 50];

export function readStoredPageSize(storageKey) {
  if (typeof window === 'undefined') return DEFAULT_PAGE_SIZE;
  try {
    const n = Number.parseInt(localStorage.getItem(storageKey), 10);
    return PAGE_SIZE_OPTIONS.includes(n) ? n : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

export function formatDate(value) {
  if (!value) return 'Unknown';
  return new Date(value).toLocaleString();
}

export function formatFeedbackCategory(value) {
  if (value === 'bug') return 'Bug';
  if (value === 'idea') return 'Suggestion';
  return 'Other';
}

/** Inclusive date-range match on the calendar day in local time (YYYY-MM-DD bounds from date inputs). */
export function isDateInRange(dateValue, startYmd, endYmd) {
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

/** Matches FilterBar local YYYY-MM-DD semantics for server-side feedback queries */
export function feedbackYmdRangeToIso(startYmd, endYmd) {
  const range = {};
  if (startYmd) {
    const [y, m, d] = startYmd.split('-').map(Number);
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      range.createdAfter = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
    }
  }
  if (endYmd) {
    const [y, m, d] = endYmd.split('-').map(Number);
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      range.createdBefore = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
    }
  }
  return range;
}

export function AdminUserCard({
  row,
  isCurrentAdmin,
  roleUpdating,
  forecastUpdating,
  disableHint,
  onRoleToggle,
  onDelete,
  onForecastingToggle,
  isHighlighted,
}) {
  const forecastingOn = row.forecastingAccessEnabled !== false;
  return (
    <article
      className={`${styles.adminCard} ${isHighlighted ? styles.rowHighlight : ''}`}
      id={row._id ? `admin-user-${row._id}` : undefined}
    >
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
        <div className={styles.adminCardStat}>
          <dt>Forecasting tools</dt>
          <dd>{forecastingOn ? 'Enabled' : 'Disabled'}</dd>
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
          className={styles.roleToggle}
          disabled={forecastUpdating}
          onClick={onForecastingToggle}
        >
          {forecastUpdating ? 'Updating…' : forecastingOn ? 'Disable forecasting' : 'Enable forecasting'}
        </button>
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

export function PaginationBar({
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

export function FeedbackCard({ row }) {
  return (
    <article className={styles.adminCard}>
      <div className={styles.adminCardHeader}>
        <h3 className={styles.adminCardTitle}>{formatDate(row.createdAt)}</h3>
        <p className={styles.adminCardSubtitle}>{formatFeedbackCategory(row.category)}</p>
      </div>
      <dl className={styles.adminCardGrid}>
        <div className={`${styles.adminCardStat} ${styles.adminCardStatWide}`}>
          <dt>Page</dt>
          <dd className={styles.feedbackPage}>{row.page || '—'}</dd>
        </div>
        <div className={`${styles.adminCardStat} ${styles.adminCardStatWide}`}>
          <dt>Message</dt>
          <dd className={styles.feedbackMessage}>{row.message}</dd>
        </div>
      </dl>
    </article>
  );
}

export function AdminLogCard({ log, statusClassName }) {
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
