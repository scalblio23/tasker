import type { Board } from '../types';
import type { Mutator } from '../store';
import { formatDuration, useNow } from '../time';
import { stopTimers } from '../timers';

/** Header indicator for the current user's running timer. */
export function TimerChip({ board, update }: { board: Board; update: Mutator }) {
  const running = board.timeEntries.find((e) => e.end == null && e.userId === board.currentUserId);
  const now = useNow(!!running);
  if (!running) return null;
  const item = board.items.find((i) => i.id === running.itemId);
  return (
    <div className="timer-chip">
      <span className="pulse" />
      <span className="timer-task" title={String(item?.values.name ?? '')}>
        {String(item?.values.name || 'Untitled task')}
      </span>
      <span className="timer-time">{formatDuration(now - running.start, true)}</span>
      <button className="timer-stop" onClick={() => update((b) => stopTimers(b, b.currentUserId))} aria-label="Stop timer">
        ■ Stop
      </button>
    </div>
  );
}
