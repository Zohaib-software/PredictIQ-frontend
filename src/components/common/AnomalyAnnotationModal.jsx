import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { updateMonthNotesForPeriod } from '../../api/dataApi';
import confirmStyles from './ConfirmationModal.module.css';
import styles from './AnomalyAnnotationModal.module.css';

const MAX_LEN = 300;

export function AnomalyAnnotationModal({
  isOpen,
  onClose,
  periodLabel,
  existingNote,
  onSaved,
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setText(existingNote != null ? String(existingNote) : '');
    setError(null);
    setSaving(false);
  }, [isOpen, existingNote, periodLabel]);

  const handleSave = async () => {
    const label = String(periodLabel || '').trim();
    if (!label) {
      setError('Missing period');
      return;
    }
    const trimmed = text.slice(0, MAX_LEN).trim();
    setError(null);
    setSaving(true);
    try {
      await updateMonthNotesForPeriod(label, trimmed);
      onSaved(trimmed);
      onClose();
    } catch (e) {
      setError(e?.message || 'Could not save explanation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={confirmStyles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={confirmStyles.modal}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="anomaly-annotation-title"
          >
            <h3 id="anomaly-annotation-title" className={confirmStyles.title}>
              Explain Anomaly: {periodLabel}
            </h3>
            <p className={styles.scopeHint}>
              Saving copies this text to every financial entry in {periodLabel} (all days in that
              month), so the anomaly chart stays in sync after refresh.
            </p>
            <textarea
              className={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              placeholder="e.g. Christmas period: higher supplier costs than usual"
              rows={5}
              disabled={saving}
              aria-label="Anomaly explanation"
            />
            <div className={styles.counterRow}>
              {text.length}/{MAX_LEN}
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
            <div className={confirmStyles.actions}>
              <button
                type="button"
                className={confirmStyles.cancelBtn}
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${confirmStyles.confirmBtn} ${confirmStyles.confirmNeutral}`}
                onClick={handleSave}
                disabled={saving || !String(periodLabel || '').trim()}
              >
                {saving ? 'Processing...' : 'Save'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
