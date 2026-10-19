import { useRef, useState } from 'react';
import type { Column, SortDir } from '../types';
import { Popover } from './Popover';
import { MAX_WIDTH, MIN_WIDTH, defaultWidth } from '../defaults';

/** Column currently being dragged (dataTransfer can't be read during dragover). */
let draggingId: string | null = null;

const TYPE_LABEL: Record<Column['type'], string> = { text: 'Text', select: 'Dropdown', status: 'Status', url: 'Link', people: 'Person', time: 'Time tracking', files: 'Attachments' };

interface Props {
  column: Column;
  sortDir?: SortDir;
  onSort: (dir: SortDir) => void;
  onFilter: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  /** Move this column one step; undefined when it can't move that way. */
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  /** Another column was dropped on this header. */
  onDropColumn: (fromId: string, side: 'before' | 'after') => void;
  onResize: (width: number) => void;
}

export function ColumnHeader(props: Props) {
  const { column, sortDir, onSort, onFilter, onRename, onDelete, onMoveLeft, onMoveRight, onDropColumn, onResize } = props;
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [dropSide, setDropSide] = useState<'before' | 'after' | null>(null);
  const draggable = !column.locked && !renaming;

  const startResize = (e: React.MouseEvent) => {
    // preventDefault also stops the header's native drag-to-reorder from starting.
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = column.width;
    const min = column.locked ? 160 : MIN_WIDTH;
    let frame = 0;
    const move = (ev: MouseEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => onResize(Math.round(Math.min(MAX_WIDTH, Math.max(min, startW + ev.clientX - startX)))));
    };
    const up = () => {
      document.body.classList.remove('col-resizing');
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.body.classList.add('col-resizing');
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  };

  const act = (fn: () => void) => () => {
    setMenu(false);
    fn();
  };

  return (
    <div
      className={`col-header ${column.locked ? 'name-col' : ''} ${draggable ? 'draggable' : ''} ${dropSide ? `drop-${dropSide}` : ''}`}
      draggable={draggable}
      onDragStart={(e) => {
        draggingId = column.id;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', column.name);
      }}
      onDragEnd={() => (draggingId = null)}
      onDragOver={(e) => {
        if (!draggingId || draggingId === column.id || column.locked) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        setDropSide(e.clientX < r.left + r.width / 2 ? 'before' : 'after');
      }}
      onDragLeave={() => setDropSide(null)}
      onDrop={(e) => {
        e.preventDefault();
        if (draggingId && dropSide) onDropColumn(draggingId, dropSide);
        draggingId = null;
        setDropSide(null);
      }}
    >
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
        <span className="col-title" onDoubleClick={() => setRenaming(true)} title={`${column.name} · ${TYPE_LABEL[column.type]}${draggable ? " · drag to reorder" : ""}`}>
          {column.name}
          {sortDir && <span className="sort-ind">{sortDir === 'asc' ? '↑' : '↓'}</span>}
        </span>
      )}
      <button ref={menuRef} className="col-menu-btn" onClick={() => setMenu(!menu)} aria-label="Column menu">
        ⋯
      </button>
      <span
        className="col-resize"
        onMouseDown={startResize}
        onDoubleClick={() => onResize(defaultWidth(column))}
        title="Drag to resize · double-click to reset"
        aria-hidden="true"
      />
      {menu && (
        <Popover anchor={menuRef} onClose={() => setMenu(false)} align="right" className="menu">
          <div className="menu-label">{TYPE_LABEL[column.type]} column</div>
          <button onClick={act(() => onSort('asc'))}>↑ Sort A → Z</button>
          <button onClick={act(() => onSort('desc'))}>↓ Sort Z → A</button>
          <button onClick={act(onFilter)}>⛃ Filter by this column</button>
          {onMoveLeft && <button onClick={act(onMoveLeft)}>← Move left</button>}
          {onMoveRight && <button onClick={act(onMoveRight)}>→ Move right</button>}
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
