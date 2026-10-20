import type { Board, Item, TimeEntry } from './types';

/**
 * The board is synced as separate entities so concurrent edits to different things don't clash:
 *   meta, columns, groups, views, users  — whole values
 *   item:<id>                            — one task/subtask; edits are sent as field-level patches
 *   time:<id>                            — one time entry
 * Per-device state (tracking-as user, unsaved sort/filter, active view, expanded subtasks) never syncs.
 */
export type ItemPatch = { fields?: Partial<Record<'groupId' | 'parentId' | 'pos', unknown>>; values?: Record<string, unknown> };
export type Change = { key: string; data: unknown } | { key: string; patch: ItemPatch };

const ARRAYS = ['columns', 'groups', 'views', 'users'] as const;
const ITEM_FIELDS = ['groupId', 'parentId', 'pos'] as const;
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Shared part of an item (drops per-device `open`). */
const sharedItem = ({ open: _open, ...rest }: Item) => rest;

function itemPatch(a: Item, b: Item): ItemPatch | null {
  const patch: ItemPatch = {};
  for (const f of ITEM_FIELDS) if (!same(a[f], b[f])) (patch.fields ??= {})[f] = b[f] ?? null;
  for (const k of new Set([...Object.keys(a.values), ...Object.keys(b.values)]))
    if (!same(a.values[k], b.values[k])) (patch.values ??= {})[k] = b.values[k] ?? null;
  return patch.fields || patch.values ? patch : null;
}

export function diffBoard(a: Board, b: Board): Change[] {
  const out: Change[] = [];
  if (a.name !== b.name) out.push({ key: 'meta', data: { name: b.name } });
  for (const k of ARRAYS) if (!same(a[k], b[k])) out.push({ key: k, data: b[k] });

  const prevItems = new Map(a.items.map((i) => [i.id, i]));
  for (const item of b.items) {
    const prev = prevItems.get(item.id);
    prevItems.delete(item.id);
    if (!prev) out.push({ key: `item:${item.id}`, data: sharedItem(item) });
    else {
      const patch = itemPatch(prev, item);
      if (patch) out.push({ key: `item:${item.id}`, patch });
    }
  }
  for (const id of prevItems.keys()) out.push({ key: `item:${id}`, data: null });

  const prevTime = new Map(a.timeEntries.map((e) => [e.id, e]));
  for (const e of b.timeEntries) {
    const prev = prevTime.get(e.id);
    prevTime.delete(e.id);
    if (!prev || !same(prev, e)) out.push({ key: `time:${e.id}`, data: e });
  }
  for (const id of prevTime.keys()) out.push({ key: `time:${id}`, data: null });
  return out;
}

/** Every entity of a board — used to seed an empty shared board. */
export const boardToChanges = (b: Board): Change[] => [
  { key: 'meta', data: { name: b.name } },
  ...ARRAYS.map((k) => ({ key: k, data: b[k] })),
  ...b.items.map((i) => ({ key: `item:${i.id}`, data: sharedItem(i) })),
  ...b.timeEntries.map((e) => ({ key: `time:${e.id}`, data: e })),
];

/** Fold a newer change for the same key into a queued one. */
export function mergeChange(older: Change | undefined, newer: Change): Change {
  if (!older || !('patch' in newer)) return newer;
  if ('patch' in older) {
    return {
      key: newer.key,
      patch: {
        fields: older.patch.fields || newer.patch.fields ? { ...older.patch.fields, ...newer.patch.fields } : undefined,
        values: older.patch.values || newer.patch.values ? { ...older.patch.values, ...newer.patch.values } : undefined,
      },
    };
  }
  if (older.data == null) return older; // deleted locally; a later patch can't apply
  const item = structuredClone(older.data) as Item;
  Object.assign(item, newer.patch.fields);
  for (const [k, v] of Object.entries(newer.patch.values ?? {})) {
    if (v == null) delete item.values[k];
    else item.values[k] = v as Item['values'][string];
  }
  return { key: newer.key, data: item };
}

const byPos = (a: Item, b: Item) => (a.pos ?? 0) - (b.pos ?? 0);

/** Apply server entities to the board, skipping keys this device still has unsent changes for. */
export function applyRemote(board: Board, changes: { key: string; data: unknown }[], skip: Set<string>): Board {
  const next = structuredClone(board);
  const items = new Map(next.items.map((i) => [i.id, i]));
  const time = new Map(next.timeEntries.map((e) => [e.id, e]));
  let itemsChanged = false;

  for (const { key, data } of changes) {
    if (skip.has(key)) continue;
    if (key === 'meta') {
      if (data) next.name = (data as { name: string }).name;
    } else if ((ARRAYS as readonly string[]).includes(key)) {
      if (Array.isArray(data)) (next as unknown as Record<string, unknown>)[key] = data;
    } else if (key.startsWith('item:')) {
      const id = key.slice(5);
      itemsChanged = true;
      if (data == null) items.delete(id);
      else items.set(id, { ...(data as Item), open: items.get(id)?.open });
    } else if (key.startsWith('time:')) {
      const id = key.slice(5);
      if (data == null) time.delete(id);
      else time.set(id, data as TimeEntry);
    }
  }
  if (itemsChanged) next.items = [...items.values()].sort(byPos);
  next.timeEntries = [...time.values()];

  // Per-device pointers may reference something another person just removed.
  if (!next.users.some((u) => u.id === next.currentUserId)) next.currentUserId = '';
  if (!next.views.some((v) => v.id === next.activeViewId) && next.views[0]) {
    next.activeViewId = next.views[0].id;
    const v = next.views[0];
    next.draft = { sort: v.sort, conjunction: v.conjunction, filters: v.filters };
  }
  return next;
}

/** Build the board from a full server snapshot, keeping this device's local-only state. */
export function boardFromSnapshot(local: Board, entities: Record<string, unknown>): Board {
  const base: Board = { ...local, items: [], timeEntries: [] };
  const openIds = new Set(local.items.filter((i) => i.open).map((i) => i.id));
  const b = applyRemote(base, Object.entries(entities).map(([key, data]) => ({ key, data })), new Set());
  b.items.forEach((i) => (i.open = openIds.has(i.id) || undefined));
  // Start from the saved sort/filter of the active shared view.
  const view = b.views.find((v) => v.id === b.activeViewId) ?? b.views[0];
  if (view) {
    b.activeViewId = view.id;
    b.draft = { sort: view.sort, conjunction: view.conjunction, filters: view.filters };
  }
  return b;
}
