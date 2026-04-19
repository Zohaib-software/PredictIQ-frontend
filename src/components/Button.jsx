import styles from './Button.module.css';

export function Button({
  children,
  variant = 'primary',
  type = 'button',
  disabled = false,
  fullWidth = false,
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`${styles.btn} ${styles[variant]} ${fullWidth ? styles.fullWidth : ''} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
