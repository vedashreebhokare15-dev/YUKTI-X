import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing to show', message, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        <Icon size={20} />
      </span>
      <div className="empty-state-title">{title}</div>
      {message && <p className="empty-state-text">{message}</p>}
      {action}
    </div>
  );
}
