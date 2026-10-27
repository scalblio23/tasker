import type { Board, Item } from './types';

/** Archived, or under an archived task. */
export function archivedIds(items: Item[]): Set<string> {
  const direct = new Set(items.filter((i) => i.archived).map((i) => i.id));
  const out = new Set(direct);
  for (const i of items) if (i.parentId && direct.has(i.parentId)) out.add(i.id);
  return out;
}

export const activeItems = (items: Item[]) => {
  const gone = archivedIds(items);
  return items.filter((i) => !gone.has(i.id));
};

/** What the Archive tab lists: archived tasks, plus archived subtasks whose task is still on the board. */
export function archivedEntries(b: Board): Item[] {
  const byId = new Map(b.items.map((i) => [i.id, i]));
  return b.items
    .filter((i) => i.archived && !(i.parentId && byId.get(i.parentId)?.archived))
    .sort((a, c) => (c.archived ?? 0) - (a.archived ?? 0));
}

export function archiveItems(b: Board, ids: Iterable<string>, now = Date.now()) {
  const set = new Set(ids);
  for (const i of b.items) if (set.has(i.id)) i.archived = now;
}

export function restoreItems(b: Board, ids: Iterable<string>) {
  const set = new Set(ids);
  for (const i of b.items) {
    if (!set.has(i.id)) continue;
    i.archived = null;
    // A restored subtask needs its task back on the board too.
    const parent = i.parentId ? b.items.find((p) => p.id === i.parentId) : undefined;
    if (parent?.archived) parent.archived = null;
    // Its group may have been deleted meanwhile.
    if (!b.groups.some((g) => g.id === i.groupId) && b.groups[0]) i.groupId = b.groups[0].id;
  }
}

/** Delete tasks for good, with their subtasks. */
export function deleteItems(b: Board, ids: Iterable<string>) {
  const set = new Set(ids);
  b.items = b.items.filter((i) => !set.has(i.id) && !(i.parentId && set.has(i.parentId)));
}
