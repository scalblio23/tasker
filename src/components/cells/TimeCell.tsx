import { useRef, useState } from 'react';
import type { TimeEntry, User } from '../../types';
import { entryMs, formatDuration, parseDuration, totalMs, useNow } from '../../time';
import { Avatar } from '../Avatar';
import { Popover } from '../Popover';

interface Props {
  entries: TimeEntry[];
  users: User[];
  currentUserId: string;
  onStart: () => void;
  onStop: () => void;
  onAdd: (ms: number, userId: string) => void;
  onDelete: (entryId: string) => void;
}

/** Play / stop timer for the current user, total for the item, and a log of entries. */
export function TimeCell({ entries, users, currentUserId, onStart, onStop, onAdd, onDelete }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const mine = entries.find((e) => e.end == null && e.userId === currentUserId);
  const anyRunning = entries.some((e) => e.end == null);
  const now = useNow(anyRunning);
  const total = totalMs(entries, now);
  const others = entries.filter((e) => e.end == null && e.userId !== currentUserId);

  return (
    <>
      <div ref={ref} className={`time-cell ${mine ? 'running' : ''}`}>
        <button
          className="timer-btn"
          onClick={mine ? onStop : onStart}
          title={mine ? 'Stop timer' : 'Start timer'}
          aria-label={mine ? 'Stop timer' : 'Start timer'}
        >
          {mine ? '■' : '▶'}
        </button>
        <button className="time-total" onClick={() => setOpen(!open)} title="Time log">
          {mine ? formatDuration(total, true) : total ? formatDuration(total) : <span className="placeholder">Start</span>}
        </button>
        {others.length > 0 && <span className="others-dot" title={`${others.length} other timer(s) running`} />}
      </div>
      {open && (
        <Popover anchor={ref} onClose={() => setOpen(false)} className="time-pop">
          <TimeLog entries={entries} users={users} now={now} currentUserId={currentUserId} onAdd={onAdd} onDelete={onDelete} />
        </Popover>
      )}
    </>
  );
}

function TimeLog({
  entries,
  users,
  now,
  currentUserId,
  onAdd,
  onDelete,
}: Pick<Props, 'entries' | 'users' | 'currentUserId' | 'onAdd' | 'onDelete'> & { now: number }) {
  const [text, setText] = useState('');
  const [userId, setUserId] = useState(currentUserId);
  const ms = parseDuration(text);
  const sorted = [...entries].sort((a, b) => b.start - a.start);

  return (
    <div>
      <div className="panel-title">
        Time log <span className="muted small">· {formatDuration(totalMs(entries, now))} total</span>
      </div>
      <div className="time-log">
        {!sorted.length && <div className="muted small">No time tracked yet.</div>}
        {sorted.map((e) => {
          const u = users.find((x) => x.id === e.userId);
          return (
            <div className="time-entry" key={e.id}>
              {u ? <Avatar user={u} size={22} /> : <span className="avatar empty small-av">?</span>}
              <span className="grow">
                {u?.name ?? 'Removed user'}
                <span className="muted small block">
                  {new Date(e.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}{' '}
                  {fmtTime(e.start)} – {e.end ? fmtTime(e.end) : 'now'}
                </span>
              </span>
              <span className={e.end ? '' : 'live'}>{formatDuration(entryMs(e, now), !e.end)}</span>
              <button className="icon-btn" onClick={() => onDelete(e.id)} aria-label="Delete entry">
                ✕
              </button>
            </div>
          );
        })}
      </div>
      <form
        className="add-time"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ms) return;
          onAdd(ms, userId);
          setText('');
        }}
      >
        <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <input className="input" placeholder="e.g. 1h 30m" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn primary small" disabled={!ms || !userId}>
          Add time
        </button>
      </form>
    </div>
  );
}

const fmtTime = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
