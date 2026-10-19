import { useRef, useState } from 'react';
import type { Column, SortDir } from '../types';
import { Popover } from './Popover';

const TYPE_LABEL: Record<Column['type'], string> = { text: 'Text', select: 'Dropdown', status: 'Status', url: 'Link' };

interface Props {
  column: Column;
  sortDir?: SortDir;
  onSort: (dir: SortDir) => void;
  onFilter: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

export function ColumnHeader({ column, sortDir, onSort, onFilter, onRename, onDelete }: Props) {
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);

  const act = (fn: () => void) => () => {
    setMenu(false);
    fn();
  };

  return (
    <div className={`col-header ${column.locked ? 'name-col' : ''}`}>
      {renaming ? (
        <input
          className="cell-input center"
          autoFocus
          defaultValue={column.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v) onRename(v);
            setRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setRenaming(false);
          }}
        />
      ) : (
        <span className="col-title" onDoubleClick={() => setRenaming(true)} title={`${column.name} · ${TYPE_LABEL[column.type]}`}>
          {column.name}
          {sortDir && <span className="sort-ind">{sortDir === 'asc' ? '↑' : '↓'}</span>}
        </span>
      )}
      <button ref={menuRef} className="col-menu-btn" onClick={() => setMenu(!menu)} aria-label="Column menu">
        ⋯
      </button>
      {menu && (
        <Popover anchor={menuRef} onClose={() => setMenu(false)} align="right" className="menu">
          <div className="menu-label">{TYPE_LABEL[column.type]} column</div>
          <button onClick={act(() => onSort('asc'))}>↑ Sort A → Z</button>
          <button onClick={act(() => onSort('desc'))}>↓ Sort Z → A</button>
          <button onClick={act(onFilter)}>⛃ Filter by this column</button>
          <button onClick={act(() => setRenaming(true))}>✎ Rename</button>
          {!column.locked && (
            <button className="danger" onClick={act(onDelete)}>
              ✕ Delete column
            </button>
          )}
        </Popover>
      )}
    </div>
  );
}
