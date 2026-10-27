import { useState } from 'react';
import type { Board } from '../types';
import type { Mutator } from '../store';
import { archivedEntries, deleteItems, restoreItems } from '../archive';
import { cellText, makeCtx } from '../logic';
import { Checkbox } from './GroupTable';

/** Archived tasks: search, restore to the board, or delete for good. */
export function ArchivePage({ board, update }: { board: Board; update: Mutator }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const ctx = makeCtx(board.users, board.timeEntries);
  const byId = new Map(board.items.map((i) => [i.id, i]));
  const groupName = (id: string) => board.groups.find((g) => g.id === id)?.name ?? '—';
  // A couple of the board's own columns for context (e.g. Company, Client).
  const extraCols = board.columns.filter((c) => !c.locked && (c.type === 'text' || c.type === 'people' || c.type === 'status')).slice(0, 3);

  const needle = search.trim().toLowerCase();
  const entries = archivedEntries(board).filter(
    (i) => !needle || board.columns.some((c) => cellText(c, i, ctx).toLowerCase().includes(needle)),
  );
  const ids = entries.map((i) => i.id);
  const sel = ids.filter((id) => picked.has(id));
  const subCount = (id: string) => board.items.filter((i) => i.parentId === id).length;

  const restore = (list: string[]) => {
    update((b) => restoreItems(b, list));
    setPicked(new Set());
  };
  const remove = (list: string[]) => {
    if (!confirm(`Delete ${list.length} archived task${list.length === 1 ? '' : 's'} for good? This can't be undone.`)) return;
    update((b) => deleteItems(b, list));
    setPicked(new Set());
  };

  return (
    <div className="reports archive">
      <div className="toolbar flush">
        <input className="input search" placeholder="Search archive" value={search} onChange={(e) => setSearch(e.target.value)} />
        <span className="muted small">
          {entries.length} archived task{entries.length === 1 ? '' : 's'}
        </span>
        <div className="spacer" />
        {sel.length > 0 && (
          <>
            <span className="muted small">{sel.length} selected</span>
            <button className="btn primary small" onClick={() => restore(sel)}>
              ↺ Restore
            </button>
            <button className="btn ghost small danger" onClick={() => remove(sel)}>
              ✕ Delete for good
            </button>
          </>
        )}
      </div>
      {!entries.length ? (
        <div className="empty-state">
          {needle ? 'No archived tasks match.' : 'Nothing archived. Tick tasks on the board and choose Archive to move them here.'}
        </div>
      ) : (
        <div className="card">
          <table className="report-table">
            <thead>
              <tr>
                <th className="check-th">
                  <Checkbox
                    checked={sel.length === ids.length}
                    indeterminate={sel.length > 0 && sel.length < ids.length}
                    onChange={(on) => setPicked(new Set(on ? ids : []))}
                    label="Select all archived"
                  />
                </th>
                <th>Task</th>
                <th>Group</th>
                {extraCols.map((c) => (
                  <th key={c.id}>{c.name}</th>
                ))}
                <th>Archived</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((i) => {
                const parent = i.parentId ? byId.get(i.parentId) : undefined;
                const subs = subCount(i.id);
                return (
                  <tr key={i.id}>
                    <td className="check-th">
                      <Checkbox
                        checked={picked.has(i.id)}
                        onChange={(on) =>
                          setPicked((p) => {
                            const n = new Set(p);
                            if (on) n.add(i.id);
                            else n.delete(i.id);
                            return n;
                          })
                        }
                        label="Select archived task"
                      />
                    </td>
                    <td>
                      {parent && <span className="muted">{String(parent.values.name || 'Untitled')} › </span>}
                      {String(i.values.name || 'Untitled task')}
                      {subs > 0 && <span className="muted small"> · {subs} subtask{subs === 1 ? '' : 's'}</span>}
                    </td>
                    <td>{groupName(i.groupId)}</td>
                    {extraCols.map((c) => (
                      <td key={c.id}>{cellText(c, i, ctx)}</td>
                    ))}
                    <td className="nowrap">{new Date(i.archived ?? 0).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="num nowrap">
                      <button className="link-btn" onClick={() => restore([i.id])}>
                        Restore
                      </button>{' '}
                      <button className="icon-btn" onClick={() => remove([i.id])} aria-label="Delete for good" title="Delete for good">
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
