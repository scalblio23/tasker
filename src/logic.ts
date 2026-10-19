import type { Board, CellValue, Column, FileRef, FilterOp, FilterRule, Item, SortRule, TimeEntry, UrlValue, User, ViewQuery } from './types';
import { PALETTE, uid } from './defaults';
import { formatDuration, totalMs } from './time';

export const isOptionColumn = (col: Column) => col.type === 'select' || col.type === 'status';

/** People and files cells both hold arrays; these read them safely. */
export const peopleIds = (v: CellValue | undefined): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
export const fileRefs = (v: CellValue | undefined): FileRef[] =>
  Array.isArray(v) ? v.filter((x): x is FileRef => typeof x === 'object' && x !== null) : [];

/** Board-level data some column types need to render their value. */
export interface CellCtx {
  users: User[];
  /** Tracked ms per item id. */
  tracked: Map<string, number>;
}

export function makeCtx(users: User[], entries: TimeEntry[], now = Date.now()): CellCtx {
  const tracked = new Map<string, number>();
  for (const e of entries) tracked.set(e.itemId, (tracked.get(e.itemId) ?? 0) + totalMs([e], now));
  return { users, tracked };
}

/** The pick-list for is / is not filters and bulk set: labels, or users for people columns. */
export function choicesFor(col: Column, users: User[]): { id: string; label: string; color: string }[] {
  if (col.type === 'people') return users.map((u) => ({ id: u.id, label: u.name, color: u.color }));
  return isOptionColumn(col) ? col.options : [];
}

export function cellText(col: Column, item: Item, ctx: CellCtx): string {
  if (col.type === 'time') {
    const ms = ctx.tracked.get(item.id) ?? 0;
    return ms ? formatDuration(ms) : '';
  }
  const v = item.values[col.id];
  if (v == null || v === '') return '';
  if (col.type === 'people')
    return peopleIds(v).map((id) => ctx.users.find((u) => u.id === id)?.name).filter(Boolean).join(', ');
  if (col.type === 'files') return fileRefs(v).map((f) => f.name).join(', ');
  if (isOptionColumn(col)) return col.options.find((o) => o.id === v)?.label ?? '';
  if (col.type === 'url') {
    const u = v as UrlValue;
    return u.text || u.url || '';
  }
  return typeof v === 'string' ? v : '';
}

export const OPS: { op: FilterOp; label: string }[] = [
  { op: 'is', label: 'is' },
  { op: 'is_not', label: 'is not' },
  { op: 'contains', label: 'contains' },
  { op: 'not_contains', label: 'does not contain' },
  { op: 'is_empty', label: 'is empty' },
  { op: 'is_not_empty', label: 'is not empty' },
];

export const opNeedsValue = (op: FilterOp) => op !== 'is_empty' && op !== 'is_not_empty';

/** is / is_not on select, status and people columns pick from a list rather than free text. */
export const opUsesOption = (col: Column, op: FilterOp) =>
  (isOptionColumn(col) || col.type === 'people') && (op === 'is' || op === 'is_not');

/** Rules missing a column or value are ignored, so half-built filters don't hide everything. */
export function isActiveRule(rule: FilterRule, columns: Column[]) {
  if (!columns.some((c) => c.id === rule.columnId)) return false;
  return !opNeedsValue(rule.op) || rule.value.trim() !== '';
}

function matchRule(rule: FilterRule, col: Column, item: Item, ctx: CellCtx): boolean {
  const text = cellText(col, item, ctx).toLowerCase();
  const val = rule.value.trim().toLowerCase();
  if (opUsesOption(col, rule.op)) {
    const v = item.values[col.id];
    const hit = col.type === 'people' ? peopleIds(v).includes(rule.value) : v === rule.value;
    return rule.op === 'is' ? hit : !hit;
  }
  switch (rule.op) {
    case 'is': return text === val;
    case 'is_not': return text !== val;
    case 'contains': return text.includes(val);
    case 'not_contains': return !text.includes(val);
    case 'is_empty': return text === '';
    case 'is_not_empty': return text !== '';
  }
}

export interface QueryResult {
  /** Top-level tasks to show, sorted. */
  top: Item[];
  /** Subtasks to show per parent id, sorted. */
  children: Map<string, Item[]>;
  /** Parents shown only because a subtask matched — expanded so the match is visible. */
  forcedOpen: Set<string>;
}

/**
 * Filter + sort. A task shows when it or any of its subtasks match; a matching task shows all of
 * its subtasks, otherwise only the matching ones. Subtasks sort within their parent.
 */
