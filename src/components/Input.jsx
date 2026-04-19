import { forwardRef } from 'react';
import styles from './Input.module.css';

export const Input = forwardRef(function Input(
  { label, id, error, type = 'text', required, className = '', ...props },
  ref
) {
  const inputId = id || `input-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <div className={`${styles.wrapper} ${className}`.trim()}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
          {required && <span className={styles.required} aria-hidden="true"> *</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        type={type}
        className={`${styles.input} ${error ? styles.inputError : ''}`}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        required={required}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
});
