import { useState, useCallback, useRef, useEffect } from 'react';
import * as yup from 'yup';
import { useFinancialRecords } from '../../context/FinancialRecordsContext';
import { motion } from 'framer-motion';
import {
  deleteUploadDocument,
  fetchUploadDocuments,
  uploadCSVRowsWithProgress,
} from '../../api/uploadApi';
import { formatGbp } from '../../utils/displayFormat';
import { clearChartCache } from '../../utils/chartCache';
import { ConfirmationModal } from '../../components/common/ConfirmationModal';
import settingsStyles from '../../pages/dashboard/SettingsPage.module.css';
import styles from './CSVUploadCard.module.css';

const ACCEPTED_TYPES = ['text/csv', 'application/csv', 'text/plain'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const csvFileSchema = yup
  .mixed()
  .required('Please select a CSV file to upload.')
  .test('is-csv', 'Please select a CSV file (.csv).', (value) => {
    if (!value) return false;
    return ACCEPTED_TYPES.includes(value.type) || /\.csv$/i.test(value.name);
  })
  .test('max-size', 'CSV file must be 5MB or smaller.', (value) => {
    if (!value) return false;
    return value.size <= MAX_FILE_SIZE_BYTES;
  });
const PREDICTIQ_FIELDS = [
  { key: 'date', label: 'date', required: true },
  { key: 'total_revenue', label: 'total_revenue', required: true },
  { key: 'total_expenses', label: 'total_expenses', required: true },
  { key: 'gross_profit', label: 'gross_profit (optional)', required: false },
  { key: 'ad_spend', label: 'ad_spend (optional)', required: false },
  { key: 'notes', label: 'notes (optional)', required: false },
];
const FIELD_ALIASES = {
  date: ['date', 'Date', 'period', 'Period', 'day'],
  total_revenue: ['revenue', 'Revenue', 'gross_income', 'sales_total', 'income', 'turnover', 'Turnover'],
  total_expenses: ['expenses', 'Expenses', 'total_costs', 'costs', 'outgoings'],
  gross_profit: ['profit', 'Profit', 'net_revenue', 'margin'],
  ad_spend: ['advertising', 'marketing_spend', 'ads', 'ad_cost'],
  notes: ['note', 'comment', 'comments', 'memo'],
};
const NOT_IN_FILE = 'Not in my file';
const PREVIEW_ROW_COUNT = 3;
const DEFAULT_CATEGORY_HEADER_ALIASES = {
  payroll: ['payroll', 'salary', 'salaries', 'wages', 'staff_cost'],
  rent: ['rent', 'lease', 'office_rent'],
  utilities: ['utilities', 'electricity', 'gas', 'water', 'internet', 'phone'],
  software: ['software', 'subscription', 'subscriptions', 'saas', 'licenses'],
  travel: ['travel', 'transport', 'fuel', 'taxi', 'uber'],
  inventory: ['inventory', 'stock', 'materials', 'cogs'],
  professional_services: ['professional_services', 'consulting', 'legal', 'accounting', 'fees'],
  insurance: ['insurance'],
};

function titleCaseFromKey(key) {
  const compact = String(key ?? '').replace(/[_-]+/g, ' ').trim();
  if (!compact) return '';
  return compact
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function suggestCategoryLabel(header) {
  const normalized = String(header ?? '').trim().toLowerCase();
  if (!normalized) return '';
  for (const [key, aliases] of Object.entries(DEFAULT_CATEGORY_HEADER_ALIASES)) {
    if (aliases.includes(normalized)) return titleCaseFromKey(key);
  }
  return titleCaseFromKey(normalized);
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (c === ',' && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    out.push(cur.trim());
    return out;
  };
  const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]).map((c) => c.replace(/^"|"$/g, '').trim());
    const obj = {};
    headers.forEach((h, j) => { obj[h] = cells[j] ?? ''; });
    rows.push(obj);
  }
  return { headers, rows };
}

