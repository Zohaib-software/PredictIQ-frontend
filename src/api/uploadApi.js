import { fetchWithAuth } from './fetchWithAuth.js';
import origin from './apiOrigin.js';

const UPLOAD_URL = `${origin}/api/upload`;

/**
 * Upload with real progress via Server-Sent Events.
 * POST to /api/upload/progress, read SSE stream, call onProgress / onDone / onError.
 * @param {Object[]} rows
 * @param {string|null} duplicateStrategy
 * @param {(data: { percent: number, stage: string }) => void} onProgress
 * @param {(data: { done: true, recordsImported: number, warnings?: string[], previewRows?: Object[], recordsSkipped?: number, recordsOverwritten?: number }) => void} onDone
 * @param {(err: { message?: string, errors?: string[], code?: string, duplicateDates?: string[] }) => void} onError
 */
export function uploadCSVRowsWithProgress(rows, duplicateStrategy, onProgress, onDone, onError) {
  fetchWithAuth(`${UPLOAD_URL}/progress`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rows, ...(duplicateStrategy && { duplicateStrategy }) }),
  })
    .then(async (response) => {
      if (!response.ok && response.headers.get('content-type')?.includes('application/json')) {
        const json = await response.json();
        onError({ message: json.message || 'Upload failed', errors: json.errors });
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.error) {
                onError({
                  message: json.message,
                  errors: json.errors,
                  code: json.code,
                  duplicateDates: json.duplicateDates,
                });
                return;
              }
              if (json.done) {
                onDone(json);
                return;
              }
              onProgress(json);
            } catch (_) {
              /* skip malformed line */
            }
          }
        }
      }
    })
    .catch((err) => {
      onError({ message: err?.message || 'Upload failed' });
    });
}

export async function fetchUploadDocuments() {
  const response = await fetchWithAuth(`${UPLOAD_URL}/documents`, {
    method: 'GET',
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json?.message || 'Failed to fetch upload documents');
  }
  const json = await response.json();
  return json?.data?.uploads ?? [];
}

export async function deleteUploadDocument(documentId) {
  const response = await fetchWithAuth(`${UPLOAD_URL}/documents/${encodeURIComponent(documentId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json?.message || 'Failed to delete upload document');
  }
  const json = await response.json();
  return json?.data ?? null;
}
