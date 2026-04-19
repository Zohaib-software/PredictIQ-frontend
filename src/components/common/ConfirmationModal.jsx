import { AnimatePresence, motion } from 'framer-motion';
import styles from './ConfirmationModal.module.css';

export function ConfirmationModal({
  isOpen,
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  onCancel,
  onConfirm,
  isConfirmDisabled = false,
  isConfirmLoading = false,
  confirmVariant = 'danger',
  children,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            className={styles.modal}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <h3 className={styles.title}>{title}</h3>
            {message && <p className={styles.message}>{message}</p>}
            {children}
            <div className={styles.actions}>
              <button type="button" className={styles.cancelBtn} onClick={onCancel}>
                {cancelLabel}
              </button>
              <button
                type="button"
                className={`${styles.confirmBtn} ${
                  confirmVariant === 'danger' ? styles.confirmDanger : styles.confirmNeutral
                }`}
                onClick={onConfirm}
                disabled={isConfirmDisabled || isConfirmLoading}
              >
                {isConfirmLoading ? 'Processing...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
