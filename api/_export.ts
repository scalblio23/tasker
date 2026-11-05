/**
 * Turns the stored board entities into a friendly export: one row per task keyed by column *name*,
 * with labels instead of ids (status labels, people's names, ISO dates, link URLs, file URLs).
 * Self-contained so the function doesn't pull in browser code.
 */

interface Option { id: string; label: string }
interface Column { id: string; name: string; type: string; options?: Option[]; locked?: boolean }
interface Group { id: string; name: string }
interface User { id: string; name: string }
interface Item { id: string; groupId: string; parentId?: string; pos?: number; archived?: number | null; values: Record<string, unknown> }
interface TimeEntry { id: string; itemId: string; userId: string; start: number; end: number | null }

export type ArchivedMode = 'exclude' | 'include' | 'only';

export interface ExportOptions {
  archived: ArchivedMode;
  subtasks: boolean;
}

const hours = (ms: number) => Math.round((ms / 3_600_000) * 100) / 100;
const iso = (t: number | null | undefined) => (t ? new Date(t).toISOString() : null);

export function buildExport(entities: Record<string, unknown>, opts: ExportOptions, now = Date.now()) {
  const columns = (entities.columns as Column[] | undefined) ?? [];
  const groups = (entities.groups as Group[] | undefined) ?? [];
  const users = (entities.users as User[] | undefined) ?? [];
  const name = (entities.meta as { name?: string } | undefined)?.name ?? 'Board';
  const items = Object.entries(entities)
    .filter(([k, v]) => k.startsWith('item:') && v)
    .map(([, v]) => v as Item)
    .sort((a, b) => (a.pos ?? 0) - (b.pos ?? 0));
  const entries = Object.entries(entities)
    .filter(([k, v]) => k.startsWith('time:') && v)
    .map(([, v]) => v as TimeEntry);

  const byId = new Map(items.map((i) => [i.id, i]));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const tracked = new Map<string, number>();
  for (const e of entries) tracked.set(e.itemId, (tracked.get(e.itemId) ?? 0) + Math.max(0, (e.end ?? now) - e.start));

  // Unique field names, even if two columns share a name.
  const seen = new Map<string, number>();
  const fieldName = new Map<string, string>();
  for (const c of columns) {
    const n = (seen.get(c.name) ?? 0) + 1;
    seen.set(c.name, n);
    fieldName.set(c.id, n > 1 ? `${c.name} (${n})` : c.name);
  }

  const isArchived = (i: Item) => !!i.archived || !!(i.parentId && byId.get(i.parentId)?.archived);
  const value = (c: Column, item: Item): unknown => {
    if (c.type === 'time') return hours(tracked.get(item.id) ?? 0);
    const v = item.values?.[c.id];
    if (v == null || v === '') return null;
    switch (c.type) {
      case 'select':
      case 'status':
        return c.options?.find((o) => o.id === v)?.label ?? null;
      case 'people':
        return Array.isArray(v) ? v.map((id) => userName.get(String(id))).filter(Boolean) : [];
      case 'url':
        return typeof v === 'object' && v && 'url' in v ? (v as { url: string }).url : null;
      case 'files':
        return Array.isArray(v)
          ? v.map((f) => ({ name: (f as { name: string }).name, url: (f as { url?: string }).url ?? null }))
          : [];
      default:
        return v; // text, and date as YYYY-MM-DD
    }
  };

  const tasks = items
    .filter((i) => (opts.subtasks || !i.parentId) && byId.has(i.id))
    .filter((i) => (opts.archived === 'include' ? true : opts.archived === 'only' ? isArchived(i) : !isArchived(i)))
    .map((i) => {
      const fields: Record<string, unknown> = {};
      for (const c of columns) fields[fieldName.get(c.id)!] = value(c, i);
      const parent = i.parentId ? byId.get(i.parentId) : undefined;
      return {
        id: i.id,
        task: String(i.values?.name ?? ''),
        group: groupName.get(i.groupId) ?? null,
        parentId: i.parentId ?? null,
        parentTask: parent ? String(parent.values?.name ?? '') : null,
        archived: isArchived(i),
        archivedAt: iso(i.archived ?? (parent?.archived || null)),
        fields,
      };
    });

  const timeEntries = entries
    .filter((e) => byId.has(e.itemId))
    .sort((a, b) => a.start - b.start)
    .map((e) => ({
      id: e.id,
      taskId: e.itemId,
      task: String(byId.get(e.itemId)?.values?.name ?? ''),
      person: userName.get(e.userId) ?? null,
      start: iso(e.start),
      end: iso(e.end),
      running: e.end == null,
      hours: hours(Math.max(0, (e.end ?? now) - e.start)),
    }));

  return {
    board: name,
    exportedAt: new Date(now).toISOString(),
    columns: columns.map((c) => ({ id: c.id, name: fieldName.get(c.id), type: c.type })),
    groups: groups.map((g) => ({ id: g.id, name: g.name })),
    people: users.map((u) => ({ id: u.id, name: u.name })),
    tasks,
    timeEntries,
  };
}

type Export = ReturnType<typeof buildExport>;

const csvCell = (v: unknown): string => {
  let s: string;
  if (v == null) s = '';
  else if (Array.isArray(v)) s = v.map((x) => (typeof x === 'object' && x ? ((x as { url?: string }).url ?? (x as { name?: string }).name ?? '') : String(x))).join(', ');
  else if (typeof v === 'object') s = JSON.stringify(v);
  else s = String(v);
  // Keep spreadsheets from treating cell text as a formula.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function tasksCsv(x: Export) {
  const fieldCols = x.columns.filter((c) => c.id !== 'name').map((c) => c.name!);
  const head = ['ID', 'Task', 'Group', 'Parent task', 'Archived', ...fieldCols];
  const rows = x.tasks.map((t) => [t.id, t.task, t.group, t.parentTask, t.archived ? 'yes' : '', ...fieldCols.map((f) => t.fields[f])]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function timeCsv(x: Export) {
  const head = ['ID', 'Task ID', 'Task', 'Person', 'Start', 'End', 'Hours'];
  const rows = x.timeEntries.map((e) => [e.id, e.taskId, e.task, e.person, e.start, e.end ?? 'running', e.hours]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
