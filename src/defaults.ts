import type { Board, Column, SelectOption } from './types';

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

export const newColumn = (name: string, type: Column['type']): Column => ({
  id: uid(),
  name,
  type,
  width: type === 'url' ? 200 : type === 'text' ? 180 : 150,
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

  const g1 = { id: uid(), name: 'This week', color: GROUP_COLORS[0] };
  const g2 = { id: uid(), name: 'Next week', color: GROUP_COLORS[1] };

  const row = (groupId: string, n: string, c: string, d: string, p: string, s: string, url = '') => ({
    id: uid(),
    groupId,
    values: { name: n, client: c, dept: d, priority: p, status: s, link: url ? { url, text: '' } : undefined },
  });

  return {
    name: 'My Tasks',
    columns: [name, client, dept, priority, status, link],
    groups: [g1, g2],
    items: [
      row(g1.id, 'Launch campaign', 'Acme Co', marketing.id, medium.id, working.id, 'https://example.com/campaign'),
      row(g1.id, 'Quarterly pipeline review', 'Globex', sales.id, high.id, stuck.id),
      row(g1.id, 'Send overdue invoices', 'Initech', billing.id, high.id, done.id),
      row(g2.id, 'Roadmap workshop', 'Umbrella', product.id, high.id, '', 'https://example.com/roadmap'),
      row(g2.id, 'Fix login bug', 'Acme Co', dev.id, medium.id, working.id),
      row(g2.id, 'Feature spec', 'Hooli', product.id, medium.id, ''),
    ],
    views: [{ id: 'main', name: 'Main table', sort: [], conjunction: 'and', filters: [] }],
    activeViewId: 'main',
    draft: { sort: [], conjunction: 'and', filters: [] },
  };
}
