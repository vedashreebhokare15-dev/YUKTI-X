import { LogOut, SlidersHorizontal, User } from 'lucide-react';
import { getInitials } from '../../utils/formatters';

export default function UserProfileMenu({ profile, onClose, onProfile, onPreferences, onSignOut }) {
  return (
    <div className="header-popover profile-panel" role="menu" aria-label="User menu">
      <div className="profile-panel-head">
        <span className="user-avatar">{getInitials(profile.name)}</span>
        <span>
          <span className="profile-panel-name">{profile.name}</span>
          <span className="profile-panel-mail">{profile.email}</span>
        </span>
      </div>
      <button type="button" className="dropdown-item" role="menuitem" onClick={onProfile}>
        <User size={14} aria-hidden="true" />
        Profile
      </button>
      <button type="button" className="dropdown-item" role="menuitem" onClick={onPreferences}>
        <SlidersHorizontal size={14} aria-hidden="true" />
        Preferences
      </button>
      <div className="dropdown-sep" />
      <button type="button" className="dropdown-item danger" role="menuitem" onClick={onSignOut}>
        <LogOut size={14} aria-hidden="true" />
        Sign Out
      </button>
    </div>
  );
}
