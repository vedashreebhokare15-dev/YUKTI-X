import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';

export default function ExportButton({ options = [], label = 'Export', variant = 'btn-secondary', disabled = false }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointer = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div className="menu-wrap" ref={wrapperRef}>
      <button
        type="button"
        className={`btn ${variant}`}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
      >
        <Download size={14} aria-hidden="true" />
        {label}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div className="menu" role="menu">
          {options.map((option) => {
            const Icon = option.icon;
            return (
              <button
                type="button"
                key={option.label}
                className="dropdown-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  option.onSelect();
                }}
              >
                {Icon && <Icon size={14} aria-hidden="true" />}
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