function suggestMapping(headers, fieldKey) {
  const aliases = FIELD_ALIASES[fieldKey] || [];
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const a of aliases) {
    const idx = normalized.indexOf(a.toLowerCase());
    if (idx !== -1) return headers[idx];
  }
  if (normalized.includes(fieldKey.toLowerCase())) return fieldKey;
  const exact = headers.find((h) => h.trim().toLowerCase() === fieldKey.toLowerCase());
  if (exact) return exact;
  return NOT_IN_FILE;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CSVUploadCard() {
  const { refetchFinancialRecords } = useFinancialRecords();
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState(null);
  const [mapping, setMapping] = useState({});
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [expenseCategoryColumns, setExpenseCategoryColumns] = useState([]);
  const [normalizedRows, setNormalizedRows] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [uploadErrors, setUploadErrors] = useState(null);
  const [uploadWarnings, setUploadWarnings] = useState(null);
  const [uploadResultData, setUploadResultData] = useState(null);
  const [duplicateDates, setDuplicateDates] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [uploadDocuments, setUploadDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState(null);
  const [pendingUploadDeleteId, setPendingUploadDeleteId] = useState(null);
  const [uploadDeleteLoading, setUploadDeleteLoading] = useState(false);
  const [refreshActionState, setRefreshActionState] = useState('');
  const inputRef = useRef(null);
  const refreshSuccessTimeoutRef = useRef(null);

  const showRefreshListSuccess = useCallback(() => {
    setRefreshActionState('refreshed');
    if (refreshSuccessTimeoutRef.current) {
      clearTimeout(refreshSuccessTimeoutRef.current);
    }
    refreshSuccessTimeoutRef.current = window.setTimeout(() => {
      setRefreshActionState((current) => (current === 'refreshed' ? '' : current));
      refreshSuccessTimeoutRef.current = null;
    }, 1000);
  }, []);

  useEffect(
    () => () => {
      if (refreshSuccessTimeoutRef.current) {
        clearTimeout(refreshSuccessTimeoutRef.current);
      }
    },
    []
  );

  const loadUploadDocuments = useCallback(
    async (options = {}) => {
      const { showSuccessTick = false } = options;
      setDocumentsLoading(true);
      setDocumentsError(null);
      try {
        const docs = await fetchUploadDocuments();
        setUploadDocuments(docs);
        if (showSuccessTick) {
          showRefreshListSuccess();
        }
      } catch (err) {
        setDocumentsError(err?.message || 'Could not load previous uploads.');
      } finally {
        setDocumentsLoading(false);
      }
    },
    [showRefreshListSuccess]
  );

  useEffect(() => {
    loadUploadDocuments();
  }, [loadUploadDocuments]);

  const reset = useCallback(() => {
    setFile(null);
    setParsedData(null);
    setMapping({});
    setMappingConfirmed(false);
    setExpenseCategoryColumns([]);
    setNormalizedRows(null);
    setValidationError(null);
    setIsUploading(false);
    setUploadPercent(0);
    setUploadStage('');
    setUploadSuccess(null);
    setUploadError(null);
    setUploadErrors(null);
    setUploadWarnings(null);
    setUploadResultData(null);
    setDuplicateDates(null);
    setConfirmed(false);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const setFileAndParse = useCallback((selectedFile) => {
    setValidationError(null);
    setUploadError(null);
    setUploadErrors(null);
    setUploadSuccess(null);
    setUploadWarnings(null);
    setMappingConfirmed(false);
    setNormalizedRows(null);
    if (!selectedFile) {
      setValidationError('Please select a CSV file to upload.');
      return;
    }
    try {
      csvFileSchema.validateSync(selectedFile);
    } catch (err) {
      setValidationError(err.message || 'Please select a valid CSV file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { headers, rows } = parseCSV(reader.result);
        if (headers.length === 0 || rows.length === 0) {
          setValidationError('Could not parse CSV or file has no data rows.');
          return;
        }
        setFile(selectedFile);
        setParsedData({ headers, rows });
        const initialMapping = {};
        PREDICTIQ_FIELDS.forEach(({ key }) => {
          initialMapping[key] = suggestMapping(headers, key);
        });
        setMapping(initialMapping);
        const mappedHeaders = new Set(
          Object.values(initialMapping).filter((value) => value && value !== NOT_IN_FILE)
        );
        const suggestedCategories = headers
          .filter((header) => !mappedHeaders.has(header))
          .slice(0, 12)
          .map((header) => ({
            header,
            category: suggestCategoryLabel(header),
          }));
        setExpenseCategoryColumns(suggestedCategories);
      } catch {
        setValidationError('Could not parse CSV.');
      }
    };
    reader.onerror = () => setValidationError('Could not read file.');
    reader.readAsText(selectedFile, 'UTF-8');
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragActive(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) setFileAndParse(f);
    },
    [setFileAndParse]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleBrowse = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e) => {
      const f = e.target?.files?.[0];
      if (f) setFileAndParse(f);
    },
    [setFileAndParse]
  );

  const handleMappingChange = useCallback((fieldKey, value) => {
    setMapping((m) => ({ ...m, [fieldKey]: value }));
  }, []);

  const handleCategoryNameChange = useCallback((header, value) => {
    setExpenseCategoryColumns((prev) =>
      prev.map((entry) => (entry.header === header ? { ...entry, category: value } : entry))
    );
  }, []);

  const requiredMapped = PREDICTIQ_FIELDS.filter((f) => f.required).every((f) => mapping[f.key] && mapping[f.key] !== NOT_IN_FILE);
  const mappingError = !requiredMapped && parsedData ? 'Map all required fields (date, total_revenue, total_expenses) to continue.' : null;

  const handleConfirmMapping = useCallback(() => {
    if (!parsedData || !requiredMapped) return;
    const mappedBaseHeaders = new Set(
      Object.values(mapping).filter((value) => value && value !== NOT_IN_FILE)
    );
    const rows = parsedData.rows.map((raw) => {
      const out = {};
      PREDICTIQ_FIELDS.forEach(({ key }) => {
        const src = mapping[key];
        if (src && src !== NOT_IN_FILE && raw[src] !== undefined) {
          out[key] = raw[src];
        }
      });
      const expense_breakdown = {};
      expenseCategoryColumns.forEach((entry) => {
        const header = entry?.header;
        const category = String(entry?.category ?? '').trim();
        if (!header || !category) return;
        if (mappedBaseHeaders.has(header)) return;
        if (raw[header] == null || raw[header] === '') return;
        expense_breakdown[category] = raw[header];
      });
      if (Object.keys(expense_breakdown).length) {
        out.expense_breakdown = expense_breakdown;
      }
      return out;
    });
    setNormalizedRows(rows);
    setMappingConfirmed(true);
  }, [parsedData, mapping, requiredMapped, expenseCategoryColumns]);

  const runUpload = useCallback((strategy = null) => {
    if (!normalizedRows || normalizedRows.length === 0) return;
    setUploadError(null);
    setUploadErrors(null);
    setUploadWarnings(null);
    setUploadSuccess(null);
    setUploadResultData(null);
    setDuplicateDates(null);
    setIsUploading(true);
    setUploadPercent(0);
    setUploadStage('');

    uploadCSVRowsWithProgress(
      normalizedRows,
      strategy,
      (progress) => {
        setUploadPercent(progress.percent);
        setUploadStage(progress.stage || '');
      },
      (result) => {
        setIsUploading(false);
        setUploadPercent(100);
        setUploadSuccess(
          (result.recordsImported === 1 ? '1 record imported successfully.' : `${result.recordsImported} records imported successfully.`)
        );
        setUploadWarnings(result.warnings || null);
        setUploadResultData({
          recordsImported: result.recordsImported ?? 0,
          recordsSkipped: result.recordsSkipped,
          recordsOverwritten: result.recordsOverwritten,
          warnings: result.warnings,
        });
        clearChartCache();
        refetchFinancialRecords();
        loadUploadDocuments();
      },
      (err) => {
        setIsUploading(false);
        setUploadPercent(0);
        setUploadStage('');
        if (err?.code === 'DUPLICATE_DATES' && err?.duplicateDates?.length) {
          setDuplicateDates(err.duplicateDates);
          setUploadError(null);
          setUploadErrors(null);
        } else {
          setUploadError(err?.message || 'Upload failed.');
          setUploadErrors(err?.errors || null);
        }
      }
    );
  }, [normalizedRows, refetchFinancialRecords, loadUploadDocuments]);

  const handleUpload = useCallback(() => runUpload(null), [runUpload]);

  const handleOverwriteDuplicates = useCallback(() => runUpload('overwrite'), [runUpload]);

  const handleSkipDuplicates = useCallback(() => runUpload('skip'), [runUpload]);

  const handleConfirmUpload = useCallback(() => {
    setConfirmed(true);
    setTimeout(reset, 2000);
  }, [reset]);

  const handleCloseUploadDeleteModal = useCallback(() => {
    if (!uploadDeleteLoading) {
      setPendingUploadDeleteId(null);
    }
  }, [uploadDeleteLoading]);

  const handleConfirmUploadDelete = useCallback(async () => {
    if (!pendingUploadDeleteId) return;
    setUploadDeleteLoading(true);
    setDocumentsError(null);
    try {
      await deleteUploadDocument(pendingUploadDeleteId);
      clearChartCache();
      refetchFinancialRecords();
      await loadUploadDocuments();
      setPendingUploadDeleteId(null);
    } catch (err) {
      setDocumentsError(err?.message || 'Failed to delete upload.');
    } finally {
      setUploadDeleteLoading(false);
    }
  }, [pendingUploadDeleteId, loadUploadDocuments, refetchFinancialRecords]);

  const showDropZone = !file || (file && uploadSuccess && confirmed);
  const showFileCard = file && !confirmed;
  const showMappingStep = file && parsedData && !mappingConfirmed;
  const showPreviewBeforeUpload = file && mappingConfirmed && normalizedRows && !uploadSuccess && !duplicateDates?.length && !isUploading;
  const showDuplicateResolution = file && mappingConfirmed && normalizedRows && duplicateDates?.length > 0 && !uploadSuccess && !isUploading;
  const dropdownOptions = parsedData ? [NOT_IN_FILE, ...parsedData.headers] : [];

  return (
    <motion.article
      className={styles.card}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <h3 className={styles.title}>Upload Financial Data (CSV)</h3>
      <p className={styles.subtext}>
        Upload transaction or revenue data to update your forecasts automatically.
      </p>

      <div className={styles.templateRow}>
        <a href="/sample-template.csv" download="sample-template.csv" className={styles.templateLink}>
          Download CSV template
        </a>
        <span className={styles.tooltip}>
          <span className={styles.infoTrigger} aria-label="Accepted column headers" tabIndex={0}>i</span>
          <span className={styles.tooltipContent}>
            <strong>Required:</strong> date, total_revenue, total_expenses. <strong>Optional:</strong> gross_profit, ad_spend (marketing subset of total_expenses for charts), notes, extra expense category columns. Date: YYYY-MM-DD.
          </span>
        </span>
      </div>

      {showDropZone && (
        <div
          className={`${styles.dropZone} ${dragActive ? styles.active : ''} ${validationError ? styles.error : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={handleBrowse}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleBrowse()}
          aria-label="Drop CSV file or click to browse"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv,application/csv,text/plain"
            className={styles.fileInput}
            onChange={handleFileChange}
            aria-hidden
          />
          <svg className={styles.uploadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className={styles.dropText}>Drag your CSV file here, or click to browse.</p>
          {validationError && <p className={styles.dropError}>{validationError}</p>}
        </div>
      )}

      {showFileCard && (
        <>
          <div className={styles.fileCard}>
            <span className={styles.fileName}>{file.name}</span>
            <span className={styles.fileMeta}>
              {formatFileSize(file.size)} · {parsedData?.rows?.length ?? 0} rows
              {isUploading && (
                <>
                  {' · '}
                  <span className={styles.uploadingLabel}>Uploading…</span>
                </>
              )}
            </span>
            {isUploading && (
              <div className={styles.uploadProgressWrap}>
                <div className={styles.uploadProgressBar} style={{ width: `${uploadPercent}%` }} />
              </div>
            )}
            {isUploading && uploadStage && (
              <div className={styles.uploadStageLabel}>{uploadStage}</div>
            )}
          </div>

          {showMappingStep && (
            <div className={styles.previewSection} style={{ marginTop: '1rem' }}>
              <div className={styles.previewTitle}>Map your columns</div>
              {PREDICTIQ_FIELDS.map(({ key, label, required }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <label style={{ minWidth: '140px', fontSize: '0.9rem', color: 'var(--color-primary-text)' }}>
                    {label} {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
                  </label>
                  <select
                    value={mapping[key] ?? NOT_IN_FILE}
                    onChange={(e) => handleMappingChange(key, e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      padding: '0.4rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-light)',
                      background: 'var(--color-card-bg)',
                      color: 'var(--color-primary-text)',
                      fontSize: '0.9rem',
                    }}
                  >
                    {dropdownOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {required && mapping[key] === NOT_IN_FILE && (
                    <span className={styles.dropError} style={{ fontSize: '0.8rem' }}>Required</span>
                  )}
                </div>
              ))}
              <div style={{ marginTop: '1rem', paddingTop: '0.65rem', borderTop: '1px solid var(--color-border-light)' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--color-primary-text)' }}>
                  Optional: map extra expense columns to categories
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--color-secondary-text)', marginBottom: '0.55rem' }}>
                  Leave blank to ignore a column. Any unassigned expense amount is grouped under Other.
                </div>
                {expenseCategoryColumns.length === 0 && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--color-secondary-text)' }}>
                    No extra columns detected.
                  </div>
                )}
                {expenseCategoryColumns.map((entry) => (
                  <div key={entry.header} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <label style={{ minWidth: '140px', fontSize: '0.85rem', color: 'var(--color-primary-text)' }}>
                      {entry.header}
                    </label>
                    <input
                      type="text"
                      value={entry.category}
                      onChange={(e) => handleCategoryNameChange(entry.header, e.target.value)}
                      placeholder="Ignore this column"
                      style={{
                        flex: 1,
                        minWidth: '120px',
                        padding: '0.38rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border-light)',
                        background: 'var(--color-card-bg)',
                        color: 'var(--color-primary-text)',
                        fontSize: '0.88rem',
                      }}
                    />
                  </div>
                ))}
              </div>
              {mappingError && <p className={styles.dropError} style={{ marginTop: '0.5rem' }}>{mappingError}</p>}
              <div className={`${styles.confirmRow} ${styles.mappingActions}`}>
                <button
                  type="button"
                  className={`${styles.confirmBtn} ${styles.mappingBtn}`}
                  onClick={handleConfirmMapping}
                  disabled={!requiredMapped}
                >
                  Confirm mapping
                </button>
                <button type="button" className={`${styles.clearBtn} ${styles.mappingBtn}`} onClick={reset}>
                  Choose another file
                </button>
              </div>
            </div>
          )}

          {(showPreviewBeforeUpload || showDuplicateResolution) && (
            <>
              <div className={styles.previewSection} style={{ marginTop: '1rem' }}>
                <div className={styles.previewTitle}>Preview (first {PREVIEW_ROW_COUNT} rows)</div>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      <th className={styles.previewTh}>date</th>
                      <th className={styles.previewTh}>total_revenue</th>
                      <th className={styles.previewTh}>total_expenses</th>
                      <th className={styles.previewTh}>gross_profit</th>
                      <th className={styles.previewTh}>ad_spend</th>
                      <th className={styles.previewTh}>notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {normalizedRows.slice(0, PREVIEW_ROW_COUNT).map((row, i) => (
                      <tr key={i}>
                        <td className={styles.previewTd}>{row.date ?? '-'}</td>
                        <td className={styles.previewTd}>{row.total_revenue != null ? formatGbp(row.total_revenue) : '-'}</td>
                        <td className={styles.previewTd}>{row.total_expenses != null ? formatGbp(row.total_expenses) : '-'}</td>
                        <td className={styles.previewTd}>{row.gross_profit != null ? formatGbp(row.gross_profit) : '-'}</td>
                        <td className={styles.previewTd}>{row.ad_spend != null ? formatGbp(row.ad_spend) : '-'}</td>
                        <td className={styles.previewTd}>{row.notes ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {showPreviewBeforeUpload && (
                <div className={styles.confirmRow}>
                  <button type="button" className={styles.confirmBtn} onClick={handleUpload} disabled={isUploading}>
                    Upload file
                  </button>
                  <button type="button" className={styles.clearBtn} onClick={() => { setMappingConfirmed(false); setNormalizedRows(null); }}>
                    Back to mapping
                  </button>
                </div>
              )}
              {showDuplicateResolution && (
                <div className={styles.duplicatePanel} style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(234, 203, 181, 0.2)', border: '1px solid rgba(234, 203, 181, 0.4)', borderRadius: 'var(--radius-md)', color: 'var(--color-primary-text)' }}>
                  <div className={styles.previewTitle} style={{ marginBottom: '0.5rem' }}>Duplicate dates found</div>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: 'var(--color-secondary-text)' }}>
                    {duplicateDates.length} date{duplicateDates.length !== 1 ? 's' : ''} in your file already have records. What would you like to do?
                  </p>
                  <ul className={styles.errorList} style={{ marginBottom: '1rem', paddingLeft: '1.25rem' }}>
                    {duplicateDates.slice(0, 5).map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                    {duplicateDates.length > 5 && (
                      <li>+ {duplicateDates.length - 5} more</li>
                    )}
                  </ul>
                  <div className={styles.confirmRow} style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                    <button type="button" className={styles.confirmBtn} onClick={handleOverwriteDuplicates} disabled={isUploading}>
                      Overwrite existing
                    </button>
                    <button type="button" className={styles.confirmBtn} style={{ background: 'var(--color-accent)' }} onClick={handleSkipDuplicates} disabled={isUploading}>
                      Skip duplicates
                    </button>
                    <button type="button" className={styles.clearBtn} onClick={() => setDuplicateDates(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {uploadError && (
            <div className={`${styles.toast} ${styles.toastError}`} role="alert">
              <div>{uploadError}</div>
              {uploadErrors && uploadErrors.length > 0 && (
                <ul className={styles.errorList}>
                  {uploadErrors.slice(0, 10).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {uploadErrors.length > 10 && <li>…and {uploadErrors.length - 10} more</li>}
                </ul>
              )}
            </div>
          )}

          {uploadSuccess && (
            <>
              <div className={`${styles.toast} ${styles.toastSuccess}`} role="status">
                {uploadSuccess}
                {uploadResultData && (
                  <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem', fontWeight: 500 }}>
                    {uploadResultData.recordsImported} imported
                    {uploadResultData.recordsSkipped != null && uploadResultData.recordsSkipped > 0 && (
                      <> · {uploadResultData.recordsSkipped} skipped</>
                    )}
                    {uploadResultData.recordsOverwritten != null && uploadResultData.recordsOverwritten > 0 && (
                      <> · {uploadResultData.recordsOverwritten} overwritten</>
                    )}
                  </span>
                )}
              </div>
              {uploadWarnings && uploadWarnings.length > 0 && (
                <div className={styles.toast} style={{ background: 'rgba(234, 203, 181, 0.2)', border: '1px solid rgba(234, 203, 181, 0.4)', color: 'var(--color-secondary-text)' }}>
                  <ul className={styles.errorList} style={{ margin: 0 }}>
                    {uploadWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className={styles.confirmRow}>
                <button type="button" className={styles.confirmBtn} onClick={handleConfirmUpload}>
                  Confirm upload
                </button>
                <button type="button" className={styles.clearBtn} onClick={reset}>
                  Upload another
                </button>
              </div>
            </>
          )}
        </>
      )}

      <section className={styles.uploadHistorySection} aria-label="Previous uploads">
        <div className={styles.uploadHistoryHeader}>
          <h4 className={styles.uploadHistoryTitle}>Previous uploads</h4>
          <button
            type="button"
            className={`${settingsStyles.actionBtn} ${settingsStyles.backupActionBtn} ${
              refreshActionState === 'refreshed' ? settingsStyles.backupActionBtnSuccess : ''
            } ${styles.uploadHistoryRefreshBtn}`}
            onClick={() => loadUploadDocuments({ showSuccessTick: true })}
            disabled={documentsLoading || uploadDeleteLoading || Boolean(pendingUploadDeleteId)}
            aria-label="Refresh previous uploads list"
          >
            <span
              className={`${settingsStyles.backupActionLabel} ${
                refreshActionState === 'refreshed' ? settingsStyles.backupActionLabelHidden : ''
              }`}
            >
              Refresh
            </span>
            <span
              className={`${settingsStyles.backupActionTick} ${
                refreshActionState === 'refreshed' ? settingsStyles.backupActionTickVisible : ''
              }`}
              aria-hidden="true"
            >
              ✓
            </span>
          </button>
        </div>
        {documentsLoading ? (
          <div className={styles.uploadHistoryEmpty}>Loading uploads...</div>
        ) : uploadDocuments.length === 0 ? (
          <div className={styles.uploadHistoryEmpty}>No previous uploads found.</div>
        ) : (
          <div className={styles.uploadHistoryList}>
            {uploadDocuments.map((doc) => {
              const busy =
                uploadDeleteLoading && pendingUploadDeleteId === doc.uploadDocumentId;
              const uploadedAt = doc.uploadedAt
                ? new Date(doc.uploadedAt).toLocaleString('en-GB')
                : 'Unknown date';
              return (
                <div key={doc.uploadDocumentId} className={styles.uploadHistoryRow}>
                  <div className={styles.uploadHistoryMeta}>
                    <div className={styles.uploadHistoryMain}>
                      {uploadedAt} · {doc.recordsCount ?? 0} records
                    </div>
                    <div className={styles.uploadHistorySub}>
                      Range: {doc.firstRecordDate ?? '-'} to {doc.lastRecordDate ?? '-'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="pq-btn-danger-red pq-btn--upload-history"
                    onClick={() => setPendingUploadDeleteId(doc.uploadDocumentId)}
                    disabled={uploadDeleteLoading || Boolean(pendingUploadDeleteId)}
                  >
                    {busy ? 'Deleting…' : 'Delete upload'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {documentsError && <p className={styles.dropError}>{documentsError}</p>}
      </section>

      <ConfirmationModal
        isOpen={!!pendingUploadDeleteId}
        title="Delete uploaded data"
        message="This will permanently remove the financial records imported in this upload. Your account will remain active. This action cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete data"
        onCancel={handleCloseUploadDeleteModal}
        onConfirm={handleConfirmUploadDelete}
        isConfirmLoading={uploadDeleteLoading}
        confirmVariant="danger"
      />
    </motion.article>
  );
}
