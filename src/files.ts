import { useEffect, useState } from 'react';

/**
 * Attachment blobs live in IndexedDB (localStorage is far too small for files);
 * the board only stores their metadata (FileRef).
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

/** Object URL for a stored file, revoked on unmount. */
export function useFileUrl(id: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let u: string | null = null;
    let live = true;
    getFile(id)
      .then((blob) => {
        if (blob && live) setUrl((u = URL.createObjectURL(blob)));
      })
      .catch(() => {});
    return () => {
      live = false;
      if (u) URL.revokeObjectURL(u);
      setUrl(null);
    };
  }, [id]);
  return url;
}

export async function openFile(id: string, download?: string) {
  const blob = await getFile(id);
  if (!blob) return alert('This file is no longer stored in this browser.');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  if (download) a.download = download;
  else a.target = '_blank';
  a.rel = 'noopener';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
