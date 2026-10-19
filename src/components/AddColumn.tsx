import { useRef, useState } from 'react';
import type { ColumnType } from '../types';
import { Popover } from './Popover';

const TYPES: { type: ColumnType; label: string; hint: string; color: string }[] = [
  { type: 'text', label: 'Text', hint: 'Free-form input', color: '#579bfc' },
  { type: 'select', label: 'Dropdown', hint: 'Pick from colored labels', color: '#a25ddc' },
  { type: 'status', label: 'Status', hint: 'Working on it / Done / Stuck', color: '#00c875' },
  { type: 'url', label: 'Link', hint: 'Clickable URL', color: '#fdab3d' },
];

export function AddColumn({ onAdd }: { onAdd: (type: ColumnType, name: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div className="col-header add-col">
      <button ref={ref} className="col-menu-btn visible" onClick={() => setOpen(!open)} aria-label="Add column">
        +
      </button>
      {open && (
        <Popover anchor={ref} onClose={() => setOpen(false)} align="right" className="menu">
          <div className="menu-label">Add column</div>
          {TYPES.map((t) => (
            <button
              key={t.type}
              onClick={() => {
                onAdd(t.type, t.label);
                setOpen(false);
              }}
            >
              <span className="type-chip" style={{ background: t.color }} />
              <span>
                {t.label}
                <span className="muted small block">{t.hint}</span>
              </span>
            </button>
          ))}
        </Popover>
      )}
    </div>
  );
}
