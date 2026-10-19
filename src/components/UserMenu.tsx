import { useRef, useState } from 'react';
import type { Board } from '../types';
import type { Mutator } from '../store';
import { USER_COLORS, uid } from '../defaults';
import { stopTimers } from '../timers';
import { Avatar } from './Avatar';
import { Popover } from './Popover';

/** Pick who you're tracking time as, and add / rename / remove users. */
export function UserMenu({ board, update }: { board: Board; update: Mutator }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const me = board.users.find((u) => u.id === board.currentUserId);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    update((b) => {
      b.users.push({ id: uid(), name: n, color: USER_COLORS[b.users.length % USER_COLORS.length] });
    });
    setName('');
  };

  return (
    <>
      <button ref={ref} className={`user-btn ${me ? '' : 'unset'}`} onClick={() => setOpen(!open)}>
        {me ? <Avatar user={me} size={24} /> : <span className="avatar empty">?</span>}
        <span>
          <span className="muted small block">Tracking as</span>
          {me?.name ?? 'Who are you?'}
        </span>
        <span className="muted">▾</span>
      </button>
      {open && (
        <Popover anchor={ref} onClose={() => setOpen(false)} align="right" className="menu user-pop">
          <div className="menu-label">Track time as</div>
          {board.users.map((u) => (
            <div className={`user-row ${u.id === board.currentUserId ? 'checked' : ''}`} key={u.id}>
              <button className="user-pick" onClick={() => update((b) => void (b.currentUserId = u.id))} title={`Track as ${u.name}`}>
                <Avatar user={u} size={24} />
              </button>
              <input
                className="cell-input"
                defaultValue={u.name}
                key={u.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== u.name) update((b) => void (b.users.find((x) => x.id === u.id)!.name = v));
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
              {u.id === board.currentUserId && <span className="check">✓</span>}
              <button
                className="icon-btn"
                aria-label={`Remove ${u.name}`}
                onClick={() => {
                  if (!confirm(`Remove ${u.name}? Their tracked time stays in reports.`)) return;
                  update((b) => {
                    stopTimers(b, u.id);
                    b.users = b.users.filter((x) => x.id !== u.id);
                    for (const i of b.items)
                      for (const [k, v] of Object.entries(i.values))
                        if (Array.isArray(v)) i.values[k] = v.filter((id) => id !== u.id);
                    if (b.currentUserId === u.id) b.currentUserId = '';
                  });
                }}
              >
                ✕
              </button>
            </div>
          ))}
          <form
            className="add-user"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input className="input" placeholder="Add user" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn primary small" disabled={!name.trim()}>
              Add
            </button>
          </form>
        </Popover>
      )}
    </>
  );
}
