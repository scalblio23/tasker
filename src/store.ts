import { useCallback, useEffect, useRef, useState } from 'react';
import type { Board } from './types';
import { migrateBoard, sampleBoard } from './defaults';
import { collectGarbage } from './files';
import { fileRefs } from './logic';

const KEY = 'tasker.board.v1';

function load(): Board {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrateBoard(JSON.parse(raw) as Board);
  } catch {
    /* storage unavailable or corrupt — fall back to sample data */
  }
  return sampleBoard();
}

export type Mutator = (fn: (draft: Board) => void) => void;

/** Board state persisted to localStorage. `update` hands you a mutable copy. */
export function useBoard() {
  const [board, setBoard] = useState<Board>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(board));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [board]);

  // Once per load, drop stored attachment files that no cell references any more.
  const boardRef = useRef(board);
  boardRef.current = board;
  useEffect(() => {
    const b = boardRef.current;
    const cols = b.columns.filter((c) => c.type === 'files');
    collectGarbage(new Set(b.items.flatMap((i) => cols.flatMap((c) => fileRefs(i.values[c.id]).map((f) => f.id)))));
  }, []);

  const update: Mutator = useCallback((fn) => {
    setBoard((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => setBoard(sampleBoard()), []);

  return { board, update, reset };
}
