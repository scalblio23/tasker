import { useRef, useState } from 'react';
import type { CellValue, Column, User } from '../types';
import type { CellRef } from '../selection';
import { choicesFor, isEditable, valueFromText } from '../logic';
import { Popover } from './Popover';

interface Props {
  columns: Column[];
  users: User[];
  cells: CellRef[];
  /** Set every selected cell in a column. Text is converted per column type. */
  onSet: (colId: string, value: CellValue | undefined) => void;
  onClear: () => void;
  onDismiss: () => void;
}

/** Floating bar shown while several cells are highlighted. */
export function BulkBar({ columns, users, cells, onSet, onClear, onDismiss }: Props) {
  const involved = columns.filter((c) => cells.some((x) => x.colId === c.id));
  const settable = involved.filter(isEditable);
  const rows = new Set(cells.map((c) => c.itemId)).size;

  return (
    <div className="bulk-bar">
      <span className="bulk-count">{cells.length}</span>
      <span className="bulk-label">
        cells selected
        <span className="muted small block">
          {rows} row{rows === 1 ? '' : 's'} · {involved.length} column{involved.length === 1 ? '' : 's'}
        </span>
      </span>
      <span className="bulk-sep" />
      {settable.map((c) => (
        <BulkSetter key={c.id} column={c} users={users} count={cells.filter((x) => x.colId === c.id).length} onSet={(v) => onSet(c.id, v)} />
      ))}
      <span className="bulk-sep" />
      <button className="btn ghost small" onClick={onClear} title="Delete / Backspace">
        Clear values
      </button>
      <button className="icon-btn" onClick={onDismiss} aria-label="Deselect" title="Esc">
        ✕
      </button>
    </div>
  );
}

function BulkSetter({
  column,
  users,
  count,
  onSet,
}: {
  column: Column;
  users: User[];
  count: number;
  onSet: (v: CellValue | undefined) => void;
}) {
  const choices = choicesFor(column, users);
  const pick = column.type !== 'text' && column.type !== 'url';
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const close = () => {
    setOpen(false);
    setText('');
  };

  return (
    <>
      <button ref={ref} className="btn ghost small" onClick={() => (open ? close() : setOpen(true))}>
        Set {column.name} {count > 1 && <span className="muted">({count})</span>} ▾
      </button>
      {open && (
        <Popover anchor={ref} onClose={close} className="option-pop bulk-pop">
          <div className="menu-label">
            Set {count} {column.name} cell{count === 1 ? '' : 's'} to
          </div>
          {pick ? (
            <div className="option-grid">
              {choices.map((o) => (
                <button
                  key={o.id}
                  className="option-swatch"
                  style={{ background: o.color }}
                  onClick={() => {
                    onSet(column.type === 'people' ? [o.id] : o.id);
                    close();
                  }}
                >
                  {o.label || ' '}
                </button>
              ))}
              {!choices.length && <div className="muted small">Nothing to pick yet</div>}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                // Only text/url reach here, so no labels get created on the shared column object.
                onSet(valueFromText(column, text, users));
                close();
              }}
            >
              <input
                className="input full"
                autoFocus
                value={text}
                placeholder={column.type === 'url' ? 'www.example.com' : 'Value'}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="pop-footer">
                <button type="submit" className="btn primary small">
                  Apply
                </button>
              </div>
            </form>
          )}
        </Popover>
      )}
    </>
  );
}
