import { useState } from 'react';
import type { View } from '../types';

interface Props {
  views: View[];
  activeId: string;
  dirty: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export function ViewTabs({ views, activeId, dirty, onSelect, onRename, onDelete, onAdd }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  return (
    <nav className="tabs">
      {views.map((v) => (
        <div key={v.id} className={`tab ${v.id === activeId ? 'active' : ''}`}>
          {renaming === v.id ? (
            <input
              className="tab-input"
              autoFocus
              defaultValue={v.name}
              onBlur={(e) => {
                if (e.target.value.trim()) onRename(v.id, e.target.value.trim());
                setRenaming(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setRenaming(null);
              }}
            />
          ) : (
            <button
              className="tab-btn"
              onClick={() => onSelect(v.id)}
              onDoubleClick={() => setRenaming(v.id)}
              title="Double-click to rename"
            >
              {v.name}
              {v.id === activeId && dirty && <span className="dirty-dot" title="Unsaved sort/filter changes" />}
            </button>
          )}
          {views.length > 1 && v.id === activeId && (
            <button className="tab-x" onClick={() => onDelete(v.id)} aria-label="Delete view">
              ✕
            </button>
          )}
        </div>
      ))}
      <button className="tab-add" onClick={onAdd} title="New view">
        +
      </button>
    </nav>
  );
}
