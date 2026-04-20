import { fetchWithAuth } from './fetchWithAuth.js';
import origin from './apiOrigin.js';

const API_BASE = `${origin}/api/data`;

/**
 * GET /api/data?period=&startDate=&endDate=
 * Returns { data: { records, summary } }
 */
export async function getFinancialData({ period = 'monthly', startDate, endDate } = {}) {
  const params = new URLSearchParams();
  if (period) params.set('period', period);
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const url = `${API_BASE}?${params.toString()}`;
  const res = await fetchWithAuth(url);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.message || 'Failed to load financial data');
    err.status = res.status;
    throw err;
  }
  return { data: data.data };
}

/**
 * GET /api/data/records?startDate=&endDate=&sortBy=&page=&limit=&notesSearch=
 * notesSearch: whitespace-separated words; each must appear in record notes (case-insensitive).
 * Returns { data: { records, total } }
 */
export async function getFinancialRecords({
  startDate,
  endDate,
  sortBy,
  notesSearch,
  page = 1,
  limit = 20,
} = {}) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (sortBy) params.set('sortBy', sortBy);
  if (notesSearch != null && String(notesSearch).trim() !== '') {
    params.set('notesSearch', String(notesSearch).trim());
  }
  params.set('page', String(page));
  params.set('limit', String(limit));
  const res = await fetchWithAuth(`${API_BASE}/records?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to load records');
  return { data: data.data };
}

/**
 * GET /api/data/records/ids?startDate=&endDate=&notesSearch=
 * Same notes filter as the records table (for bulk select-all).
 * Returns { data: { ids: string[], total: number } }
 */
export async function getFinancialRecordIds({ startDate, endDate, notesSearch } = {}) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  if (notesSearch != null && String(notesSearch).trim() !== '') {
    params.set('notesSearch', String(notesSearch).trim());
  }
  const query = params.toString();
  const res = await fetchWithAuth(
    query ? `${API_BASE}/records/ids?${query}` : `${API_BASE}/records/ids`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to load record ids');
  return { data: data.data };
}

/**
 * POST /api/data/records
 * Body: { date, total_revenue, total_expenses, ad_spend, notes }
 * Creates a new financial record for the current user.
 */
export async function createRecord(body) {
  const res = await fetchWithAuth(`${API_BASE}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to create record');
  return data.data;
}

/**
 * PUT /api/data/:id
 * Body: { total_revenue, total_expenses, gross_profit, ad_spend, notes }
 * Returns updated record in response data.
 */
export async function updateRecord(id, body) {
  const res = await fetchWithAuth(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to update record');
  return data.data;
}

/**
 * PUT /api/data/records/month-notes
 * Sets the same `notes` on every financial record in the calendar month (YYYY-MM).
 * @returns {{ matchedCount: number, modifiedCount: number }}
 */
export async function updateMonthNotesForPeriod(periodLabel, notes) {
  const res = await fetchWithAuth(`${API_BASE}/records/month-notes`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ periodLabel, notes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to update month notes');
  return data.data;
}

/**
 * DELETE /api/data/:id
 * Returns success response.
 */
export async function deleteRecord(id) {
  const res = await fetchWithAuth(`${API_BASE}/${id}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to delete record');
  return data.data;
}

/** Must match backend `BULK_DELETE_MAX` in dataController.js */
export const BULK_DELETE_CHUNK_SIZE = 250;

/**
 * POST /api/data/bulk-delete (single request, max {@link BULK_DELETE_CHUNK_SIZE} ids).
 * @returns { deletedCount: number }
 */
export async function deleteRecordsBulk(ids) {
  const res = await fetchWithAuth(`${API_BASE}/bulk-delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Failed to delete records');
  return data.data;
}

/**
 * Deletes any number of records by chunking requests to the API limit.
 * @returns { deletedCount: number }
 */
export async function deleteRecordsBulkAll(ids) {
  const unique = [...new Set(ids)];
  let deletedCount = 0;
  for (let i = 0; i < unique.length; i += BULK_DELETE_CHUNK_SIZE) {
    const chunk = unique.slice(i, i + BULK_DELETE_CHUNK_SIZE);
    const result = await deleteRecordsBulk(chunk);
    deletedCount += result?.deletedCount ?? chunk.length;
  }
  return { deletedCount };
}
