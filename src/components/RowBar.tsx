import { useRef, useState } from 'react';
import type { Group } from '../types';
import { Popover } from './Popover';

interface Props {
  count: number;
  groups: Group[];
  onArchive: () => void;
  onMove: (groupId: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

/** Floating bar for rows ticked with the left-hand checkboxes. */
export function RowBar({ count, groups, onArchive, onMove, onDelete, onClear }: Props) {
  const moveRef = useRef<HTMLButtonElement>(null);
  const [moving, setMoving] = useState(false);
  return (
    <div className="bulk-bar row-bar">
      <span className="bulk-count">{count}</span>
      <span className="bulk-label">{count === 1 ? 'task' : 'tasks'} selected</span>
      <span className="bulk-sep" />
      <button className="btn ghost small" onClick={onArchive}>
        🗄 Archive
      </button>
      <button ref={moveRef} className="btn ghost small" onClick={() => setMoving(!moving)}>
        ⇄ Move to ▾
      </button>
      <button className="btn ghost small danger" onClick={onDelete}>
        ✕ Delete
      </button>
      <span className="bulk-sep" />
      <button className="icon-btn" onClick={onClear} aria-label="Deselect" title="Esc">
        ✕
      </button>
      {moving && (
        <Popover anchor={moveRef} onClose={() => setMoving(false)} className="menu">
          <div className="menu-label">Move to group</div>
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                onMove(g.id);
                setMoving(false);
              }}
            >
              <span className="type-chip" style={{ background: g.color, width: 12, height: 12 }} />
              {g.name}
            </button>
          ))}
        </Popover>
      )}
    </div>
  );
}
