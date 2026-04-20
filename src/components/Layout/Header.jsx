import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../Button';
import styles from './Header.module.css';

export function Header() {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();

  return (
    <header className={styles.header} role="banner">
      <div className={styles.inner}>
        <Link to="/" className={styles.logo} aria-label="PredictIQ home">
          PredictIQ
        </Link>
        <nav className={styles.nav} aria-label="Main navigation">
          {isAuthenticated ? (
            <>
              <Link
                to="/data"
                className={`${styles.dashboardLink} ${location.pathname === '/data' ? styles.active : ''}`}
                aria-current={location.pathname === '/data' ? 'page' : undefined}
              >
                Dashboard
              </Link>
              <span className={styles.userName} aria-label={`Logged in as ${user?.businessName || user?.email}`}>
                {user?.businessName || user?.email}
              </span>
              <Button variant="outline" type="button" onClick={logout}>
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className={`${styles.publicLoginLink} ${
                  location.pathname === '/login' ? styles.active : ''
                }`}
                aria-current={location.pathname === '/login' ? 'page' : undefined}
              >
                Log in
              </Link>
              <Link to="/register">
                <Button variant="primary">Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
