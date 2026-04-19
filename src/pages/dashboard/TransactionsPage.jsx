import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  getFinancialData,
  getFinancialRecords,
  getFinancialRecordIds,
  updateRecord,
  deleteRecord,
  deleteRecordsBulkAll,
} from '../../api/dataApi';
import { useFinancialRecords, EMPTY_FINANCIAL_CHART_MESSAGE } from '../../context/FinancialRecordsContext';
import { DataChartProjectionFooter } from '../../components/dashboard/DataChartProjectionFooter';
import { CSVUploadCard } from '../../components/dashboard/CSVUploadCard';
import { FilterBar } from '../../components/dashboard/FilterBar';
import styles from './DataPage.module.css';
import { paddedNumericDomain } from '../../utils/chartAxisDomain';
import {
  formatChartAxisGBP,
  formatGbp,
  formatGbpCompact,
  formatGbpFull,
  formatPercentPoints,
} from '../../utils/displayFormat';
import { getFuturePeriodLabels, projectForwardIndices } from '../../utils/seriesProjection';
import { chartProjectionStroke } from '../../theme';
import { useLegendToggleGroups } from '../../hooks/useLegendToggleGroups';
import { legendEntryDimmed, projectedLineHidden } from '../../utils/chartLegendVisibility';

const PERIODS = ['daily', 'weekly', 'monthly', 'yearly'];
const DEFAULT_PAGE_SIZE = 20;

const STORAGE_DATA_PROJECTION_STEPS = 'predictiq_data_chart_projection_horizon_steps';
const STORAGE_TRANSACTIONS_PAGE_SIZE = 'predictiq_transactions_rows_per_page';
const DEFAULT_RECORDS_SORT = 'date_desc';
const NOTES_SEARCH_DEBOUNCE_MS = 320;

/** Legend click toggles one dataKey; projected lines also hide when their actual series is hidden. */
const DATA_CHART_LEGEND_GROUPS = {
  revenue: ['revenue'],
  revProj: ['revProj'],
  expenses: ['expenses'],
  expProj: ['expProj'],
  grossProfit: ['grossProfit'],
  gpProj: ['gpProj'],
};

const DATA_CHART_ACTUAL_PROJ_PAIRS = [
  { actual: 'revenue', projected: 'revProj' },
  { actual: 'expenses', projected: 'expProj' },
  { actual: 'grossProfit', projected: 'gpProj' },
];

function readDataProjectionSteps() {
  if (typeof window === 'undefined') return 1;
  try {
    const n = Number.parseInt(localStorage.getItem(STORAGE_DATA_PROJECTION_STEPS), 10);
    return [1, 2, 3].includes(n) ? n : 1;
  } catch {
    return 1;
  }
}

function readTransactionsPageSize() {
  if (typeof window === 'undefined') return DEFAULT_PAGE_SIZE;
  try {
    const n = Number.parseInt(localStorage.getItem(STORAGE_TRANSACTIONS_PAGE_SIZE), 10);
    return [10, 20, 25, 50, 100].includes(n) ? n : DEFAULT_PAGE_SIZE;
  } catch {
    return DEFAULT_PAGE_SIZE;
  }
}

/** Local YYYY-MM-DD for calendar arithmetic (avoids UTC skew from toISOString). */
function formatLocalYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function marginClass(margin) {
  if (margin >= 30) return styles.marginGreen;
  if (margin >= 15) return styles.marginAmber;
  return styles.marginRed;
}

function kpiMarginClass(margin) {
  if (margin >= 30) return styles.kpiMarginGreen;
  if (margin >= 15) return styles.kpiMarginAmber;
  return styles.kpiMarginRed;
}

