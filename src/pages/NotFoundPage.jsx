import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './NotFoundPage.module.css';

/**
 * Dedicated 404 for unknown routes (distinct from ErrorBoundary / generic ErrorPage).
 */
export function NotFoundPage() {
  const { isAuthenticated } = useAuth();

  return (
    <main className={styles.page} id="main-content">
      <section className={styles.card} aria-labelledby="not-found-heading">
        <p className={styles.code} aria-hidden="true">
          404
        </p>
        <h1 id="not-found-heading" className={styles.title}>
          Page not found
        </h1>
        <p className={styles.message}>
          The address may be mistyped, or the page may have been moved. Check the URL or use one of the links below.
        </p>
        <div className={styles.actions}>
          {isAuthenticated ? (
            <Link to="/overview" className={styles.primaryAction}>
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link to="/" className={styles.primaryAction}>
                Go to home
              </Link>
              <Link to="/login" className={styles.secondaryAction}>
                Log in
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
