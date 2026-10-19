import { useRef, useState } from 'react';
import type { User } from '../../types';
import { Avatar } from '../Avatar';
import { Popover } from '../Popover';

interface Props {
  users: User[];
  value: string[];
  onChange: (ids: string[] | undefined) => void;
}

/** Assign one or more users to an item. */
export function PeopleCell({ users, value, onChange }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const assigned = value.map((id) => users.find((u) => u.id === id)).filter((u): u is User => !!u);

  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
    onChange(next.length ? next : undefined);
  };

  return (
    <>
      <button ref={ref} className="people-cell" onClick={() => setOpen(!open)} title={assigned.map((u) => u.name).join(', ')}>
        {assigned.length ? (
          <span className="avatar-stack">
            {assigned.slice(0, 3).map((u) => (
              <Avatar key={u.id} user={u} />
            ))}
            {assigned.length > 3 && <span className="avatar more">+{assigned.length - 3}</span>}
          </span>
        ) : (
          <span className="avatar empty">+</span>
        )}
      </button>
      {open && (
        <Popover anchor={ref} onClose={() => setOpen(false)} className="menu people-pop">
          <div className="menu-label">Assign people</div>
          {users.map((u) => (
            <button key={u.id} onClick={() => toggle(u.id)} className={value.includes(u.id) ? 'checked' : ''}>
              <Avatar user={u} size={24} />
              <span className="grow">{u.name}</span>
              {value.includes(u.id) && <span className="check">✓</span>}
            </button>
          ))}
          {!users.length && <div className="muted small pad">No users yet — add them from the Users button.</div>}
          {value.length > 0 && (
            <div className="pop-footer">
              <button className="link-btn" onClick={() => onChange(undefined)}>
                Unassign all
              </button>
            </div>
          )}
        </Popover>
      )}
    </>
  );
}
