import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Store } from './_store.js';

/** Stored per key: never the key itself, only its SHA-256. */
export interface KeyRecord {
  id: string;
  name: string;
  /** First characters of the key, shown so people can tell keys apart. */
  prefix: string;
  hash: string;
  createdAt: number;
  lastUsedAt?: number;
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export function newKey(name: string): { key: string; record: KeyRecord } {
  const key = `tsk_${randomBytes(24).toString('base64url')}`;
  const record: KeyRecord = {
    id: randomBytes(6).toString('hex'),
    name: name.trim().slice(0, 60) || 'API key',
    prefix: key.slice(0, 10),
    hash: sha256(key),
    createdAt: Date.now(),
  };
  return { key, record };
}

export async function listKeys(store: Store): Promise<KeyRecord[]> {
  const raw = await store.listKeys();
  return Object.values(raw)
    .map((v) => {
      try {
        return JSON.parse(v) as KeyRecord;
      } catch {
        return null;
      }
    })
    .filter((r): r is KeyRecord => !!r)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** The key from `Authorization: Bearer …`, `X-API-Key`, or `?key=` (for tools that can't set headers). */
export function keyFromRequest(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return request.headers.get('x-api-key')?.trim() || new URL(request.url).searchParams.get('key')?.trim() || null;
}

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Check a presented key against the stored hashes (and the optional TASKER_API_KEY variable). */
export async function verifyKey(store: Store, key: string | null): Promise<KeyRecord | null> {
  if (!key) return null;
  const env = process.env.TASKER_API_KEY;
  if (env && same(sha256(key), sha256(env)))
    return { id: 'env', name: 'TASKER_API_KEY', prefix: env.slice(0, 10), hash: '', createdAt: 0 };
  const h = sha256(key);
  const match = (await listKeys(store)).find((r) => same(r.hash, h)) ?? null;
  // Record last use, at most once a minute per key.
  if (match && (!match.lastUsedAt || Date.now() - match.lastUsedAt > 60_000)) {
    await store.putKey(match.id, JSON.stringify({ ...match, lastUsedAt: Date.now() })).catch(() => {});
  }
  return match;
}
