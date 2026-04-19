import styles from './Alert.module.css';

export function Alert({ variant = 'info', children, role = 'alert', className = '' }) {
  return (
    <div
      className={`${styles.alert} ${styles[variant]} ${className}`.trim()}
      role={role}
    >
      {children}
    </div>
  );
}
