import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CellValue, Item, SortDir, ViewQuery } from './types';
import { useBoard } from './store';
import { applyQuery, cellCopyText, isActiveRule, isEditable, makeCtx, sameQuery, valueFromText } from './logic';
import { SelectionContext, useCellSelection, type CellRef } from './selection';
import { BulkBar } from './components/BulkBar';
import { GROUP_COLORS, uid } from './defaults';
import { GroupTable } from './components/GroupTable';
import { ViewTabs } from './components/ViewTabs';
import { FilterPanel, SortPanel, addFilter } from './components/QueryPanels';
import { Popover } from './components/Popover';
import { Reports } from './components/Reports';
import { ArchivePage } from './components/ArchivePage';
import { RowBar } from './components/RowBar';
import { activeItems, archiveItems, archivedEntries, deleteItems } from './archive';
import { TimerChip } from './components/TimerChip';
import { UserMenu } from './components/UserMenu';
import { PasscodeScreen, SyncBadge } from './components/SyncBadge';
import { BoardMenu } from './components/BoardMenu';

type Panel = 'filter' | 'sort' | null;

export default function App() {
  const { board, update, reset, status, error, submitPasscode } = useBoard();
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [page, setPage] = useState<'table' | 'reports' | 'archive'>('table');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(() => new Set());
  const filterBtn = useRef<HTMLButtonElement>(null);
  const sortBtn = useRef<HTMLButtonElement>(null);

  const activeView = board.views.find((v) => v.id === board.activeViewId) ?? board.views[0];
  const dirty = !sameQuery(board.draft, activeView);
  const ctx = useMemo(() => makeCtx(board.users, board.timeEntries), [board.users, board.timeEntries]);
  const visible = useMemo(
    () => applyQuery(activeItems(board.items), board.columns, board.draft, search, ctx),
    [board.items, board.columns, board.draft, search, ctx],
  );
  const activeFilters = board.draft.filters.filter((r) => isActiveRule(r, board.columns)).length;
  const narrowing = activeFilters > 0 || search.trim() !== '';

  // Rows per group as rendered, and the flat row/column order the cell selection works over.
  const groupRows = useMemo(() => {
    const m = new Map<string, Item[]>(board.groups.map((g) => [g.id, []]));
    visible.top.forEach((i) => m.get(i.groupId)?.push(i));
    return m;
  }, [board.groups, visible]);
  const isOpen = useCallback((i: Item) => !!i.open || visible.forcedOpen.has(i.id), [visible]);
  const rowIds = useMemo(
    () =>
      board.groups
        .filter((g) => !g.collapsed)
        .flatMap((g) =>
          groupRows.get(g.id)!.flatMap((i) => [i.id, ...(isOpen(i) ? (visible.children.get(i.id) ?? []).map((c) => c.id) : [])]),
        ),
    [board.groups, groupRows, visible, isOpen],
  );
  const colIds = useMemo(() => board.columns.map((c) => c.id), [board.columns]);

  // Ticked rows, limited to tasks still on the board (others may archive or delete them).
  const liveSelected = useMemo(() => new Set(rowIds.filter((id) => selectedRows.has(id))), [rowIds, selectedRows]);
  const archivedCount = useMemo(() => archivedEntries(board).length, [board]);
  const toggleRows = (ids: string[], on: boolean) => {
    selection.clear(); // row ticks and highlighted cells are separate selections
    setSelectedRows((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.popover') && setSelectedRows(new Set());
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const selection = useCellSelection(rowIds, colIds);
  const { cells, bounds } = selection;

  /** Write values into cells; `valueFor` gets a mutable column so pasted labels can be created. */
  const writeCells = (targets: CellRef[], valueFor: (col: (typeof board.columns)[number], i: number) => CellValue | undefined) =>
    update((b) => {
      targets.forEach((t, i) => {
        const item = b.items.find((x) => x.id === t.itemId);
        const col = b.columns.find((c) => c.id === t.colId);
        if (item && col && isEditable(col)) item.values[col.id] = valueFor(col, i);
      });
    });

  const setCell = (itemId: string, colId: string, v: CellValue | undefined) => {
    const bulk = cells.length > 1 && selection.isSelected(itemId, colId);
    writeCells(bulk ? cells.filter((c) => c.colId === colId) : [{ itemId, colId }], () => v);
  };

  // Latest values for the document-level keyboard / clipboard handlers below.
  const live = useRef({ cells, bounds, rowIds, colIds, board, ctx, writeCells });
  live.current = { cells, bounds, rowIds, colIds, board, ctx, writeCells };

  useEffect(() => {
    // Leave keys and clipboard alone while the user is typing in a field.
    const typing = () => !!(document.activeElement as HTMLElement | null)?.closest('input, textarea, select');

    const onKey = (e: KeyboardEvent) => {
      const { cells, writeCells } = live.current;
      if ((e.key === 'Delete' || e.key === 'Backspace') && cells.length && !typing()) {
        e.preventDefault();
        writeCells(cells, () => undefined);
      }
    };

    const onCopy = (e: ClipboardEvent) => {
      const { cells, bounds, rowIds, colIds, board, ctx } = live.current;
      if (!cells.length || !bounds || typing()) return;
      const sel = new Set(cells.map((c) => `${c.itemId}|${c.colId}`));
      const lines: string[] = [];
      for (let r = bounds.r1; r <= bounds.r2; r++) {
        const item = board.items.find((i) => i.id === rowIds[r])!;
        const row: string[] = [];
        for (let c = bounds.c1; c <= bounds.c2; c++) {
          const col = board.columns.find((x) => x.id === colIds[c])!;
          row.push(sel.has(`${item.id}|${col.id}`) ? cellCopyText(col, item, ctx).replace(/[\t\n]/g, ' ') : '');
        }
        lines.push(row.join('\t'));
      }
      e.clipboardData?.setData('text/plain', lines.join('\n'));
      e.preventDefault();
    };

    const onPaste = (e: ClipboardEvent) => {
      const { cells, bounds, rowIds, colIds, board, writeCells } = live.current;
      if (!cells.length || !bounds || typing()) return;
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const grid = text
        .replace(/\r/g, '')
        .replace(/\n$/, '')
        .split('\n')
        .map((l) => l.split('\t'));
      e.preventDefault();
      if (grid.length === 1 && grid[0].length === 1) {
        // One value fills every highlighted cell.
        writeCells(cells, (col) => valueFromText(col, grid[0][0], board.users));
        return;
      }
      // A block pastes from the top-left of the selection, spilling over rows/columns as needed.
      const targets: CellRef[] = [];
      const values: string[] = [];
      grid.forEach((line, dr) =>
        line.forEach((v, dc) => {
          const itemId = rowIds[bounds.r1 + dr];
          const colId = colIds[bounds.c1 + dc];
          if (itemId && colId) {
            targets.push({ itemId, colId });
            values.push(v);
          }
        }),
      );
      writeCells(targets, (col, i) => valueFromText(col, values[i], board.users));
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
    };
  }, []);

  const setDraft = (q: ViewQuery) => update((b) => void (b.draft = q));
  const loadView = (id: string) =>
    update((b) => {
      const v = b.views.find((x) => x.id === id)!;
      b.activeViewId = id;
      b.draft = { sort: v.sort, conjunction: v.conjunction, filters: v.filters };
    });

  const saveView = () =>
    update((b) => {
      Object.assign(b.views.find((v) => v.id === b.activeViewId)!, b.draft);
    });

  const saveAsNew = () => {
    const name = prompt('Name this view', describe(board.draft));
    if (!name?.trim()) return;
    update((b) => {
      const id = uid();
      b.views.push({ id, name: name.trim(), ...b.draft });
      b.activeViewId = id;
    });
  };

  const sortColumn = (columnId: string, dir: SortDir) => setDraft({ ...board.draft, sort: [{ id: uid(), columnId, dir }] });
  const filterColumn = (columnId: string) => {
    setDraft(addFilter(board.draft, board.columns, columnId));
    setPanel('filter');
  };

  if (status === 'passcode') return <PasscodeScreen onSubmit={submitPasscode} />;

  function describe(q: ViewQuery) {
    const col = (id: string) => board.columns.find((c) => c.id === id)?.name ?? '';
    const parts = q.sort.map((s) => `${col(s.columnId)} ${s.dir === 'asc' ? 'A-Z' : 'Z-A'}`);
    if (q.filters.length) parts.push(`${q.filters.length} filter${q.filters.length > 1 ? 's' : ''}`);
    return parts.join(', ') || 'New view';
  }

  return (
    <SelectionContext.Provider value={selection}>
      <div className={`app ${cells.length > 1 ? 'multi' : ''}`}>
        <header className="board-header">
          <div className="title-row">
            <input
              className="board-title"
              defaultValue={board.name}
              key={board.name}
              onBlur={(e) => e.target.value.trim() && update((b) => void (b.name = e.target.value.trim()))}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
            <BoardMenu board={board} update={update} />
            <SyncBadge status={status} error={error} />
            <div className="spacer" />
            <TimerChip board={board} update={update} />
            <UserMenu board={board} update={update} />
          </div>
          <div className="tab-strip">
            <ViewTabs
              views={board.views}
              activeId={page === 'table' ? activeView.id : ''}
              dirty={dirty}
              onSelect={(id) => {
                setPage('table');
                if (id !== activeView.id || page === 'table') loadView(id);
              }}
              onRename={(id, name) => update((b) => void (b.views.find((v) => v.id === id)!.name = name))}
              onDelete={(id) => {
                if (!confirm('Delete this view?')) return;
                const next = board.views.find((v) => v.id !== id)!;
                update((b) => {
                  b.views = b.views.filter((v) => v.id !== id);
                  b.activeViewId = next.id;
                  b.draft = { sort: next.sort, conjunction: next.conjunction, filters: next.filters };
                });
              }}
              onAdd={() =>
                update((b) => {
                  const id = uid();
                  b.views.push({ id, name: `View ${b.views.length + 1}`, sort: [], conjunction: 'and', filters: [] });
                  b.activeViewId = id;
                  b.draft = { sort: [], conjunction: 'and', filters: [] };
                })
              }
            />
            <div className={`tab ${page === 'archive' ? 'active' : ''}`}>
              <button className="tab-btn" onClick={() => setPage('archive')}>
                🗄 Archive{archivedCount ? <span className="tab-count">{archivedCount}</span> : null}
              </button>
            </div>
            <div className={`tab ${page === 'reports' ? 'active' : ''}`}>
              <button className="tab-btn" onClick={() => setPage('reports')}>
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
                <rect x="1" y="8" width="3" height="7" />
                <rect x="6.5" y="4" width="3" height="11" />
                <rect x="12" y="1" width="3" height="14" />
              </svg>
              Reports
              </button>
            </div>
          </div>
        </header>

        {page === 'reports' ? (
          <Reports board={board} update={update} />
        ) : page === 'archive' ? (
          <ArchivePage board={board} update={update} />
        ) : (
          <>
            <div className="toolbar">
              <button
                className="btn primary"
                onClick={() =>
                  update((b) => {
                    let g = b.groups[0];
                    if (!g) b.groups.push((g = { id: uid(), name: 'New group', color: GROUP_COLORS[0] }));
                    b.items.unshift({ id: uid(), groupId: g.id, values: { name: 'New task' } });
                  })
                }
              >
                New task
              </button>
              <input className="input search" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button
                ref={filterBtn}
                className={`btn ghost ${activeFilters ? 'on' : ''}`}
                onClick={() => setPanel(panel === 'filter' ? null : 'filter')}
              >
                ⛃ Filter{activeFilters ? ` / ${activeFilters}` : ''}
              </button>
              <button
                ref={sortBtn}
                className={`btn ghost ${board.draft.sort.length ? 'on' : ''}`}
                onClick={() => setPanel(panel === 'sort' ? null : 'sort')}
              >
                ⇅ Sort{board.draft.sort.length ? ` / ${board.draft.sort.length}` : ''}
              </button>

              {dirty && (
                <div className="save-bar">
                  <span className="muted small">Unsaved changes</span>
                  <button className="btn primary small" onClick={saveView}>
                    Save to “{activeView.name}”
                  </button>
                  <button className="btn ghost small" onClick={saveAsNew}>
                    Save as new view
                  </button>
                  <button className="btn ghost small" onClick={() => loadView(activeView.id)}>
                    Discard
                  </button>
                </div>
              )}

              <div className="spacer" />
              <button
                className="btn ghost small"
                onClick={() =>
                  update(
                    (b) =>
                      void b.groups.push({
                        id: uid(),
                        name: 'New group',
                        color: GROUP_COLORS[b.groups.length % GROUP_COLORS.length],
                      }),
                  )
                }
              >
                + Add group
              </button>
              {/* Resetting a shared board would wipe it for everyone, so it's local-only. */}
              {status === 'local' && (
                <button className="btn ghost small" onClick={() => confirm('Reset the board to sample data?') && reset()}>
                  Reset
                </button>
              )}
            </div>

            {panel === 'filter' && (
              <Popover anchor={filterBtn} onClose={() => setPanel(null)}>
                <FilterPanel columns={board.columns} users={board.users} query={board.draft} onChange={setDraft} />
              </Popover>
            )}
            {panel === 'sort' && (
              <Popover anchor={sortBtn} onClose={() => setPanel(null)}>
                <SortPanel columns={board.columns} query={board.draft} onChange={setDraft} />
              </Popover>
            )}

            <main className="board">
              {board.groups.map((g) => {
                const items = groupRows.get(g.id)!;
                const total = board.items.filter((i) => i.groupId === g.id && !i.parentId && !i.archived).length;
                if (narrowing && !items.length) return null;
                return (
                  <GroupTable
                    key={g.id}
                    board={board}
                    group={g}
                    items={items}
                    subtasks={visible.children}
                    isOpen={isOpen}
                    totalInGroup={total}
                    update={update}
                    setCell={setCell}
                    onSortColumn={sortColumn}
                    onFilterColumn={filterColumn}
                    selectedRows={liveSelected}
                    onToggleRows={toggleRows}
                  />
                );
              })}
              {narrowing && !visible.top.length && <div className="empty-state">No items match this filter.</div>}
            </main>
          </>
        )}

        {page === 'table' && liveSelected.size > 0 && (
          <RowBar
            count={liveSelected.size}
            groups={board.groups}
            onArchive={() => {
              update((b) => archiveItems(b, liveSelected));
              setSelectedRows(new Set());
            }}
            onMove={(groupId) =>
              update((b) => {
                // Subtasks follow their task.
                for (const i of b.items) if (liveSelected.has(i.id) || (i.parentId && liveSelected.has(i.parentId))) i.groupId = groupId;
              })
            }
            onDelete={() => {
              const n = liveSelected.size;
              if (!confirm(`Delete ${n} task${n === 1 ? '' : 's'} (and their subtasks) for good? Archive them instead to keep a copy.`)) return;
              update((b) => deleteItems(b, liveSelected));
              setSelectedRows(new Set());
            }}
            onClear={() => setSelectedRows(new Set())}
          />
        )}

        {page === 'table' && cells.length > 1 && liveSelected.size === 0 && (
          <BulkBar
            columns={board.columns}
            users={board.users}
            cells={cells}
            onSet={(colId, v) =>
              writeCells(
                cells.filter((c) => c.colId === colId),
                () => v,
              )
            }
            onClear={() => writeCells(cells, () => undefined)}
            onDismiss={selection.clear}
          />
        )}
      </div>
    </SelectionContext.Provider>
  );
}
