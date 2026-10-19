import { useRef, useState } from 'react';
import type { Column, SelectOption } from '../../types';
import { PALETTE, uid } from '../../defaults';
import { Popover } from '../Popover';

interface Props {
  column: Column;
  value: string;
  onChange: (optionId: string) => void;
  onOptionsChange: (options: SelectOption[]) => void;
}

/** Select / status cell: the whole square cell is filled with the option's color. */
export function OptionCell({ column, value, onChange, onOptionsChange }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const current = column.options.find((o) => o.id === value);

  const close = () => {
    setOpen(false);
    setEditing(false);
  };

  return (
    <>
      <button
        ref={ref}
        className={`option-cell ${current ? '' : 'empty'} ${column.type === 'status' ? 'status' : ''}`}
        style={current ? { background: current.color } : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        title={current?.label}
      >
        <span>{current?.label ?? ''}</span>
      </button>
      {open && (
        <Popover anchor={ref} onClose={close} className="option-pop">
          {editing ? (
            <OptionEditor options={column.options} onChange={onOptionsChange} onDone={() => setEditing(false)} />
          ) : (
            <>
              <div className="option-grid">
                {column.options.map((o) => (
                  <button
                    key={o.id}
                    className={`option-swatch ${o.id === value ? 'selected' : ''}`}
                    style={{ background: o.color }}
                    onClick={() => {
                      onChange(o.id);
                      close();
                    }}
                  >
                    {o.label || ' '}
                  </button>
                ))}
                {!column.options.length && <div className="muted small">No labels yet</div>}
              </div>
              <div className="pop-footer">
                {current && (
                  <button className="link-btn" onClick={() => { onChange(''); close(); }}>
                    Clear
                  </button>
                )}
                <button className="link-btn" onClick={() => setEditing(true)}>
                  ✎ Edit labels
                </button>
              </div>
            </>
          )}
        </Popover>
      )}
    </>
  );
}

function OptionEditor({
  options,
  onChange,
  onDone,
}: {
  options: SelectOption[];
  onChange: (o: SelectOption[]) => void;
  onDone: () => void;
}) {
  const [colorFor, setColorFor] = useState<string | null>(null);
  const set = (id: string, patch: Partial<SelectOption>) =>
    onChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));

  return (
    <div className="option-editor">
      {options.map((o) => (
        <div key={o.id}>
          <div className="option-edit-row">
            <button
              className="color-dot"
              style={{ background: o.color }}
              onClick={() => setColorFor(colorFor === o.id ? null : o.id)}
              aria-label="Change color"
            />
            <input
              className="input"
              value={o.label}
              placeholder="Label"
              onChange={(e) => set(o.id, { label: e.target.value })}
            />
            <button className="icon-btn" onClick={() => onChange(options.filter((x) => x.id !== o.id))} aria-label="Delete label">
              ✕
            </button>
          </div>
          {colorFor === o.id && (
            <div className="palette">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  className={`palette-chip ${c === o.color ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => {
                    set(o.id, { color: c });
                    setColorFor(null);
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          )}
        </div>
      ))}
      <button
        className="link-btn"
        onClick={() =>
          onChange([...options, { id: uid(), label: 'New label', color: PALETTE[options.length % PALETTE.length] }])
        }
      >
        + New label
      </button>
      <div className="pop-footer">
        <button className="btn primary small" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
