import { useEffect, useState } from 'react';
import type { TimeEntry } from './types';

export const entryMs = (e: TimeEntry, now: number) => Math.max(0, (e.end ?? now) - e.start);

export function totalMs(entries: TimeEntry[], now: number, pred: (e: TimeEntry) => boolean = () => true) {
  return entries.reduce((s, e) => (pred(e) ? s + entryMs(e, now) : s), 0);
}

/** 1:05:09 with seconds (live timers), otherwise 1h 05m. */
export function formatDuration(ms: number, seconds = false) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (seconds) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (!h) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export const hours = (ms: number) => (ms / 3_600_000).toFixed(2);

/** Parse "1h 30m", "1:30", "90m", "1.5" (hours) into ms; null when unreadable. */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  let m = t.match(/^(\d+):(\d{1,2})$/);
  if (m) return (+m[1] * 60 + +m[2]) * 60_000;
  m = t.match(/^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/);
  if (m && (m[1] || m[2])) return ((+(m[1] ?? 0)) * 60 + +(m[2] ?? 0)) * 60_000;
  if (/^\d+(\.\d+)?$/.test(t)) return +t * 3_600_000;
  return null;
}

/** Current time, re-rendering every second while `active`. */
export function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return active ? now : Date.now();
}
