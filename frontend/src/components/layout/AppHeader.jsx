import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Menu } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getInitials } from '../../utils/formatters';
import NotificationPanel from './NotificationPanel';
import UserProfileMenu from './UserProfileMenu';

export default function AppHeader({ onOpenMobile, mobileOpen = false }) {
  const {
    profile,
    unreadCount,
    notifications,
    markAllNotificationsRead,
    markNotificationRead,
    showToast,
  } = useApp();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const actionsRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setNotificationsOpen(false);
    setProfileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!notificationsOpen && !profileOpen) return undefined;
    const handlePointer = (event) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [notificationsOpen, profileOpen]);

  const handleNotificationSelect = (notification) => {
    markNotificationRead(notification.id);
    setNotificationsOpen(false);
    const target =
      notification.type === 'report'
        ? '/reports'
        : notification.type === 'system'
          ? '/settings'
          : '/results';
    navigate(target);
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          className="header-icon-btn mobile-menu-btn"
          aria-label="Open navigation menu"
          aria-expanded={mobileOpen}
          onClick={onOpenMobile}
        >
          <Menu size={20} />
        </button>
        <Link to="/dashboard" className="header-brand" aria-label="VanaDrishti AI dashboard">
          <img src="/assets/logo.svg" alt="" className="brand-logo" />
          <span className="brand-text">
            <span className="brand-name">VanaDrishti AI</span>
            <span className="brand-sub">Forest Loss Monitoring &amp; Early Warning</span>
          </span>
        </Link>
      </div>

      <div className="header-actions" ref={actionsRef}>
        <button
          type="button"
          className="header-icon-btn"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
          aria-expanded={notificationsOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setNotificationsOpen((value) => !value);
            setProfileOpen(false);
          }}
        >
          <Bell size={19} />
          {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>

        <button
          type="button"
          className="user-menu-btn"
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          onClick={() => {
            setProfileOpen((value) => !value);
            setNotificationsOpen(false);
          }}
        >
          <span className="user-avatar">{getInitials(profile.name)}</span>
          <span className="user-menu-copy">
            <span className="user-menu-name">{profile.name}</span>
            <span className="user-menu-role">{profile.role}</span>
          </span>
          <ChevronDown size={14} aria-hidden="true" style={{ color: '#9dcbb6' }} />
        </button>

        {notificationsOpen && (
          <NotificationPanel
            notifications={notifications}
            unreadCount={unreadCount}
            onClose={() => setNotificationsOpen(false)}
            onMarkAllRead={markAllNotificationsRead}
            onSelect={handleNotificationSelect}
          />
        )}

        {profileOpen && (
          <UserProfileMenu
            profile={profile}
            onClose={() => setProfileOpen(false)}
            onProfile={() => {
              setProfileOpen(false);
              navigate('/settings?tab=account');
            }}
            onPreferences={() => {
              setProfileOpen(false);
              navigate('/settings?tab=map');
            }}
            onSignOut={() => {
              setProfileOpen(false);
              showToast({
                type: 'info',
                title: 'Demo mode',
                message: 'Sign out is unavailable because no authentication backend is connected.',
              });
            }}
          />
        )}
      </div>
    </header>
  );
}
