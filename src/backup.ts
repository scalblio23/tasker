import type { Board, CellValue, Column, Item } from './types';
import { fileRefs, isOptionColumn, peopleIds } from './logic';
import { PALETTE } from './defaults';

/**
 * Local safety copies of the board. Written before anything replaces this browser's board
 * (e.g. joining a shared board) and never silently overwritten: the oldest copy is kept for good,
 * plus the most recent ones.
 */
const KEY = 'tasker.backups';
/** Written by an earlier version; read-only now. */
const LEGACY_KEY = 'tasker.board.local-backup';
const MAX = 8;

export interface Backup {
  id: string;
  at: number;
  reason: string;
  board: Board;
}

const fingerprint = (b: Board) => JSON.stringify([b.items.map((i) => [i.id, i.values]), b.columns.map((c) => c.id)]);
export const taskCount = (b: Board) => b.items.filter((i) => !i.parentId).length;

function read(): Backup[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Backup[];
  } catch {
    return [];
  }
}

export function saveBackup(board: Board, reason: string) {
  if (!board.items.length) return;
  const all = read();
  const fp = fingerprint(board);
  if (all.some((b) => fingerprint(b.board) === fp)) return;
  all.push({ id: String(Date.now()), at: Date.now(), reason, board });
  // Keep the first backup forever; rotate the rest.
  while (all.length > MAX) all.splice(1, 1);
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* quota — nothing more we can do */
  }
}

export function listBackups(): Backup[] {
  const all = read();
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const board = JSON.parse(raw) as Board;
      if (board.items?.length && !all.some((b) => fingerprint(b.board) === fingerprint(board)))
        all.unshift({ id: 'legacy', at: 0, reason: 'Saved when this browser first joined the shared board', board });
    }
  } catch {
    /* ignore */
  }
  return all.sort((a, b) => b.at - a.at);
}

export interface MergeResult {
  tasks: number;
  subtasks: number;
  columns: number;
  timeEntries: number;
}

/**
 * Add everything from `source` that `target` doesn't have (matched by id) without removing or
 * overwriting anything. Users are matched by name and dropdown labels by text, since every
 * browser created its own ids for those.
 */
export function mergeBoards(target: Board, source: Board, onlyItems?: Set<string>): MergeResult {
  const result: MergeResult = { tasks: 0, subtasks: 0, columns: 0, timeEntries: 0 };

  // Users: same name → same person.
  const userMap = new Map<string, string>();
  for (const u of source.users ?? []) {
    const match = target.users.find((t) => t.id === u.id || t.name.trim().toLowerCase() === u.name.trim().toLowerCase());
    if (match) userMap.set(u.id, match.id);
    else {
      target.users.push({ ...u });
      userMap.set(u.id, u.id);
    }
  }

  // Columns: add missing ones; for dropdowns, map labels by text and add unknown labels.
  const optionMap = new Map<string, Map<string, string>>();
  for (const col of source.columns) {
    let t = target.columns.find((c) => c.id === col.id);
    if (!t) {
      t = structuredClone(col) as Column;
      t.options = [];
      target.columns.push(t);
      result.columns++;
    }
    if (isOptionColumn(col)) {
      const m = new Map<string, string>();
      for (const o of col.options) {
        let to = t.options.find((x) => x.id === o.id || x.label.trim().toLowerCase() === o.label.trim().toLowerCase());
        if (!to) {
          to = { ...o, color: o.color || PALETTE[t.options.length % PALETTE.length] };
          t.options.push(to);
        }
        m.set(o.id, to.id);
      }
      optionMap.set(col.id, m);
    }
  }

  for (const g of source.groups) if (!target.groups.some((x) => x.id === g.id)) target.groups.push({ ...g });
  for (const v of source.views ?? []) if (!target.views.some((x) => x.id === v.id)) target.views.push(structuredClone(v));

  const have = new Set(target.items.map((i) => i.id));
  const colById = new Map(target.columns.map((c) => [c.id, c]));
  const remap = (colId: string, v: CellValue | undefined): CellValue | undefined => {
    const col = colById.get(colId);
    if (v == null || !col) return v;
    if (col.type === 'people') {
      const ids = peopleIds(v).map((id) => userMap.get(id) ?? id);
      return ids.length ? ids : undefined;
    }
    if (isOptionColumn(col) && typeof v === 'string') return optionMap.get(colId)?.get(v) ?? v;
    if (col.type === 'files') return fileRefs(v);
    return v;
  };

  for (const item of source.items) {
    if (have.has(item.id) || (onlyItems && !onlyItems.has(item.id))) continue;
    // Subtasks need their parent; skip orphans whose parent is neither here nor being added.
    if (item.parentId && !have.has(item.parentId) && !source.items.some((p) => p.id === item.parentId)) continue;
    const copy: Item = { ...structuredClone(item), values: {} };
    for (const [k, v] of Object.entries(item.values)) copy.values[k] = remap(k, v);
    if (!target.groups.some((g) => g.id === copy.groupId) && target.groups[0]) copy.groupId = target.groups[0].id;
    target.items.push(copy);
    have.add(copy.id);
    if (copy.parentId) result.subtasks++;
    else result.tasks++;
  }

  const haveTime = new Set(target.timeEntries.map((e) => e.id));
  for (const e of source.timeEntries ?? []) {
    if (haveTime.has(e.id) || !have.has(e.itemId)) continue;
    target.timeEntries.push({ ...e, userId: userMap.get(e.userId) ?? e.userId });
    result.timeEntries++;
  }
  target.items.sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  return result;
}

export const describeMerge = (r: MergeResult) =>
  [
    `${r.tasks} task${r.tasks === 1 ? '' : 's'}`,
    r.subtasks && `${r.subtasks} subtask${r.subtasks === 1 ? '' : 's'}`,
    r.columns && `${r.columns} column${r.columns === 1 ? '' : 's'}`,
    r.timeEntries && `${r.timeEntries} time entr${r.timeEntries === 1 ? 'y' : 'ies'}`,
  ]
    .filter(Boolean)
    .join(', ');
