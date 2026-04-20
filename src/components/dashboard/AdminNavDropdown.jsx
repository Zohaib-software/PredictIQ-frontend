import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './DashboardLayout.module.css';

const ADMIN_LINKS = [
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/logs', label: 'System logs' },
  { to: '/admin/feedback', label: 'Feedback' },
];

export function AdminNavDropdown({ sidebarOpen }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const isAdminSection = location.pathname.startsWith('/admin');

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className={styles.navItemWrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.navLink} ${isAdminSection ? styles.navLinkActive : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="admin-nav-submenu"
        title="Admin menu"
      >
        <span className={styles.navIcon} aria-hidden="true">
          🛡️
        </span>
        {sidebarOpen && (
          <span className={styles.navLabel}>
            Admin <span aria-hidden="true">▾</span>
          </span>
        )}
      </button>
      {open && (
        <div
          id="admin-nav-submenu"
          className={styles.navDropdown}
          role="menu"
          aria-label="Admin pages"
        >
          {ADMIN_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              role="menuitem"
              className={({ isActive }) =>
                `${styles.navDropdownLink} ${isActive ? styles.navDropdownLinkActive : ''}`
              }
              onClick={() => setOpen(false)}
            >
              {label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
