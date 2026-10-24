import { Info } from 'lucide-react';

export default function DemoNotice({ children, className = '' }) {
  return (
    <div className={`demo-note ${className}`.trim()}>
      <Info size={13} aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
