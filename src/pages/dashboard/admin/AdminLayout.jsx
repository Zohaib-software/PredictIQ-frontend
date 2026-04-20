import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import pageStyles from '../DashboardPages.module.css';

export function AdminLayout() {
  return (
    <motion.div
      className={pageStyles.page}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <Outlet />
    </motion.div>
  );
}
