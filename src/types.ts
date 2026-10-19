export type ColumnType = 'text' | 'select' | 'status' | 'url' | 'people' | 'time';

export interface SelectOption {
  id: string;
  label: string;
  color: string;
}

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  width: number;
  /** Labels for select / status columns. */
  options: SelectOption[];
  /** The item-name column can't be deleted or retyped. */
  locked?: boolean;
}

export interface UrlValue {
  url: string;
  text: string;
}

/** text → string, select/status → option id, url → UrlValue, people → user ids. Time columns read `timeEntries`. */
export type CellValue = string | UrlValue | string[];

export interface User {
  id: string;
  name: string;
  color: string;
}

export interface TimeEntry {
  id: string;
  itemId: string;
  userId: string;
  /** epoch ms */
  start: number;
  /** epoch ms; null while the timer is running */
  end: number | null;
}

export interface Item {
  id: string;
  groupId: string;
  /** Set on subtasks: the task they belong to (same group). */
  parentId?: string;
  /** Whether a task's subtasks are expanded. */
  open?: boolean;
  values: Record<string, CellValue | undefined>;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  collapsed?: boolean;
}

export type SortDir = 'asc' | 'desc';

export interface SortRule {
  id: string;
  columnId: string;
  dir: SortDir;
}

export type FilterOp = 'is' | 'is_not' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty';

export interface FilterRule {
  id: string;
  columnId: string;
  op: FilterOp;
  /** Option id for is / is_not on select & status columns, free text otherwise. */
  value: string;
}

export interface ViewQuery {
  sort: SortRule[];
  conjunction: 'and' | 'or';
  filters: FilterRule[];
}

export interface View extends ViewQuery {
  id: string;
  name: string;
}

export interface Board {
  name: string;
  columns: Column[];
  groups: Group[];
  items: Item[];
  views: View[];
  activeViewId: string;
  users: User[];
  /** Who timers are started for on this device. */
  currentUserId: string;
  timeEntries: TimeEntry[];
  /** Sort/filter currently applied — may differ from the saved active view until saved. */
  draft: ViewQuery;
}