export function applyQuery(items: Item[], columns: Column[], q: ViewQuery, search: string, ctx: CellCtx): QueryResult {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const rules = q.filters.filter((r) => isActiveRule(r, columns));
  const needle = search.trim().toLowerCase();

  const matches = (item: Item) => {
    if (needle && !columns.some((c) => cellText(c, item, ctx).toLowerCase().includes(needle))) return false;
    if (!rules.length) return true;
    const results = rules.map((r) => matchRule(r, byId.get(r.columnId)!, item, ctx));
    return q.conjunction === 'and' ? results.every(Boolean) : results.some(Boolean);
  };

  const sorts = q.sort.filter((s) => byId.has(s.columnId));
  const sort = (list: Item[]) => (sorts.length ? [...list].sort((a, b) => compareItems(a, b, sorts, byId, ctx)) : list);

  const ids = new Set(items.map((i) => i.id));
  const subsOf = new Map<string, Item[]>();
  for (const i of items) if (i.parentId && ids.has(i.parentId)) subsOf.set(i.parentId, [...(subsOf.get(i.parentId) ?? []), i]);

  const top: Item[] = [];
  const children = new Map<string, Item[]>();
  const forcedOpen = new Set<string>();
  for (const item of items) {
    if (item.parentId && ids.has(item.parentId)) continue;
    const subs = subsOf.get(item.id) ?? [];
    const self = matches(item);
    const shownSubs = self ? subs : subs.filter(matches);
    if (!self && !shownSubs.length) continue;
    top.push(item);
    if (subs.length) children.set(item.id, sort(shownSubs));
    if (!self) forcedOpen.add(item.id);
  }
  return { top: sort(top), children, forcedOpen };
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareItems(a: Item, b: Item, sorts: SortRule[], byId: Map<string, Column>, ctx: CellCtx) {
  for (const s of sorts) {
    const col = byId.get(s.columnId)!;
    if (col.type === 'time') {
      // Numeric on tracked time; untracked items still sink to the bottom.
      const [ma, mb] = [ctx.tracked.get(a.id) ?? 0, ctx.tracked.get(b.id) ?? 0];
      if (ma === mb) continue;
      if (!ma || !mb) return ma ? -1 : 1;
      return s.dir === 'asc' ? ma - mb : mb - ma;
    }
    const ta = cellText(col, a, ctx);
    const tb = cellText(col, b, ctx);
    // Empty cells always sink to the bottom, whichever direction.
    if (!ta && !tb) continue;
    if (!ta) return 1;
    if (!tb) return -1;
    const c = collator.compare(ta, tb);
    if (c) return s.dir === 'asc' ? c : -c;
  }
  return 0;
}

export const sameQuery = (a: ViewQuery, b: ViewQuery) =>
  JSON.stringify([a.sort, a.conjunction, a.filters]) === JSON.stringify([b.sort, b.conjunction, b.filters]);

export function normalizeUrl(url: string) {
  const u = url.trim();
  if (!u) return '';
  // Only allow safe schemes; anything else (e.g. javascript:) is treated as a bare host.
  return /^(https?:|mailto:)/i.test(u) ? u : `https://${u}`;
}

/** Text used when copying a cell — the raw URL for links so it round-trips through paste. */
export function cellCopyText(col: Column, item: Item, ctx: CellCtx): string {
  const v = item.values[col.id];
  if (col.type === 'url' && v && typeof v === 'object' && !Array.isArray(v)) return v.url;
  return cellText(col, item, ctx);
}

/**
 * Bulk edit / paste / clear skip time columns (derived from time entries) and attachments
 * (each cell owns its stored files, so they can't be copied or blanked in bulk).
 */
export const isEditable = (col: Column) => col.type !== 'time' && col.type !== 'files';

/**
 * Turn pasted / typed text into a cell value. For select & status columns the text is matched
 * against label names (case-insensitive) and a new label is added to `col` when none matches;
 * people columns match user names.
 */
export function valueFromText(col: Column, text: string, users: User[]): CellValue | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (col.type === 'people') {
    // "Jem, Cody" → matching users; unknown names are ignored.
    const names = t.toLowerCase().split(/\s*[,;]\s*/);
    const ids = users.filter((u) => names.includes(u.name.trim().toLowerCase())).map((u) => u.id);
    return ids.length ? ids : undefined;
  }
  if (isOptionColumn(col)) {
    let o = col.options.find((x) => x.label.trim().toLowerCase() === t.toLowerCase());
    if (!o) {
      o = { id: uid(), label: t, color: PALETTE[col.options.length % PALETTE.length] };
      col.options.push(o);
    }
    return o.id;
  }
  if (col.type === 'url') return { url: normalizeUrl(t), text: '' };
  return t;
}

/** Move a column next to another one. The locked Task column always stays first. */
export function moveColumn(b: Board, fromId: string, toId: string, side: 'before' | 'after') {
  if (fromId === toId) return;
  const from = b.columns.findIndex((c) => c.id === fromId);
  if (from < 0 || b.columns[from].locked) return;
  const [col] = b.columns.splice(from, 1);
  let to = b.columns.findIndex((c) => c.id === toId);
  if (to < 0) to = b.columns.length;
  else if (side === 'after') to += 1;
  const firstFree = b.columns.findIndex((c) => !c.locked);
  b.columns.splice(Math.max(to, firstFree < 0 ? b.columns.length : firstFree), 0, col);
}
