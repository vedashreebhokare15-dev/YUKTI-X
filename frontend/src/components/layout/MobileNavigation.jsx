import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { SidebarFooter, SidebarNav } from './Sidebar';

export default function MobileNavigation({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  return (
    <>
      <div
        className={`mobile-overlay ${open ? 'open' : ''}`.trim()}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`app-sidebar mobile-drawer ${open ? 'open' : ''}`.trim()}
        aria-label="Mobile navigation"
        aria-hidden={!open}
      >
        <div className="mobile-sidebar-head">
          <Link to="/dashboard" className="header-brand" onClick={onClose}>
            <img src="/assets/logo.svg" alt="" className="brand-logo" style={{ width: 32, height: 32 }} />
            <span className="brand-name">VanaDrishti AI</span>
          </Link>
          <button type="button" className="sidebar-mobile-close" onClick={onClose} aria-label="Close navigation">
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-scroll">
          <div className="sidebar-label">Workspace</div>
          <SidebarNav onNavigate={onClose} />
          <div className="sidebar-spacer" />
        </div>
        <SidebarFooter />
      </aside>
    </>
  );
}