export function TransactionsPage() {
  const [period, setPeriod] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [chartData, setChartData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [tableRecords, setTableRecords] = useState([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(readTransactionsPageSize);
  const [tableSort, setTableSort] = useState(DEFAULT_RECORDS_SORT);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editRecord, setEditRecord] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectingAllIds, setSelectingAllIds] = useState(false);
  const selectAllRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [editRevenue, setEditRevenue] = useState(0);
  const [editExpenses, setEditExpenses] = useState(0);
  const [kpiView, setKpiView] = useState('average'); // 'average' | 'total'
  const [dataProjectionSteps, setDataProjectionSteps] = useState(readDataProjectionSteps);
  const [notesSearchInput, setNotesSearchInput] = useState('');
  const [notesSearchQuery, setNotesSearchQuery] = useState('');
  const {
    hasFinancialRecords,
    loadingRecords,
    refetchFinancialRecords,
    setFinancialRecordsPresence,
  } = useFinancialRecords();

  useEffect(() => {
    const t = window.setTimeout(() => {
      setNotesSearchQuery(notesSearchInput.trim());
    }, NOTES_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [notesSearchInput]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DATA_PROJECTION_STEPS, String(dataProjectionSteps));
    } catch {
      /* ignore */
    }
  }, [dataProjectionSteps]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TRANSACTIONS_PAGE_SIZE, String(rowsPerPage));
    } catch {
      /* ignore */
    }
  }, [rowsPerPage]);

  const fetchAggregated = useCallback(async () => {
    setChartLoading(true);
    try {
      const { data } = await getFinancialData({
        period,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      // This is filter-scoped; avoid setting global presence to false.
      if ((data?.records || []).length > 0) {
        setFinancialRecordsPresence(true);
      }
      setChartData(data);
      setSummary(data.summary || null);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Failed to load data');
    } finally {
      setChartLoading(false);
    }
  }, [period, startDate, endDate]);

  const fetchTable = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getFinancialRecords({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy: tableSort,
        notesSearch: notesSearchQuery || undefined,
        page,
        limit: rowsPerPage,
      });
      // Notes search can yield zero rows while the account still has data; only sync global presence without a notes filter.
      if (!notesSearchQuery) {
        setFinancialRecordsPresence((data?.total ?? 0) > 0);
      }
      setTableRecords(data.records || []);
      setTableTotal(data.total ?? 0);
      return data;
    } catch (err) {
      setError(err?.message || 'Failed to load records');
      return null;
    } finally {
      setLoading(false);
    }
  }, [endDate, notesSearchQuery, page, rowsPerPage, setFinancialRecordsPresence, startDate, tableSort]);

  const pageIds = useMemo(() => tableRecords.map((r) => String(r._id)), [tableRecords]);
  const allOnPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = pageIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    const el = selectAllRef.current;
    if (el && selectionMode) {
      el.indeterminate = someOnPageSelected && !allOnPageSelected;
    }
  }, [someOnPageSelected, allOnPageSelected, selectionMode]);

  /** Clear cross-page selection when date range or notes filter changes (not when paginating). */
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [startDate, endDate, notesSearchQuery]);

  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, tableSort, notesSearchQuery]);

  const selectedOnThisPage = useMemo(
    () => pageIds.filter((id) => selectedIds.has(id)).length,
    [pageIds, selectedIds]
  );

  const everyRecordSelected =
    tableTotal > 0 && selectedIds.size === tableTotal;

  const handleSelectEveryRecord = async () => {
    if (everyRecordSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectingAllIds(true);
    try {
      const { data } = await getFinancialRecordIds({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        notesSearch: notesSearchQuery || undefined,
      });
      const ids = data?.ids ?? [];
      setSelectedIds(new Set(ids.map(String)));
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'Could not load all record ids' });
    } finally {
      setSelectingAllIds(false);
    }
  };

  const toggleSelectAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleRowSelected = (id) => {
    const sid = String(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid);
      else next.add(sid);
      return next;
    });
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAggregated();
  }, [fetchAggregated, period, startDate, endDate]);

  useEffect(() => {
    fetchTable();
  }, [fetchTable]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setPeriod('yearly');
    setTableSort(DEFAULT_RECORDS_SORT);
    setRowsPerPage(10);
    setPage(1);
    setNotesSearchInput('');
    setNotesSearchQuery('');
  };

  const retry = () => {
    setError(null);
    setLoading(true);
    setChartLoading(true);
    refetchFinancialRecords();
    fetchAggregated().then(() => fetchTable());
  };

  const { hidden: dataChartLegendHidden, onLegendClick: onDataChartLegendClick } =
    useLegendToggleGroups(DATA_CHART_LEGEND_GROUPS);

  const chartSeries = (chartData?.records || []).map((r) => ({
    period: r.period,
    revenue: r.total_revenue,
    expenses: r.total_expenses,
    grossProfit: r.gross_profit,
  }));

  const { chartRowsForPlot, chartYDomain, showChartProjection } = useMemo(() => {
    const base = chartSeries.map((r) => ({
      ...r,
      revProj: null,
      expProj: null,
      gpProj: null,
    }));
    const baseDomain = () =>
      paddedNumericDomain([
        chartSeries.map((r) => r.revenue),
        chartSeries.map((r) => r.expenses),
        chartSeries.map((r) => r.grossProfit),
      ]);

    if (!hasFinancialRecords || chartSeries.length < 2) {
      return {
        chartRowsForPlot: base,
        chartYDomain: baseDomain(),
        showChartProjection: false,
      };
    }

    const lastPeriod = String(chartSeries[chartSeries.length - 1]?.period ?? '');
    const futureLabels = getFuturePeriodLabels(lastPeriod, period, dataProjectionSteps);
    if (!futureLabels) {
      return {
        chartRowsForPlot: base,
        chartYDomain: baseDomain(),
        showChartProjection: false,
      };
    }

    try {
      const hr = projectForwardIndices(
        chartSeries.map((r) => r.revenue),
        dataProjectionSteps
      );
      const he = projectForwardIndices(
        chartSeries.map((r) => r.expenses),
        dataProjectionSteps
      );
      const hg = projectForwardIndices(
        chartSeries.map((r) => r.grossProfit),
        dataProjectionSteps
      );
      if (hr.length === 0) {
        return {
          chartRowsForPlot: base,
          chartYDomain: baseDomain(),
          showChartProjection: false,
        };
      }

      const bridged = base.map((row, i) =>
        i === base.length - 1
          ? { ...row, revProj: row.revenue, expProj: row.expenses, gpProj: row.grossProfit }
          : row
      );
      const future = hr.map((rv, j) => ({
        period: futureLabels[j],
        revenue: null,
        expenses: null,
        grossProfit: null,
        revProj: rv,
        expProj: he[j],
        gpProj: hg[j],
      }));
      const merged = [...bridged, ...future];
      const yDomain = paddedNumericDomain([
        chartSeries.map((r) => r.revenue),
        chartSeries.map((r) => r.expenses),
        chartSeries.map((r) => r.grossProfit),
        merged.map((r) => r.revProj).filter((v) => v != null),
        merged.map((r) => r.expProj).filter((v) => v != null),
        merged.map((r) => r.gpProj).filter((v) => v != null),
      ]);
      return {
        chartRowsForPlot: merged,
        chartYDomain: yDomain,
        showChartProjection: true,
      };
    } catch {
      return {
        chartRowsForPlot: base,
        chartYDomain: baseDomain(),
        showChartProjection: false,
      };
    }
  }, [chartSeries, dataProjectionSteps, period, hasFinancialRecords]);

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editRecord?._id) return;
    const form = e.target;
    const total_revenue = editRevenue;
    const total_expenses = editExpenses;
    const ad_spend = Number(form.ad_spend?.value) || 0;
    const notes = (form.notes?.value || '').slice(0, 200);
    if (total_revenue < 0 || total_expenses < 0 || ad_spend < 0) {
      setToast({ type: 'error', message: 'Values must be non-negative' });
      return;
    }
    try {
      await updateRecord(editRecord._id, {
        total_revenue,
        total_expenses,
        gross_profit: total_revenue - total_expenses,
        ad_spend,
        notes,
      });
      setToast({ type: 'success', message: 'Record updated' });
      setEditRecord(null);
      fetchAggregated();
      fetchTable();
      refetchFinancialRecords();
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'Update failed' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?._id) return;
    try {
      await deleteRecord(deleteTarget._id);
      setToast({ type: 'success', message: 'Record deleted' });
      setDeleteTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(String(deleteTarget._id));
        return next;
      });
      fetchAggregated();
      fetchTable();
      refetchFinancialRecords();
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'Delete failed' });
    }
  };

  const handleConfirmBulkDelete = async () => {
    const ids = [...new Set(selectedIds)];
    if (ids.length === 0) return;
    setBulkDeleting(true);
    try {
      const result = await deleteRecordsBulkAll(ids);
      const n = result?.deletedCount ?? ids.length;
      setToast({ type: 'success', message: `Deleted ${n} record(s)` });
      setBulkDeleteOpen(false);
      setSelectedIds(new Set());
      setSelectionMode(false);
      await fetchAggregated();
      refetchFinancialRecords();
      const data = await fetchTable();
      if (data) {
        const total = data.total ?? 0;
        const recs = data.records?.length ?? 0;
        if (recs === 0 && total > 0) {
          const lastPage = Math.max(1, Math.ceil(total / rowsPerPage));
          setPage(lastPage);
        } else if (recs === 0 && total === 0) {
          setPage(1);
        }
      }
    } catch (err) {
      setToast({ type: 'error', message: err?.message || 'Bulk delete failed' });
    } finally {
      setBulkDeleting(false);
    }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const from = (page - 1) * rowsPerPage + 1;
  const to = Math.min(page * rowsPerPage, tableTotal);

  return (
    <motion.div
      className={styles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Transactions</h1>
        <p className={styles.pageSubtitle}>View, filter, and manage your transaction records</p>
      </header>

      <div className={styles.uploadSection}>
        <CSVUploadCard />
      </div>

      {/* SECTION 4 — Data table */}
      <div className={styles.tableSection}>
        <div className={styles.recordsHeaderRow}>
          <h2 className={styles.recordsTitle}>Records</h2>
          {!selectionMode ? (
            <button
              type="button"
              className={styles.btnSelectMode}
              onClick={() => setSelectionMode(true)}
            >
              Select to delete…
            </button>
          ) : (
            <div className={styles.selectionModeActions} role="toolbar" aria-label="Bulk selection">
              <span className={styles.bulkBarMeta}>
                {selectedIds.size > 0 ? (
                  <>
                    <strong>{selectedIds.size}</strong> selected
                    {pageIds.length > 0 && selectedOnThisPage < selectedIds.size && (
                      <>
                        {' '}
                        · <strong>{selectedOnThisPage}</strong> on this page
                      </>
                    )}
                  </>
                ) : (
                  'Tick rows on any page — selection is kept when you change pages'
                )}
              </span>
              {tableTotal > 0 && (
                <button
                  type="button"
                  className={styles.btnSelectMode}
                  disabled={selectingAllIds}
                  onClick={handleSelectEveryRecord}
                  aria-busy={selectingAllIds}
                >
                  {selectingAllIds
                    ? 'Loading…'
                    : everyRecordSelected
                      ? 'Deselect all'
                      : `Select all ${tableTotal} record${tableTotal === 1 ? '' : 's'}`}
                </button>
              )}
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
        <FilterBar
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          onReset={handleResetFilters}
          idPrefix="transactions-records-filter"
          variant="embedded"
          extraContent={(
            <div className={styles.recordsFilterExtras}>
              <div className={styles.filterSelectGroup}>
                <label className={styles.dateRangeLabel} htmlFor="transactions-records-sort">
                  Sort by
                </label>
                <select
                  id="transactions-records-sort"
                  className={styles.filterSelect}
                  value={tableSort}
                  onChange={(e) => setTableSort(e.target.value)}
                >
                  <option value="date_desc">Date: newest first</option>
                  <option value="date_asc">Date: oldest first</option>
                  <option value="revenue_desc">Revenue: high to low</option>
                  <option value="revenue_asc">Revenue: low to high</option>
                  <option value="expenses_desc">Expenses: high to low</option>
                  <option value="expenses_asc">Expenses: low to high</option>
                  <option value="gross_profit_desc">Gross profit: high to low</option>
                  <option value="gross_profit_asc">Gross profit: low to high</option>
                  <option value="ad_spend_desc">Ad spend: high to low</option>
                  <option value="ad_spend_asc">Ad spend: low to high</option>
                </select>
              </div>
              <div className={styles.filterSelectGroup}>
                <label className={styles.dateRangeLabel} htmlFor="transactions-records-notes-search">
                  Search notes
                </label>
                <input
                  id="transactions-records-notes-search"
                  type="search"
                  className={styles.recordsNotesSearchInput}
                  placeholder="e.g. payroll Q1"
                  value={notesSearchInput}
                  onChange={(e) => setNotesSearchInput(e.target.value)}
                  autoComplete="off"
                  spellCheck="false"
                  aria-describedby="transactions-records-notes-search-hint"
                />
              </div>
            </div>
          )}
        />
        <p id="transactions-records-notes-search-hint" className={styles.recordsSubtext}>
          The date range above filters these records too, including pagination and bulk selection.
          {notesSearchQuery ? (
            <> Showing rows whose notes contain every word in “{notesSearchQuery}” (not case-sensitive).</>
          ) : (
            <> Separate words with spaces; each word must appear somewhere in the notes column.</>
          )}
        </p>
        {loading && tableRecords.length === 0 ? (
          <div className={styles.tableSkeleton} />
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    {selectionMode && (
                      <th className={styles.tableCheckboxCol} scope="col">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={toggleSelectAllOnPage}
                          aria-label="Select all rows on this page"
                        />
                      </th>
                    )}
                    <th scope="col">Period</th>
                    <th scope="col">Revenue</th>
                    <th scope="col">Expenses</th>
                    <th scope="col">Gross Profit</th>
                    <th scope="col">Ad Spend</th>
                    <th scope="col">Profit Margin %</th>
                    <th scope="col">Notes</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRecords.map((r) => {
                    const notesRaw = String(r.notes ?? '').trim();
                    return (
                    <tr key={r._id}>
                      {selectionMode && (
                        <td className={styles.tableCheckboxCol}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(String(r._id))}
                            onChange={() => toggleRowSelected(r._id)}
                            aria-label={`Select record ${r.period || r.date}`}
                          />
                        </td>
                      )}
                      <td>{r.period || r.date}</td>
                      <td>{formatGbp(r.total_revenue)}</td>
                      <td>{formatGbp(r.total_expenses)}</td>
                      <td>{formatGbp(r.gross_profit)}</td>
                      <td>{formatGbp(r.ad_spend)}</td>
                      <td className={marginClass(r.profit_margin)}>{formatPercentPoints(r.profit_margin ?? 0, 1)}</td>
                      <td className={styles.tableNotesCell}>
                        <span
                          className={styles.tableNotesClamp}
                          title={notesRaw ? notesRaw : undefined}
                        >
                          {notesRaw || '—'}
                        </span>
                      </td>
                      <td className={styles.tableActionsCell}>
                        <div className={styles.actionsCell}>
                          <button
                            type="button"
                            className="pq-btn-danger-zone pq-btn--table-action"
                            onClick={() => {
                            setEditRecord(r);
                            setEditRevenue(Number(r.total_revenue) || 0);
                            setEditExpenses(Number(r.total_expenses) || 0);
                          }}
                            aria-label={`Edit record ${r.period}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="pq-btn-danger-red pq-btn--table-action"
                            onClick={() => setDeleteTarget(r)}
                            aria-label={`Delete record ${r.period}`}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className={styles.pagination}>
              <div className={styles.paginationMeta}>
                <span>
                  Showing {tableTotal === 0 ? 0 : from}-{to} of {tableTotal} record
                  {tableTotal === 1 ? '' : 's'}
                </span>
                <label className={styles.rowsPerPage}>
                  <span>Rows per page</span>
                  <select
                    value={rowsPerPage}
                    onChange={(e) => {
                      const next = Number(e.target.value) || DEFAULT_PAGE_SIZE;
                      setRowsPerPage(next);
                      setPage(1);
                    }}
                    aria-label="Rows per page"
                  >
                    {[10, 20, 25, 50, 100].map((n) => (
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
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page * rowsPerPage >= tableTotal}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {editRecord && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditRecord(null)}
          >
            <motion.div
              className={styles.modal}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={styles.modalTitle}>Edit record</h3>
              <form onSubmit={handleSaveEdit}>
                <div className={styles.formGroup}>
                  <label htmlFor="edit-date">Date</label>
                  <input
                    id="edit-date"
                    name="date"
                    type="text"
                    readOnly
                    value={editRecord.period || editRecord.date}
                    style={{ background: 'var(--color-border-light)', opacity: 0.8 }}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="edit-revenue">Total Revenue</label>
                  <input
                    id="edit-revenue"
                    name="total_revenue"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editRevenue}
                    onChange={(e) => setEditRevenue(Number(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="edit-expenses">Total Expenses</label>
                  <input
                    id="edit-expenses"
                    name="total_expenses"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editExpenses}
                    onChange={(e) => setEditExpenses(Number(e.target.value) || 0)}
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="edit-gross">Gross Profit (auto)</label>
                  <input
                    id="edit-gross"
                    type="text"
                    readOnly
                    value={editRevenue - editExpenses}
                    style={{ background: 'var(--color-border-light)', opacity: 0.8 }}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="edit-adspend">Ad Spend</label>
                  <input
                    id="edit-adspend"
                    name="ad_spend"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editRecord.ad_spend ?? 0}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="edit-notes">Notes</label>
                  <textarea
                    id="edit-notes"
                    name="notes"
                    maxLength={200}
                    defaultValue={editRecord.notes}
                  />
                </div>
                <div className={styles.modalActions}>
                  <button type="button" className={styles.btnCancel} onClick={() => setEditRecord(null)}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.btnSave}>
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              className={`${styles.modal} ${styles.deleteConfirm}`}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={styles.modalTitle}>Delete record</h3>
              <p>Delete record for {deleteTarget.period || deleteTarget.date}? This cannot be undone.</p>
              <div className={styles.modalActions}>
                <button type="button" className={styles.btnCancel} onClick={() => setDeleteTarget(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.btnSave} ${styles.btnConfirmDelete}`}
                  onClick={handleConfirmDelete}
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk delete confirmation */}
      <AnimatePresence>
        {bulkDeleteOpen && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !bulkDeleting && setBulkDeleteOpen(false)}
          >
            <motion.div
              className={`${styles.modal} ${styles.deleteConfirm}`}
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={styles.modalTitle}>Delete selected records</h3>
              <p>
                Permanently delete <strong>{selectedIds.size}</strong> record
                {selectedIds.size === 1 ? '' : 's'}? This cannot be undone.
              </p>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.btnCancel}
                  disabled={bulkDeleting}
                  onClick={() => setBulkDeleteOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.btnSave} ${styles.btnConfirmDelete}`}
                  disabled={bulkDeleting}
                  onClick={handleConfirmBulkDelete}
                >
                  {bulkDeleting ? 'Deleting…' : 'Confirm delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {toast && (
        <div className={styles.toast} role="status">
          {toast.message}
        </div>
      )}
    </motion.div>
  );
}
