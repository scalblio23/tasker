import type { Column, FilterOp, FilterRule, Item, SortRule, UrlValue, ViewQuery } from './types';

export const isOptionColumn = (col: Column) => col.type === 'select' || col.type === 'status';

export function cellText(col: Column, item: Item): string {
  const v = item.values[col.id];
  if (v == null || v === '') return '';
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

/** is / is_not on a select or status column pick an option rather than free text. */
export const opUsesOption = (col: Column, op: FilterOp) => isOptionColumn(col) && (op === 'is' || op === 'is_not');

/** Rules missing a column or value are ignored, so half-built filters don't hide everything. */
export function isActiveRule(rule: FilterRule, columns: Column[]) {
  if (!columns.some((c) => c.id === rule.columnId)) return false;
  return !opNeedsValue(rule.op) || rule.value.trim() !== '';
}

function matchRule(rule: FilterRule, col: Column, item: Item): boolean {
  const text = cellText(col, item).toLowerCase();
  const val = rule.value.trim().toLowerCase();
  if (opUsesOption(col, rule.op)) {
    const hit = item.values[col.id] === rule.value;
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

export function applyQuery(items: Item[], columns: Column[], q: ViewQuery, search: string): Item[] {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const rules = q.filters.filter((r) => isActiveRule(r, columns));
  const needle = search.trim().toLowerCase();

  let out = items.filter((item) => {
    if (needle && !columns.some((c) => cellText(c, item).toLowerCase().includes(needle))) return false;
    if (!rules.length) return true;
    const results = rules.map((r) => matchRule(r, byId.get(r.columnId)!, item));
    return q.conjunction === 'and' ? results.every(Boolean) : results.some(Boolean);
  });

  const sorts = q.sort.filter((s) => byId.has(s.columnId));
  if (sorts.length) out = [...out].sort((a, b) => compareItems(a, b, sorts, byId));
  return out;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareItems(a: Item, b: Item, sorts: SortRule[], byId: Map<string, Column>) {
  for (const s of sorts) {
    const col = byId.get(s.columnId)!;
    const ta = cellText(col, a);
    const tb = cellText(col, b);
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
