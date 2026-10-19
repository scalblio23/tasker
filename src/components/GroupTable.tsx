import { useMemo, useState } from 'react';
import type { Board, CellValue, Column, ColumnType, Group, Item, SortDir, UrlValue } from '../types';
import type { Mutator } from '../store';
import { isOptionColumn, moveColumn } from '../logic';
import { useSelection } from '../selection';
import { GROUP_COLORS, newColumn, uid } from '../defaults';
import { ColumnHeader } from './ColumnHeader';
import { AddColumn } from './AddColumn';
import { TextCell } from './cells/TextCell';
import { OptionCell } from './cells/OptionCell';
import { UrlCell } from './cells/UrlCell';
import { PeopleCell } from './cells/PeopleCell';
import { TimeCell } from './cells/TimeCell';
import { addManualEntry, startTimer, stopTimers } from '../timers';
import { formatDuration, totalMs } from '../time';

interface Props {
  board: Board;
  group: Group;
  /** Top-level tasks to show. */
  items: Item[];
  /** Visible subtasks per task id. */
  subtasks: Map<string, Item[]>;
  isOpen: (item: Item) => boolean;
  totalInGroup: number;
  update: Mutator;
  /** Sets a cell — or every selected cell in that column when the cell is part of a multi-selection. */
  setCell: (itemId: string, colId: string, v: CellValue | undefined) => void;
  onSortColumn: (columnId: string, dir: SortDir) => void;
  onFilterColumn: (columnId: string) => void;
}

