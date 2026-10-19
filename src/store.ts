import { useCallback, useEffect, useState } from 'react';
import type { Board } from './types';
import { migrateBoard, sampleBoard } from './defaults';

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
