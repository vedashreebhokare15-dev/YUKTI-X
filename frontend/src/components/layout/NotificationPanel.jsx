import { AlertTriangle, Bell, FileText, Info, TrendingDown } from 'lucide-react';
import { formatRelative } from '../../utils/formatters';

const TYPE_ICONS = {
  analysis: TrendingDown,
  warning: AlertTriangle,
  report: FileText,
  system: Info,
};

const TYPE_CLASS = {
  analysis: '',
  warning: 'warning',
  report: '',
  system: 'info',
};

export default function NotificationPanel({
  notifications,
  unreadCount,
  onClose,
  onMarkAllRead,
  onSelect,
}) {
  return (
    <div className="header-popover notif-panel" id="notification-panel" role="dialog" aria-label="Notifications">
      <div className="popover-head">
        <div className="popover-title">
          <Bell size={15} />
          Notifications
          {unreadCount > 0 && <span className="popover-count">{unreadCount} new</span>}
        </div>
        <button type="button" className="text-link-btn" onClick={onMarkAllRead} disabled={unreadCount === 0}>
          Mark all read
        </button>
      </div>

      <div className="notif-list">
        {notifications.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
            No notifications.
          </div>
        ) : (
          notifications.map((notification) => {
            const Icon = TYPE_ICONS[notification.type] || Bell;
            return (
              <button
                type="button"
                key={notification.id}
                className={`notif-item ${notification.read ? '' : 'unread'}`.trim()}
                onClick={() => onSelect(notification)}
              >
                <span className={`notif-icon ${TYPE_CLASS[notification.type] || ''}`.trim()} aria-hidden="true">
                  <Icon size={15} />
                </span>
                <span className="notif-copy">
                  <span className="notif-title">
                    {notification.title}
                    {!notification.read && <span className="notif-dot" aria-label="Unread" />}
                  </span>
                  <span className="notif-message">{notification.message}</span>
                  <span className="notif-time">{formatRelative(notification.createdAt)}</span>
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="notif-foot">
        <Info size={12} aria-hidden="true" />
        Demo notifications — no email or push service is connected.
      </div>
    </div>
  );
}
