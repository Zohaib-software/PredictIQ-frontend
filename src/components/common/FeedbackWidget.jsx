import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { submitFeedback } from '../../api/feedbackApi';
import styles from './FeedbackWidget.module.css';

const CATEGORIES = [
  { value: 'idea', label: 'Suggestion' },
  { value: 'bug', label: 'Problem / bug' },
  { value: 'other', label: 'Other' },
];

export function FeedbackWidget() {
  const location = useLocation();
  const titleId = useId();
  const descId = useId();
  const closeBtnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('idea');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const reset = useCallback(() => {
    setMessage('');
    setCategory('idea');
    setHoneypot('');
    setError('');
    setDone(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const trimmed = message.trim();
    if (!trimmed) {
      setError('Please enter a short message.');
      return;
    }
    setSubmitting(true);
    try {
      await submitFeedback({
        message: trimmed,
        category,
        page: `${location.pathname}${location.search || ''}`.slice(0, 500),
        website: honeypot,
      });
      setDone(true);
      setMessage('');
      setHoneypot('');
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const modal =
    open &&
    createPortal(
      <div
        className={styles.backdrop}
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        <div
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
        >
          <div className={styles.dialogHead}>
            <h2 id={titleId} className={styles.title}>
              Send feedback
            </h2>
            <button
              ref={closeBtnRef}
              type="button"
              className={styles.closeBtn}
              aria-label="Close"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              ×
            </button>
          </div>
          {done ? (
            <div className={styles.thanks} id={descId}>
              <p>Thank you — your feedback helps us improve PredictIQ.</p>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={styles.form} id={descId}>
              <p className={styles.privacy}>
                This is anonymous: we do not attach your name, email, or account to your message.
              </p>
              <label className={styles.label} htmlFor="feedback-category">
                Type
              </label>
              <select
                id="feedback-category"
                className={styles.select}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <label className={styles.label} htmlFor="feedback-message">
                Message
              </label>
              <textarea
                id="feedback-message"
                className={styles.textarea}
                rows={5}
                maxLength={5000}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what worked well or what we should improve…"
                required
              />
              {/* Honeypot — hidden from users; bots often fill this */}
              <div className={styles.honeypot} aria-hidden="true">
                <label htmlFor="feedback-website">Website</label>
                <input
                  id="feedback-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>
              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send feedback'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        onClick={() => {
          setOpen(true);
          setDone(false);
          setError('');
        }}
        aria-label="Send feedback"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={styles.fabIcon} aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.fabLabel} aria-hidden="true">
          Feedback
        </span>
      </button>
      {modal}
    </>
  );
}
