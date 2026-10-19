import { useMemo, useRef, useState } from 'react';
import type { SortDir, ViewQuery } from './types';
import { useBoard } from './store';
import { applyQuery, isActiveRule, sameQuery } from './logic';
import { GROUP_COLORS, uid } from './defaults';
import { GroupTable } from './components/GroupTable';
import { ViewTabs } from './components/ViewTabs';
import { FilterPanel, SortPanel, addFilter } from './components/QueryPanels';
import { Popover } from './components/Popover';

type Panel = 'filter' | 'sort' | null;

export default function App() {
  const { board, update, reset } = useBoard();
  const [search, setSearch] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const filterBtn = useRef<HTMLButtonElement>(null);
  const sortBtn = useRef<HTMLButtonElement>(null);

  const activeView = board.views.find((v) => v.id === board.activeViewId) ?? board.views[0];
  const dirty = !sameQuery(board.draft, activeView);
  const visible = useMemo(
    () => applyQuery(board.items, board.columns, board.draft, search),
    [board.items, board.columns, board.draft, search],
  );
  const activeFilters = board.draft.filters.filter((r) => isActiveRule(r, board.columns)).length;
  const narrowing = activeFilters > 0 || search.trim() !== '';

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

  function describe(q: ViewQuery) {
    const col = (id: string) => board.columns.find((c) => c.id === id)?.name ?? '';
    const parts = q.sort.map((s) => `${col(s.columnId)} ${s.dir === 'asc' ? 'A-Z' : 'Z-A'}`);
    if (q.filters.length) parts.push(`${q.filters.length} filter${q.filters.length > 1 ? 's' : ''}`);
    return parts.join(', ') || 'New view';
  }

  return (
    <div className="app">
      <header className="board-header">
        <input
          className="board-title"
          defaultValue={board.name}
          key={board.name}
          onBlur={(e) => e.target.value.trim() && update((b) => void (b.name = e.target.value.trim()))}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <ViewTabs
          views={board.views}
          activeId={activeView.id}
          dirty={dirty}
          onSelect={loadView}
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
      </header>

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
          onClick={() => update((b) => void b.groups.push({ id: uid(), name: 'New group', color: GROUP_COLORS[b.groups.length % GROUP_COLORS.length] }))}
        >
          + Add group
        </button>
        <button className="btn ghost small" onClick={() => confirm('Reset the board to sample data?') && reset()}>
          Reset
        </button>
      </div>

      {panel === 'filter' && (
        <Popover anchor={filterBtn} onClose={() => setPanel(null)}>
          <FilterPanel columns={board.columns} query={board.draft} onChange={setDraft} />
        </Popover>
      )}
      {panel === 'sort' && (
        <Popover anchor={sortBtn} onClose={() => setPanel(null)}>
          <SortPanel columns={board.columns} query={board.draft} onChange={setDraft} />
        </Popover>
      )}

      <main className="board">
        {board.groups.map((g) => {
          const items = visible.filter((i) => i.groupId === g.id);
          const total = board.items.filter((i) => i.groupId === g.id).length;
          if (narrowing && !items.length) return null;
          return (
            <GroupTable
              key={g.id}
              board={board}
              group={g}
              items={items}
              totalInGroup={total}
              update={update}
              onSortColumn={sortColumn}
              onFilterColumn={filterColumn}
            />
          );
        })}
        {narrowing && !visible.length && <div className="empty-state">No items match this filter.</div>}
      </main>
    </div>
  );
}
