import { Link } from 'react-router-dom';
import styles from './ErrorPage.module.css';

export function ErrorPage({
  title = 'Page not found',
  message = "The page you're looking for doesn't exist or may have been moved.",
  showReload = false,
}) {
  return (
    <main className={styles.page} id="main-content">
      <section className={styles.card} role="alert" aria-live="polite">
        <p className={styles.code}>Error</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <Link to="/" className={styles.primaryAction}>
            Go to Home
          </Link>
          {showReload && (
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
