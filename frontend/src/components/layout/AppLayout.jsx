import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AppHeader from './AppHeader';
import Sidebar from './Sidebar';
import MobileNavigation from './MobileNavigation';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <AppHeader onOpenMobile={() => setMobileOpen(true)} mobileOpen={mobileOpen} />
      <Sidebar />
      <MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <main id="main-content" className="page-content" tabIndex={-1}>
        <div className="page-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
