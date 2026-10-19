export type ColumnType = 'text' | 'select' | 'status' | 'url';

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

/** text → string, select/status → option id, url → UrlValue */
export type CellValue = string | UrlValue;

export interface Item {
  id: string;
  groupId: string;
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
  /** Sort/filter currently applied — may differ from the saved active view until saved. */
  draft: ViewQuery;
}
