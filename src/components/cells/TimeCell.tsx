import { useRef, useState } from 'react';
import type { TimeEntry, User } from '../../types';
import { entryMs, formatDuration, parseDuration, totalMs, useNow } from '../../time';
import { Avatar } from '../Avatar';
import { Popover } from '../Popover';

interface Props {
  entries: TimeEntry[];
  users: User[];
  /** Who this device tracks as; '' until chosen. */
  currentUserId: string;
  onStart: (userId: string) => void;
  onStop: () => void;
  /** Remember who is tracking on this device. */
  onSetCurrentUser: (userId: string) => void;
  onAdd: (ms: number, userId: string) => void;
  onReassign: (entryId: string, userId: string) => void;
  onDelete: (entryId: string) => void;
}

/** Play / stop timer for the current user, total for the item, and a log of who tracked what. */
export function TimeCell(props: Props) {
  const { entries, users, currentUserId, onStart, onStop, onSetCurrentUser } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<'log' | 'who' | null>(null);
  const mine = entries.find((e) => e.end == null && e.userId === currentUserId);
  const running = entries.filter((e) => e.end == null);
  const now = useNow(running.length > 0);
  const total = totalMs(entries, now);
  const me = users.find((u) => u.id === currentUserId);
  const runningUsers = running.map((e) => users.find((u) => u.id === e.userId)).filter((u): u is User => !!u);

  return (
    <>
      <div ref={ref} className={`time-cell ${mine ? 'running' : ''}`}>
        <button
          className="timer-btn"
          onClick={() => (mine ? onStop() : me ? onStart(me.id) : setOpen('who'))}
          title={mine ? `Stop ${me?.name}'s timer` : me ? `Start timer as ${me.name}` : 'Start timer'}
          aria-label={mine ? 'Stop timer' : 'Start timer'}
        >
          {mine ? '■' : '▶'}
        </button>
        <button className="time-total" onClick={() => setOpen(open === 'log' ? null : 'log')} title="Time log">
          {mine ? formatDuration(total, true) : total ? formatDuration(total) : <span className="placeholder">Start</span>}
        </button>
        {runningUsers.length > 0 && (
          <span className="avatar-stack" title={`Tracking now: ${runningUsers.map((u) => u.name).join(', ')}`}>
            {runningUsers.map((u) => (
              <Avatar key={u.id} user={u} size={20} />
            ))}
          </span>
        )}
      </div>
      {open === 'who' && (
        <Popover anchor={ref} onClose={() => setOpen(null)} className="menu people-pop">
          <div className="menu-label">Who's tracking this time?</div>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                onSetCurrentUser(u.id);
                onStart(u.id);
                setOpen(null);
              }}
            >
              <Avatar user={u} size={24} />
              <span className="grow">{u.name}</span>
            </button>
          ))}
          {!users.length && <div className="muted small pad">Add a user from the menu at the top right first.</div>}
          <div className="muted small pad">Remembered on this device — change it any time under “Tracking as”.</div>
        </Popover>
      )}
      {open === 'log' && (
        <Popover anchor={ref} onClose={() => setOpen(null)} className="time-pop">
          <TimeLog {...props} now={now} />
        </Popover>
      )}
    </>
  );
}

function TimeLog({ entries, users, now, currentUserId, onAdd, onReassign, onDelete }: Props & { now: number }) {
  const [text, setText] = useState('');
  const [userId, setUserId] = useState(currentUserId);
  const ms = parseDuration(text);
  const sorted = [...entries].sort((a, b) => b.start - a.start);
  const byUser = users
    .map((u) => ({ u, ms: totalMs(entries, now, (e) => e.userId === u.id) }))
    .filter((x) => x.ms > 0)
    .sort((a, b) => b.ms - a.ms);

  return (
    <div>
      <div className="panel-title">
        Time log <span className="muted small">· {formatDuration(totalMs(entries, now))} total</span>
      </div>
      {byUser.length > 0 && (
        <div className="time-by-user">
          {byUser.map(({ u, ms }) => (
            <span key={u.id} className="time-user-chip">
              <Avatar user={u} size={18} /> {u.name} <b>{formatDuration(ms)}</b>
            </span>
          ))}
        </div>
      )}
      <div className="time-log">
        {!sorted.length && <div className="muted small">No time tracked yet.</div>}
        {sorted.map((e) => {
          const u = users.find((x) => x.id === e.userId);
          return (
            <div className="time-entry" key={e.id}>
              {u ? <Avatar user={u} size={22} /> : <span className="avatar empty">?</span>}
              <span className="grow">
                <select
                  className="entry-user"
                  value={u ? e.userId : ''}
                  onChange={(ev) => onReassign(e.id, ev.target.value)}
                  title="Who tracked this time"
                >
                  {!u && <option value="">Removed user</option>}
                  {users.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
                <span className="muted small block">
                  {new Date(e.start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} {fmtTime(e.start)} –{' '}
                  {e.end ? fmtTime(e.end) : 'now'}
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
          if (!ms || !userId) return;
          onAdd(ms, userId);
          setText('');
        }}
      >
        <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)} required>
          <option value="" disabled>
            Who?
          </option>
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