export function GroupTable(props: Props) {
  const { board, group, items, subtasks, isOpen, totalInGroup, update, onSortColumn, onFilterColumn } = props;
  const { columns } = board;
  const [newName, setNewName] = useState('');
  // Subtask counts include ones hidden by a filter, so the toggle always tells the truth.
  const subCount = useMemo(() => {
    const m = new Map<string, number>();
    board.items.forEach((i) => i.parentId && m.set(i.parentId, (m.get(i.parentId) ?? 0) + 1));
    return m;
  }, [board.items]);
  const template = `6px ${columns.map((c) => `${c.width}px`).join(' ')} 48px`;
  const style = { gridTemplateColumns: template, '--group-color': group.color } as React.CSSProperties;

  const setGroup = (patch: Partial<Group>) =>
    update((b) => Object.assign(b.groups.find((g) => g.id === group.id)!, patch));

  const addItem = () => {
    const name = newName.trim();
    if (!name) return;
    update((b) => {
      b.items.push({ id: uid(), groupId: group.id, values: { name } });
    });
    setNewName('');
  };

  const addColumn = (type: ColumnType, name: string) =>
    update((b) => {
      b.columns.push(newColumn(name, type));
    });

  const sortFor = (colId: string) => board.draft.sort.find((s) => s.columnId === colId)?.dir;

  return (
    <section className="group" style={style}>
      <header className="group-header">
        <button className="collapse-btn" onClick={() => setGroup({ collapsed: !group.collapsed })} aria-label="Toggle group">
          {group.collapsed ? '▸' : '▾'}
        </button>
        <input
          className="group-name"
          defaultValue={group.name}
          key={group.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== group.name && setGroup({ name: e.target.value.trim() })}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <span className="muted small">
          {items.length === totalInGroup ? `${totalInGroup} items` : `${items.length} of ${totalInGroup} items`}
        </span>
        <button
          className="icon-btn subtle"
          title="Change group color"
          onClick={() => setGroup({ color: GROUP_COLORS[(GROUP_COLORS.indexOf(group.color) + 1) % GROUP_COLORS.length] })}
        >
          ●
        </button>
        <button
          className="icon-btn subtle"
          title="Delete group"
          onClick={() => {
            if (totalInGroup && !confirm(`Delete "${group.name}" and its ${totalInGroup} items?`)) return;
            update((b) => {
              b.groups = b.groups.filter((g) => g.id !== group.id);
              b.items = b.items.filter((i) => i.groupId !== group.id);
            });
          }}
        >
          ✕
        </button>
      </header>

      {!group.collapsed && (
        <div className="table">
          <div className="row head" style={style}>
            <div className="edge first" />
            {columns.map((c, idx) => (
              <ColumnHeader
                key={c.id}
                column={c}
                sortDir={sortFor(c.id)}
                onSort={(dir) => onSortColumn(c.id, dir)}
                onFilter={() => onFilterColumn(c.id)}
                onMoveLeft={!c.locked && idx > 0 && !columns[idx - 1].locked ? () => update((b) => moveColumn(b, c.id, columns[idx - 1].id, 'before')) : undefined}
                onMoveRight={!c.locked && idx < columns.length - 1 ? () => update((b) => moveColumn(b, c.id, columns[idx + 1].id, 'after')) : undefined}
                onDropColumn={(fromId, side) => update((b) => moveColumn(b, fromId, c.id, side))}
                onRename={(name) => update((b) => void (b.columns.find((x) => x.id === c.id)!.name = name))}
                onDelete={() => {
                  if (!confirm(`Delete column "${c.name}"?`)) return;
                  update((b) => {
                    b.columns = b.columns.filter((x) => x.id !== c.id);
                    b.items.forEach((i) => delete i.values[c.id]);
                  });
                }}
              />
            ))}
            <AddColumn onAdd={addColumn} />
          </div>

          {items.map((item) => {
            const open = isOpen(item);
            return (
              <div key={item.id} className={open ? 'task-block open' : 'task-block'}>
                <ItemRow {...props} item={item} style={style} subCount={subCount.get(item.id) ?? 0} open={open} />
                {open && (
                  <>
                    {(subtasks.get(item.id) ?? []).map((sub) => (
                      <ItemRow {...props} key={sub.id} item={sub} style={style} subCount={0} open={false} />
                    ))}
                    <AddSubtask style={style} groupId={group.id} parentId={item.id} update={update} />
                  </>
                )}
              </div>
            );
          })}

          <div className="row add-row" style={style}>
            <div className="edge faded" />
            <div className="cell name-col">
              <input
                className="cell-input"
                placeholder="+ Add task"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={addItem}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
              />
            </div>
          </div>

          <div className="row summary" style={style}>
            <div />
            {columns.map((c) => (
              <div className="summary-cell" key={c.id}>
                {isOptionColumn(c) && <Distribution column={c} items={items} />}
                {c.type === 'time' && <GroupTime board={board} items={items} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

interface RowProps extends Props {
  item: Item;
  style: React.CSSProperties;
  subCount: number;
  open: boolean;
}

function ItemRow({ board, item, style, subCount, open, update, setCell }: RowProps) {
  const selection = useSelection();
  const isSub = !!item.parentId;
  return (
    <div className={`row ${isSub ? 'sub' : ''}`} style={style}>
      <div className="edge" />
      {board.columns.map((c) => (
        <div
          className={`cell ${c.locked ? 'name-col' : ''} type-${c.type} ${selection.isSelected(item.id, c.id) ? 'selected' : ''}`}
          key={c.id}
          data-cell
          onMouseDown={(e) => selection.onCellMouseDown(e, item.id, c.id)}
          onMouseEnter={() => selection.onCellMouseEnter(item.id, c.id)}
        >
          {c.locked && isSub && <span className="sub-elbow" aria-hidden="true" />}
          {renderCell(c, item, board, update, (v) => setCell(item.id, c.id, v))}
          {c.locked && !isSub && (
            <button
              className={`sub-toggle ${subCount ? 'has' : ''} ${open ? 'open' : ''}`}
              title={open ? 'Hide subtasks' : subCount ? `Show ${subCount} subtask${subCount === 1 ? '' : 's'}` : 'Add subtask'}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => update((b) => void (b.items.find((i) => i.id === item.id)!.open = !open))}
            >
              {subCount ? (
                <>
                  <span className="chev">{open ? '▾' : '▸'}</span> {subCount}
                </>
              ) : (
                '+ Sub'
              )}
            </button>
          )}
          {c.locked && (
            <button
              className="row-delete"
              title={subCount ? `Delete task and its ${subCount} subtask${subCount === 1 ? '' : 's'}` : isSub ? 'Delete subtask' : 'Delete task'}
              onClick={() =>
                update((b) => void (b.items = b.items.filter((i) => i.id !== item.id && i.parentId !== item.id)))
              }
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <div className="cell filler" />
    </div>
  );
}

function AddSubtask({ style, groupId, parentId, update }: { style: React.CSSProperties; groupId: string; parentId: string; update: Mutator }) {
  const [name, setName] = useState('');
  const add = () => {
    const n = name.trim();
    if (!n) return;
    update((b) => void b.items.push({ id: uid(), groupId, parentId, values: { name: n } }));
    setName('');
  };
  return (
    <div className="row add-row sub" style={style}>
      <div className="edge faded" />
      <div className="cell name-col">
        <span className="sub-elbow" aria-hidden="true" />
        <input
          className="cell-input"
          placeholder="+ Add subtask"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
      </div>
    </div>
  );
}

function renderCell(c: Column, item: Item, board: Board, update: Mutator, onChange: (v: CellValue | undefined) => void) {
  const v = item.values[c.id];
  switch (c.type) {
    case 'select':
    case 'status':
      return (
        <OptionCell
          column={c}
          value={(v as string) ?? ''}
          onChange={onChange}
          onOptionsChange={(opts) => update((b) => void (b.columns.find((x) => x.id === c.id)!.options = opts))}
        />
      );
    case 'url':
      return <UrlCell value={v as UrlValue | undefined} onChange={onChange} />;
    case 'people':
      return <PeopleCell users={board.users} value={Array.isArray(v) ? v : []} onChange={onChange} />;
    case 'time': {
      const me = board.currentUserId;
      return (
        <TimeCell
          entries={board.timeEntries.filter((e) => e.itemId === item.id)}
          users={board.users}
          currentUserId={me}
          onStart={(userId) => update((b) => startTimer(b, item.id, userId))}
          onStop={() => update((b) => stopTimers(b, me, Date.now(), item.id))}
          onSetCurrentUser={(userId) => update((b) => void (b.currentUserId = userId))}
          onAdd={(ms, userId) => update((b) => addManualEntry(b, item.id, userId, ms))}
          onReassign={(id, userId) => update((b) => void (b.timeEntries.find((e) => e.id === id)!.userId = userId))}
          onDelete={(id) => update((b) => void (b.timeEntries = b.timeEntries.filter((e) => e.id !== id)))}
        />
      );
    }
    default:
      return <TextCell value={(v as string) ?? ''} onChange={onChange} className={c.locked ? 'name' : 'center'} />;
  }
}

/** Monday-style battery bar showing how a group's items split across labels. */
function Distribution({ column, items }: { column: Column; items: Item[] }) {
  const counts = column.options
    .map((o) => ({ o, n: items.filter((i) => i.values[column.id] === o.id).length }))
    .filter((x) => x.n);
  const empty = items.length - counts.reduce((s, x) => s + x.n, 0);
  if (!items.length) return null;
  return (
    <div className="dist">
      {counts.map(({ o, n }) => (
        <span key={o.id} style={{ flex: n, background: o.color }} title={`${o.label}: ${n}`} />
      ))}
      {empty > 0 && <span style={{ flex: empty }} className="dist-empty" title={`Empty: ${empty}`} />}
    </div>
  );
}

/** Total time tracked on a group's (visible) tasks, including their subtasks. */
function GroupTime({ board, items }: { board: Board; items: Item[] }) {
  const ids = new Set(items.map((i) => i.id));
  board.items.forEach((i) => i.parentId && ids.has(i.parentId) && ids.add(i.id));
  const ms = totalMs(board.timeEntries, Date.now(), (e) => ids.has(e.itemId));
  return ms ? <div className="group-time">{formatDuration(ms)}</div> : null;
}
