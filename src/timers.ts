import type { Board } from './types';
import { uid } from './defaults';

/** Start a timer for `userId` on an item, stopping any timer that user already has running. */
export function startTimer(b: Board, itemId: string, userId: string, now = Date.now()) {
  stopTimers(b, userId, now);
  b.timeEntries.push({ id: uid(), itemId, userId, start: now, end: null });
}

/** Stop the user's running timers (optionally only the one on `itemId`). */
export function stopTimers(b: Board, userId: string, now = Date.now(), itemId?: string) {
  for (const e of b.timeEntries)
    if (e.end == null && e.userId === userId && (!itemId || e.itemId === itemId)) e.end = now;
}

export function addManualEntry(b: Board, itemId: string, userId: string, ms: number, now = Date.now()) {
  b.timeEntries.push({ id: uid(), itemId, userId, start: now - ms, end: now });
}
