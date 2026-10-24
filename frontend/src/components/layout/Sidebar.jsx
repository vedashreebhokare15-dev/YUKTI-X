import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  BrainCircuit,
  FileText,
  LayoutDashboard,
  Map,
  ScanSearch,
  Settings,
} from 'lucide-react';

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/study-area', label: 'Study Area', icon: Map },
  { to: '/analysis', label: 'Analysis', icon: ScanSearch },
  { to: '/model', label: 'Model', icon: BrainCircuit },
  { to: '/results', label: 'Results', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function SidebarNav({ onNavigate }) {
  return (
    <nav className="sidebar-nav" aria-label="Primary">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`.trim()}
          onClick={onNavigate}
        >
          <Icon size={17} strokeWidth={2} aria-hidden="true" />
          <span>{label}</span>
          <span className="nav-indicator" aria-hidden="true" />
        </NavLink>
      ))}
    </nav>
  );
}

export function SidebarFooter() {
  return (
    <div className="sidebar-footer">
      <div className="sidebar-art">
        <img src="/assets/forest-sidebar.svg" alt="Illustration of a layered forest landscape" />
        <div className="sidebar-tagline">
          <strong>Healthy Forests</strong>
          For a Sustainable
          <br />
          Future
        </div>
      </div>
      <div className="sidebar-version">
        <span>VanaDrishti AI v1.0</span>
        <span className="demo-chip-dark">Demo</span>
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="app-sidebar" aria-label="Sidebar navigation">
      <div className="sidebar-scroll">
        <div className="sidebar-label">Workspace</div>
        <SidebarNav />
        <div className="sidebar-spacer" />
      </div>
      <SidebarFooter />
    </aside>
  );
}
