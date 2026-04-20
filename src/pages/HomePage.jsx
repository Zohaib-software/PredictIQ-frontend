import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/Button';
import styles from './HomePage.module.css';

export function HomePage() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className={styles.hero}>
      <div className={styles.content}>
        <h1 className={styles.title}>
          Smarter financial decisions start here
        </h1>
        <p className={styles.subtitle}>
          PredictIQ combines CRM with predictive financial insights, giving SMEs
          clear visibility and data-driven forecasting for growth.
        </p>
        {isAuthenticated ? (
          <div className={styles.welcome}>
            <p className={styles.welcomeText}>
              Welcome back, <strong>{user?.businessName || user?.email}</strong>
            </p>
            <p className={styles.welcomeSub}>
              Head to your dashboard to view forecasts and insights.
            </p>
            <Link to="/overview">
              <Button variant="primary" className={styles.ctaPrimary}>
                Open dashboard
              </Button>
            </Link>
          </div>
        ) : (
          <div className={styles.cta}>
            <Link to="/register">
              <Button variant="primary" className={styles.ctaPrimary}>
                Create free account
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline">Log in</Button>
            </Link>
          </div>
        )}
      </div>
      <div className={styles.cards}>
        <div className={styles.card} role="presentation">
          <span className={styles.cardIcon} aria-hidden="true">📊</span>
          <h2 className={styles.cardTitle}>Forecasting</h2>
          <p className={styles.cardText}>
            Revenue and expense projections powered by your data.
          </p>
        </div>
        <div className={styles.card} role="presentation">
          <span className={styles.cardIcon} aria-hidden="true">🔗</span>
          <h2 className={styles.cardTitle}>CRM + Finance</h2>
          <p className={styles.cardText}>
            One place for customer relationships and financial visibility.
          </p>
        </div>
        <div className={styles.card} role="presentation">
          <span className={styles.cardIcon} aria-hidden="true">✓</span>
          <h2 className={styles.cardTitle}>Trusted by SMEs</h2>
          <p className={styles.cardText}>
            Built for small and medium businesses in the FinTech space.
          </p>
        </div>
      </div>
    </div>
  );
}
