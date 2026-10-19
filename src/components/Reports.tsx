import { useMemo, useState } from 'react';
import type { Board, TimeEntry } from '../types';
import type { Mutator } from '../store';
import { formatDuration, hours, useNow } from '../time';
import { Avatar } from './Avatar';

type Range = 'today' | 'week' | 'month' | 'all';
const RANGES: { id: Range; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All time' },
];

function rangeStart(r: Range, now: number) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  if (r === 'today') return d.getTime();
  if (r === 'week') {
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // weeks start Monday
    return d.getTime();
  }
  if (r === 'month') return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  return 0;
}

/** Time tracked per person and per task, plus the full log. */
export function Reports({ board, update }: { board: Board; update: Mutator }) {
  const [range, setRange] = useState<Range>('week');
  const [userId, setUserId] = useState('all');
  const now = useNow(board.timeEntries.some((e) => e.end == null));
  const from = rangeStart(range, now);

  const itemById = useMemo(() => new Map(board.items.map((i) => [i.id, i])), [board.items]);
  const groupById = useMemo(() => new Map(board.groups.map((g) => [g.id, g])), [board.groups]);
  const userById = useMemo(() => new Map(board.users.map((u) => [u.id, u])), [board.users]);
  const clientCol = board.columns.find((c) => c.type === 'text' && c.name.toLowerCase() === 'client');

  // Entries overlapping the range, counted only for the part inside it.
  const rows = board.timeEntries
    .filter((e) => (userId === 'all' || e.userId === userId) && (e.end ?? now) > from)
    .map((e) => ({ e, ms: Math.max(0, (e.end ?? now) - Math.max(e.start, from)) }))
    .sort((a, b) => b.e.start - a.e.start);

  const total = rows.reduce((s, r) => s + r.ms, 0);
  const sumBy = (key: (e: TimeEntry) => string) => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(key(r.e), (m.get(key(r.e)) ?? 0) + r.ms));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const byUser = sumBy((e) => e.userId);
  const byTask = sumBy((e) => e.itemId);
  const maxUser = Math.max(1, ...byUser.map(([, ms]) => ms));
  const nameOf = (id: string) => String(itemById.get(id)?.values.name || (itemById.has(id) ? 'Untitled task' : 'Deleted task'));
  /** Subtasks read "Parent › Subtask". */
  const taskName = (id: string) => {
    const parent = itemById.get(id)?.parentId;
    return parent ? `${nameOf(parent)} › ${nameOf(id)}` : nameOf(id);
  };

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [['Date', 'Person', 'Task', 'Group', 'Start', 'End', 'Hours'].join(',')];
    for (const { e, ms } of rows) {
      const item = itemById.get(e.itemId);
      lines.push(
        [
          new Date(e.start).toLocaleDateString(),
          userById.get(e.userId)?.name ?? 'Removed user',
          taskName(e.itemId),
          (item && groupById.get(item.groupId)?.name) ?? '',
          new Date(e.start).toLocaleString(),
          e.end ? new Date(e.end).toLocaleString() : 'running',
          hours(ms),
        ]
          .map((v) => esc(String(v)))
          .join(','),
      );
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = `time-report-${range}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="reports">
      <div className="toolbar flush">
        <div className="segmented">
          {RANGES.map((r) => (
            <button key={r.id} className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <select className="input" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="all">Everyone</option>
          {board.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn ghost small" onClick={exportCsv} disabled={!rows.length}>
          ⤓ Export CSV
        </button>
      </div>

      <div className="stat-row">
        <Stat label="Total tracked" value={formatDuration(total)} sub={`${hours(total)} hours`} />
        <Stat label="Tasks" value={String(byTask.length)} />
        <Stat label="Entries" value={String(rows.length)} />
        <Stat label="Running now" value={String(rows.filter((r) => r.e.end == null).length)} />
      </div>

      {!rows.length ? (
        <div className="empty-state">No time tracked in this period. Press ▶ in a Time tracking cell to start a timer.</div>
      ) : (
        <div className="report-grid">
          <section className="card">
            <h3>By person</h3>
            {byUser.map(([id, ms]) => {
              const u = userById.get(id);
              return (
                <div className="bar-row" key={id}>
                  <span className="bar-who">
                    {u ? <Avatar user={u} size={22} /> : <span className="avatar empty">?</span>}
                    {u?.name ?? 'Removed user'}
                  </span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${(ms / maxUser) * 100}%`, background: u?.color ?? '#9aadbd' }} />
                  </span>
                  <span className="bar-val">{formatDuration(ms)}</span>
                </div>
              );
            })}
          </section>

          <section className="card">
            <h3>By task</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Group</th>
                  {clientCol && <th>{clientCol.name}</th>}
                  <th>People</th>
                  <th className="num">Time</th>
                </tr>
              </thead>
              <tbody>
                {byTask.map(([id, ms]) => {
                  const item = itemById.get(id);
                  const g = item && groupById.get(item.groupId);
                  const people = [...new Set(rows.filter((r) => r.e.itemId === id).map((r) => r.e.userId))];
                  return (
                    <tr key={id}>
                      <td>{taskName(id)}</td>
                      <td>{g && <span className="group-tag" style={{ borderColor: g.color }}>{g.name}</span>}</td>
                      {clientCol && <td>{String(item?.values[clientCol.id] ?? '')}</td>}
                      <td>
                        <span className="avatar-stack">
                          {people.map((p) => userById.get(p)).map((u) => u && <Avatar key={u.id} user={u} size={22} />)}
                        </span>
                      </td>
                      <td className="num">{formatDuration(ms)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="card wide">
            <h3>Time log</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Person</th>
                  <th>Task</th>
                  <th>Start</th>
                  <th>End</th>
                  <th className="num">Duration</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ e, ms }) => (
                  <tr key={e.id}>
                    <td>{new Date(e.start).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                    <td>{userById.get(e.userId)?.name ?? 'Removed user'}</td>
                    <td>{taskName(e.itemId)}</td>
                    <td>{fmtTime(e.start)}</td>
                    <td>{e.end ? fmtTime(e.end) : <span className="live">running</span>}</td>
                    <td className="num">{formatDuration(ms, !e.end)}</td>
                    <td className="num">
                      <button
                        className="icon-btn"
                        aria-label="Delete entry"
                        onClick={() =>
                          confirm('Delete this time entry?') &&
                          update((b) => void (b.timeEntries = b.timeEntries.filter((x) => x.id !== e.id)))
                        }
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <span className="muted small">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="muted small">{sub}</span>}
    </div>
  );
}

const fmtTime = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
