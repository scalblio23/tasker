import { useCallback, useEffect, useRef, useState } from 'react';
import type { Board } from './types';
import { ensurePositions, migrateBoard, sampleBoard } from './defaults';
import { collectGarbage, uploadLocalFiles } from './files';
import { fileRefs } from './logic';
import { PASSCODE_KEY, syncConfig } from './syncConfig';
import { mergeBoards, saveBackup } from './backup';
import { applyRemote, boardFromSnapshot, boardToChanges, diffBoard, mergeChange, type Change } from './sync';

const KEY = 'tasker.board.v1';
const JOIN_ASKED_KEY = 'tasker.join-merge-asked';
const POLL_MS = 3000;
/** Slower polling while nobody is using the tab, to keep shared-storage requests (and cost) down. */
const IDLE_POLL_MS = 15000;
const IDLE_AFTER_MS = 60000;
const FLUSH_MS = 400;

function load(): Board {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrateBoard(JSON.parse(raw) as Board);
  } catch {
    /* storage unavailable or corrupt — fall back to sample data */
  }
  return sampleBoard();
}

/**
 * local      — no shared storage configured (or no /api): this browser only
 * connecting — first contact with the server
 * synced / saving — shared board, changes up to date / being sent
 * offline    — shared board but the server can't be reached; edits are kept and retried
 * passcode   — the server wants the team passcode
 * error      — the server is there but failing (e.g. storage misconfigured); see `error`
 */
export type SyncStatus = 'local' | 'connecting' | 'synced' | 'saving' | 'offline' | 'passcode' | 'error';

export type Mutator = (fn: (draft: Board) => void) => void;

/**
 * Board state. Edits apply locally at once (and are cached in localStorage); when the shared
 * backend is configured they're also sent as entity-level changes and other people's changes
 * are polled in every few seconds.
 */
