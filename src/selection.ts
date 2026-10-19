import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

export interface CellRef {
  itemId: string;
  colId: string;
}

const key = (itemId: string, colId: string) => `${itemId}|${colId}`;
const parse = (k: string): CellRef => {
  const [itemId, colId] = k.split('|');
  return { itemId, colId };
};

/**
 * Spreadsheet-style multi-cell selection over the visible grid.
 * - drag across cells, or Shift+click, selects a rectangle
 * - Cmd/Ctrl+click toggles single cells
 * - a plain click selects just that cell; clicking outside the board or Escape clears it
 */
export function useCellSelection(rowIds: string[], colIds: string[]) {
  const [keys, setKeys] = useState<Set<string>>(() => new Set());
  const anchor = useRef<CellRef | null>(null);
  const dragging = useRef(false);

  const rowIndex = useMemo(() => new Map(rowIds.map((id, i) => [id, i])), [rowIds]);
  const colIndex = useMemo(() => new Map(colIds.map((id, i) => [id, i])), [colIds]);

  const rect = useCallback(
    (a: CellRef, b: CellRef) => {
      const out = new Set<string>();
      const [r1, r2] = [rowIndex.get(a.itemId), rowIndex.get(b.itemId)];
      const [c1, c2] = [colIndex.get(a.colId), colIndex.get(b.colId)];
      if (r1 == null || r2 == null || c1 == null || c2 == null) return out;
      for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
        for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) out.add(key(rowIds[r], colIds[c]));
      return out;
    },
    [rowIndex, colIndex, rowIds, colIds],
  );

  const clear = useCallback(() => setKeys((k) => (k.size ? new Set() : k)), []);

  const onCellMouseDown = useCallback(
    (e: ReactMouseEvent, itemId: string, colId: string) => {
      if (e.button !== 0) return;
      const cell = { itemId, colId };
      const k = key(itemId, colId);
      if (e.shiftKey && anchor.current) {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
        setKeys(rect(anchor.current, cell));
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
        anchor.current = cell;
        setKeys((prev) => {
          const next = new Set(prev);
          if (next.has(k)) next.delete(k);
          else next.add(k);
          return next;
        });
        return;
      }
      anchor.current = cell;
      dragging.current = true;
      // Clicking inside the current selection keeps it, so editing that cell edits them all.
      setKeys((prev) => (prev.has(k) ? prev : new Set([k])));
    },
    [rect],
  );

  const onCellMouseEnter = useCallback(
    (itemId: string, colId: string) => {
      if (!dragging.current || !anchor.current) return;
      const a = anchor.current;
      if (a.itemId === itemId && a.colId === colId) return;
      (document.activeElement as HTMLElement | null)?.blur();
      window.getSelection()?.removeAllRanges();
      setKeys(rect(a, { itemId, colId }));
    },
    [rect],
  );

  useEffect(() => {
    const up = () => (dragging.current = false);
    const down = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-cell], .bulk-bar, .popover')) clear();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.popover')) clear();
    };
    document.addEventListener('mouseup', up);
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mouseup', up);
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', esc);
    };
  }, [clear]);

  // Only cells that are still visible count (rows can be filtered away, columns deleted).
  const cells = useMemo(
    () => [...keys].map(parse).filter((c) => rowIndex.has(c.itemId) && colIndex.has(c.colId)),
    [keys, rowIndex, colIndex],
  );
  const live = useMemo(() => new Set(cells.map((c) => key(c.itemId, c.colId))), [cells]);
  const isSelected = useCallback((itemId: string, colId: string) => live.has(key(itemId, colId)), [live]);

  /** Cells in grid order, grouped into a row-major rectangle for copy/paste. */
  const bounds = useMemo(() => {
    if (!cells.length) return null;
    const rs = cells.map((c) => rowIndex.get(c.itemId)!);
    const cs = cells.map((c) => colIndex.get(c.colId)!);
    return { r1: Math.min(...rs), r2: Math.max(...rs), c1: Math.min(...cs), c2: Math.max(...cs) };
  }, [cells, rowIndex, colIndex]);

  return { cells, isSelected, bounds, clear, onCellMouseDown, onCellMouseEnter, rowIds, colIds };
}

export type CellSelection = ReturnType<typeof useCellSelection>;

export const SelectionContext = createContext<CellSelection | null>(null);
export const useSelection = () => useContext(SelectionContext)!;
