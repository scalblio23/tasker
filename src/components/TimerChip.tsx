import type { Board } from '../types';
import type { Mutator } from '../store';
import { formatDuration, useNow } from '../time';
import { stopTimers } from '../timers';
import { Avatar } from './Avatar';

/** Header indicator for the current user's running timer. */
export function TimerChip({ board, update }: { board: Board; update: Mutator }) {
  const running = board.timeEntries.find((e) => e.end == null && e.userId === board.currentUserId);
  const now = useNow(!!running);
  if (!running) return null;
  const item = board.items.find((i) => i.id === running.itemId);
  const user = board.users.find((u) => u.id === running.userId);
  return (
    <div className="timer-chip" title={`${user?.name} is tracking time`}>
      <span className="pulse" />
      {user && <Avatar user={user} size={22} />}
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
