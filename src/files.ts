import { useEffect, useState } from 'react';
import { upload } from '@vercel/blob/client';
import type { Board, FileRef } from './types';
import { syncConfig } from './syncConfig';

/**
 * Attachments are stored in Vercel Blob when the shared backend has it configured (FileRef.url),
 * otherwise in this browser's IndexedDB (localStorage is far too small for files).
 * The board itself only stores metadata (FileRef).
 */
const DB = 'tasker-files';
const STORE = 'files';

let dbPromise: Promise<IDBDatabase> | null = null;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const putFile = (id: string, blob: Blob) => run('readwrite', (s) => s.put(blob, id));
export const getFile = (id: string) => run<Blob | undefined>('readonly', (s) => s.get(id));
export const deleteFile = (id: string) => run('readwrite', (s) => s.delete(id));

/** Remove stored blobs no longer referenced by any cell (e.g. after a task or column was deleted). */
export async function collectGarbage(keep: Set<string>) {
  try {
    const keys = (await run('readonly', (s) => s.getAllKeys())) as string[];
    await Promise.all(keys.filter((k) => !keep.has(k)).map(deleteFile));
  } catch {
    /* IndexedDB unavailable — nothing to clean */
  }
}

/** Displayable URL for an attachment: its shared URL, or an object URL for a local file. */
export function useFileUrl(ref: FileRef | null) {
  const id = ref && !ref.url ? ref.id : null;
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let u: string | null = null;
    let live = true;
    getFile(id)
      .then((blob) => {
        if (blob && live) setLocal((u = URL.createObjectURL(blob)));
      })
      .catch(() => {});
    return () => {
      live = false;
      if (u) URL.revokeObjectURL(u);
      setLocal(null);
    };
  }, [id]);
  return ref?.url ?? local;
}

export async function openFile(ref: FileRef, download = false) {
  let blob: Blob | undefined;
  try {
    blob = ref.url ? await (await fetch(ref.url)).blob() : await getFile(ref.id);
  } catch {
    // Cross-origin fetch blocked: fall back to opening the shared URL directly.
    if (ref.url) return void window.open(ref.url, '_blank', 'noopener');
  }
  if (!blob) return alert('This file is only stored in the browser it was uploaded from.');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  if (download) a.download = ref.name;
  else a.target = '_blank';
  a.rel = 'noopener';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Store a new attachment — in shared storage when available, otherwise locally. */
export async function saveFile(file: File, id: string): Promise<FileRef> {
  const ref: FileRef = { id, name: file.name, size: file.size, type: file.type, addedAt: Date.now() };
  if (syncConfig.files) {
    const blob = await upload(`attachments/${file.name}`, file, {
      access: 'public',
      handleUploadUrl: '/api/upload',
      clientPayload: syncConfig.passcode,
    });
    return { ...ref, url: blob.url };
  }
  await putFile(id, file);
  return ref;
}

export async function removeStoredFile(ref: FileRef) {
  try {
    if (ref.url) {
      await fetch(`/api/upload?url=${encodeURIComponent(ref.url)}`, {
        method: 'DELETE',
        headers: { 'x-tasker-passcode': syncConfig.passcode },
      });
    } else await deleteFile(ref.id);
  } catch {
    /* best effort */
  }
}

/** When this browser seeds the shared board, move its local attachments into shared storage too. */
export async function uploadLocalFiles(board: Board): Promise<Board> {
  const b = structuredClone(board);
  const cols = b.columns.filter((c) => c.type === 'files');
  for (const item of b.items)
    for (const c of cols) {
      const refs = item.values[c.id];
      if (!Array.isArray(refs)) continue;
      for (const ref of refs as FileRef[]) {
        if (ref.url) continue;
        try {
          const blob = await getFile(ref.id);
          if (!blob) continue;
          const up = await upload(`attachments/${ref.name}`, blob, {
            access: 'public',
            handleUploadUrl: '/api/upload',
            clientPayload: syncConfig.passcode,
          });
          ref.url = up.url;
        } catch {
          /* leave it local */
        }
      }
    }
  return b;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
