import type { Board, Column, Item, SelectOption, User } from './types';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const PALETTE = [
  '#00c875', '#9cd326', '#fdab3d', '#ffcb00', '#df2f4a', '#ff007f',
  '#ff5ac4', '#a25ddc', '#784bd1', '#5559df', '#401694', '#579bfc',
  '#0086c0', '#66ccff', '#225091', '#9aadbd', '#7f5347', '#333333',
];

export const GROUP_COLORS = ['#579bfc', '#a25ddc', '#00c875', '#fdab3d', '#df2f4a', '#225091'];

const opt = (label: string, color: string): SelectOption => ({ id: uid(), label, color });

export const defaultStatusOptions = () => [
  opt('Working on it', '#fdab3d'),
  opt('Done', '#00c875'),
  opt('Stuck', '#df2f4a'),
];

export const USER_COLORS = ['#e2445c', '#00a9ff', '#00c875', '#a25ddc', '#fdab3d', '#225091', '#ff642e', '#579bfc'];

export const defaultUsers = (): User[] =>
  ['Charles', 'Jem', 'Cody', 'Byrone'].map((name, i) => ({ id: uid(), name, color: USER_COLORS[i % USER_COLORS.length] }));

const WIDTHS: Record<Column['type'], number> = { text: 180, select: 150, status: 150, url: 200, people: 140, time: 170, files: 160, date: 130 };

export const MIN_WIDTH = 70;
export const MAX_WIDTH = 800;
/** Width a column returns to when its resize handle is double-clicked. */
export const defaultWidth = (col: Column) => (col.locked ? 300 : WIDTHS[col.type]);

export const newColumn = (name: string, type: Column['type']): Column => ({
  id: uid(),
  name,
  type,
  width: WIDTHS[type],
  options: type === 'status' ? defaultStatusOptions() : [],
});

export function sampleBoard(): Board {
  const marketing = opt('Marketing', '#579bfc');
  const sales = opt('Sales', '#225091');
  const billing = opt('Billing', '#ffcb00');
  const product = opt('Product', '#a25ddc');
  const dev = opt('Dev', '#9aadbd');
  const high = opt('High', '#401694');
  const medium = opt('Medium', '#5559df');
  const low = opt('Low', '#579bfc');
  const [working, done, stuck] = defaultStatusOptions();

  const name: Column = { id: 'name', name: 'Task', type: 'text', width: 300, options: [], locked: true };
  const client: Column = { ...newColumn('Client', 'text'), id: 'client' };
  const dept: Column = { ...newColumn('Department', 'select'), id: 'dept', options: [marketing, sales, billing, product, dev] };
  const priority: Column = { ...newColumn('Priority', 'select'), id: 'priority', options: [high, medium, low] };
  const status: Column = { ...newColumn('Status', 'status'), id: 'status', options: [working, done, stuck] };
  const link: Column = { ...newColumn('Link', 'url'), id: 'link' };
  const person: Column = { ...newColumn('Person', 'people'), id: 'person' };
  const time: Column = { ...newColumn('Time tracking', 'time'), id: 'time' };
  const files: Column = { ...newColumn('Attachments', 'files'), id: 'files' };
  const due: Column = { ...newColumn('Due date', 'date'), id: 'due' };
  const users = defaultUsers();
  const [charles, jem, cody, byrone] = users.map((u) => [u.id]);

  const g1 = { id: uid(), name: 'This week', color: GROUP_COLORS[0] };
  const g2 = { id: uid(), name: 'Next week', color: GROUP_COLORS[1] };

  const row = (groupId: string, n: string, who: string[], c: string, d: string, p: string, s: string, url = ''): Item => ({
    id: uid(),
    groupId,
    values: { name: n, person: who, client: c, dept: d, priority: p, status: s, link: url ? { url, text: '' } : undefined },
  });

  const items = [
    row(g1.id, 'Launch campaign', charles, 'Acme Co', marketing.id, medium.id, working.id, 'https://example.com/campaign'),
    row(g1.id, 'Quarterly pipeline review', jem, 'Globex', sales.id, high.id, stuck.id),
    row(g1.id, 'Send overdue invoices', cody, 'Initech', billing.id, high.id, done.id),
    row(g2.id, 'Roadmap workshop', byrone, 'Umbrella', product.id, high.id, '', 'https://example.com/roadmap'),
    row(g2.id, 'Fix login bug', cody, 'Acme Co', dev.id, medium.id, working.id),
    row(g2.id, 'Feature spec', [], 'Hooli', product.id, medium.id, ''),
  ];
  const sub = (parent: (typeof items)[number], n: string, who: string[], s: string) => ({
    ...row(parent.groupId, n, who, '', '', '', s),
    parentId: parent.id,
  });
  items[0].open = true;
  items.push(sub(items[0], 'Write ad copy', jem, done.id), sub(items[0], 'Design banners', charles, working.id));
  items.forEach((it, i) => (it.pos = i * 1024));

  return {
    version: BOARD_VERSION,
    name: 'My Tasks',
    columns: [name, person, client, dept, priority, status, due, time, link, files],
    groups: [g1, g2],
    items,
    views: [{ id: 'main', name: 'Main table', sort: [], conjunction: 'and', filters: [] }],
    activeViewId: 'main',
    draft: { sort: [], conjunction: 'and', filters: [] },
    users,
    // Empty until the person on this device says who they are, so time is never logged under the wrong name.
    currentUserId: '',
    timeEntries: [],
  };
}

export const BOARD_VERSION = 2;

/** Give new items a `pos` between their neighbours in the array, keeping existing ones stable. */
export function ensurePositions(b: Board) {
  const items = b.items;
  for (let i = 0; i < items.length; i++) {
    if (items[i].pos != null) continue;
    let prev: number | undefined;
    let next: number | undefined;
    for (let j = i - 1; j >= 0 && prev == null; j--) prev = items[j].pos;
    for (let j = i + 1; j < items.length && next == null; j++) next = items[j].pos;
    items[i].pos = prev != null && next != null ? (prev + next) / 2 : prev != null ? prev + 1024 : next != null ? next - 1024 : 0;
  }
}

/** Bring boards saved by older versions up to the current shape. */
export function migrateBoard(b: Board): Board {
  if (!b.users) {
    b.users = defaultUsers();
    const firstFree = b.columns.findIndex((c) => !c.locked);
    if (!b.columns.some((c) => c.type === 'people'))
      b.columns.splice(firstFree < 0 ? b.columns.length : firstFree, 0, newColumn('Person', 'people'));
    if (!b.columns.some((c) => c.type === 'time')) b.columns.push(newColumn('Time tracking', 'time'));
  }
  if (!b.users.some((u) => u.id === b.currentUserId)) b.currentUserId = '';
  b.timeEntries ??= [];
  // v2: attachments. Version-gated so deleting the column doesn't bring it back.
  if ((b.version ?? 1) < 2 && !b.columns.some((c) => c.type === 'files')) b.columns.push(newColumn('Attachments', 'files'));
  b.version = BOARD_VERSION;
  ensurePositions(b);
  return b;
}