export function useBoard() {
  const [board, setBoard] = useState<Board>(load);
  const [status, setStatus] = useState<SyncStatus>('connecting');
  const [error, setError] = useState('');
  const boardRef = useRef(board);
  const s = useRef({
    shared: false,
    rev: 0,
    queue: new Map<string, Change>(),
    inflight: new Set<string>(),
    flushTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    flushing: false,
    polls: 0,
    connecting: false,
  });

  const commit = (next: Board) => {
    boardRef.current = next;
    setBoard(next);
  };

  // Local cache: survives reloads, and is the whole store in local mode.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(board));
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [board]);

  const headers = () => ({ 'content-type': 'application/json', 'x-tasker-passcode': syncConfig.passcode });

  const flush = useCallback(async () => {
    const st = s.current;
    clearTimeout(st.flushTimer);
    if (st.flushing || !st.queue.size) return;
    st.flushing = true;
    const batch = [...st.queue.values()];
    st.queue.clear();
    batch.forEach((c) => st.inflight.add(c.key));
    setStatus('saving');
    let failed = false;
    try {
      const res = await fetch('/api/sync', { method: 'POST', headers: headers(), body: JSON.stringify({ changes: batch }) });
      if (res.status === 401) throw new Error('passcode');
      if (!res.ok) throw new Error(String(res.status));
      // st.rev is deliberately not advanced here: the next poll then fetches the server's merged copy
      // of what we just sent, which also carries anyone else's concurrent edits to the same task.
      setStatus(st.queue.size ? 'saving' : 'synced');
    } catch (e) {
      // Put the batch back underneath anything edited since; it's retried below.
      failed = true;
      for (const c of batch) st.queue.set(c.key, st.queue.has(c.key) ? mergeChange(c, st.queue.get(c.key)!) : c);
      setStatus(e instanceof Error && e.message === 'passcode' ? 'passcode' : 'offline');
    } finally {
      batch.forEach((c) => st.inflight.delete(c.key));
      st.flushing = false;
      clearTimeout(st.flushTimer);
      if (st.queue.size) st.flushTimer = setTimeout(flush, failed ? 5000 : FLUSH_MS);
    }
  }, []);

  const enqueue = useCallback(
    (changes: Change[]) => {
      const st = s.current;
      for (const c of changes) st.queue.set(c.key, mergeChange(st.queue.get(c.key), c));
      clearTimeout(st.flushTimer);
      st.flushTimer = setTimeout(flush, FLUSH_MS);
    },
    [flush],
  );

  const update: Mutator = useCallback(
    (fn) => {
      const prev = boardRef.current;
      const next = structuredClone(prev);
      fn(next);
      ensurePositions(next);
      commit(next);
      if (s.current.shared) {
        const changes = diffBoard(prev, next);
        if (changes.length) enqueue(changes);
      }
    },
    [enqueue],
  );

  const poll = useCallback(async () => {
    const st = s.current;
    if (!st.shared) return;
    try {
      // Re-read a few revisions back: concurrent writers can land slightly out of order. Every 10th poll
      // also skips the "nothing new" shortcut, catching a write that landed after its revision was handed out.
      const known = ++st.polls % 10 === 0 ? 0 : st.rev;
      const res = await fetch(`/api/sync?since=${Math.max(0, st.rev - 5)}&known=${known}`, { headers: headers() });
      if (res.status === 401) return setStatus('passcode');
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const skip = new Set([...st.queue.keys(), ...st.inflight]);
      const changes: { key: string; data: unknown }[] = data.changes ?? [];
      if (changes.length) commit(applyRemote(boardRef.current, changes, skip));
      // If we had to skip something we're still sending, stay put so it's fetched again next time.
      if (!changes.some((c) => skip.has(c.key))) st.rev = Math.max(st.rev, data.rev);
      if (!st.queue.size && !st.flushing) setStatus('synced');
    } catch {
      setStatus('offline');
    }
  }, []);

  const connect = useCallback(async () => {
    const st = s.current;
    if (st.connecting) return;
    st.connecting = true;
    try {
      await connectOnce();
    } finally {
      st.connecting = false;
    }
  }, []);

  const connectOnce = async () => {
    const st = s.current;
    setStatus('connecting');
    let data: { configured?: boolean; files?: false | 'token' | 'presigned'; rev: number; entities: Record<string, unknown>; error?: string };
    let res: Response;
    try {
      res = await fetch('/api/sync?full=1', { headers: headers() });
    } catch {
      return setStatus('local'); // no server at all
    }
    if (res.status === 401) return setStatus('passcode');
    if (!res.headers.get('content-type')?.includes('json')) return setStatus('local'); // no /api deployed (e.g. vite preview)
    try {
      data = await res.json();
    } catch {
      return setStatus('local');
    }
    if (!res.ok || data.error) {
      // The API exists but is failing — say so rather than silently going local.
      setError(data.error ?? `Server error ${res.status}`);
      return setStatus('error');
    }
    if (!data.configured) return setStatus('local');

    const seeding = !data.entities.columns;
    if (seeding) {
      const n = boardRef.current.items.filter((i) => !i.parentId).length;
      const ok = confirm(
        `The shared board hasn't been set up yet.\n\nShare the board in this browser (${n} tasks) with everyone?\n\n` +
          'Choose Cancel if someone else has the real board — they should open the app first.',
      );
      if (!ok) return setStatus('local');
    }

    st.shared = syncConfig.shared = true;
    syncConfig.files = data.files ?? false;
    st.rev = data.rev;

    if (!seeding) {
      // Join the existing shared board. First keep a copy of what this browser had (never overwritten).
      const local = boardRef.current;
      saveBackup(local, 'Before loading the shared board');
      const shared = boardFromSnapshot(local, data.entities);
      commit(shared);

      // Tasks only this browser has would otherwise vanish from view — offer to add them (once).
      const sharedIds = new Set(shared.items.map((i) => i.id));
      const localOnly = local.items.filter((i) => !sharedIds.has(i.id) && !i.parentId);
      let asked = false;
      try {
        asked = localStorage.getItem(JOIN_ASKED_KEY) === '1';
      } catch {
        /* ignore */
      }
      if (localOnly.length && !asked) {
        const examples = localOnly.slice(0, 3).map((i) => `“${String(i.values.name || 'Untitled')}”`).join(', ');
        const ok = confirm(
          `This browser has ${localOnly.length} task${localOnly.length === 1 ? '' : 's'} that aren't on the shared board ` +
            `(${examples}${localOnly.length > 3 ? ', …' : ''}).\n\nAdd them to the shared board so everyone can see them?\n\n` +
            `(Either way a copy is kept — board menu ⋯ → Restore.)`,
        );
        try {
          localStorage.setItem(JOIN_ASKED_KEY, '1');
        } catch {
          /* ignore */
        }
        if (ok) {
          const source = syncConfig.files ? await uploadLocalFiles(local) : local;
          update((b) => void mergeBoards(b, source));
        }
      }
    } else {
      // First device to connect: this browser's board becomes the shared one.
      let seed = boardRef.current;
      saveBackup(seed, 'Before sharing this board');
      if (syncConfig.files) seed = await uploadLocalFiles(seed);
      commit(seed);
      enqueue(boardToChanges(seed));
      await flush();
    }
    setStatus(st.queue.size ? 'saving' : 'synced');
  };

  useEffect(() => {
    connect();
    let lastActive = Date.now();
    let lastPoll = 0;
    const active = () => (lastActive = Date.now());
    const events = ['pointerdown', 'keydown', 'mousemove', 'wheel'] as const;
    events.forEach((e) => window.addEventListener(e, active, { passive: true }));
    const t = setInterval(() => {
      const idle = document.visibilityState !== 'visible' || Date.now() - lastActive > IDLE_AFTER_MS;
      if (Date.now() - lastPoll < (idle ? IDLE_POLL_MS : POLL_MS)) return;
      lastPoll = Date.now();
      poll();
    }, 1000);
    const onFocus = () => poll();
    window.addEventListener('focus', onFocus);
    // Try to send pending edits if the tab is closed mid-debounce.
    const onHide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(t);
      events.forEach((e) => window.removeEventListener(e, active));
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [connect, poll, flush]);

  // Once per load, drop locally stored attachment files that no cell references any more.
  useEffect(() => {
    const b = boardRef.current;
    const cols = b.columns.filter((c) => c.type === 'files');
    collectGarbage(new Set(b.items.flatMap((i) => cols.flatMap((c) => fileRefs(i.values[c.id]).map((f) => f.id)))));
  }, []);

  const reset = useCallback(() => commit(sampleBoard()), []);

  const submitPasscode = useCallback(
    (code: string) => {
      syncConfig.passcode = code;
      try {
        localStorage.setItem(PASSCODE_KEY, code);
      } catch {
        /* ignore */
      }
      connect();
    },
    [connect],
  );

  return { board, update, reset, status, error, submitPasscode };
}
