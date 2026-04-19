import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import styles from './Layout.module.css';

export function Layout() {
  return (
    <div className={styles.layout}>
      <Header />
      <div className={styles.scrollRegion}>
        <main className={styles.main} id="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
