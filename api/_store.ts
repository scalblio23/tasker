import { Redis } from '@upstash/redis';

/**
 * Shared board storage. The board is split into entities ("meta", "columns", "item:<id>", "time:<id>", …)
 * kept as JSON strings in one hash; a sorted set records the revision each entity last changed at,
 * so clients can fetch only what changed since their last sync.
 */
export interface Store {
  rev(): Promise<number>;
  nextRev(): Promise<number>;
  getAll(): Promise<Record<string, string>>;
  getMany(keys: string[]): Promise<(string | null)[]>;
  /** Write entities (JSON string, or "null" as a deletion tombstone) at `rev`. */
  write(rev: number, entries: Record<string, string>): Promise<void>;
  changedSince(rev: number): Promise<string[]>;
}

const HASH = 'tasker:entities';
const LOG = 'tasker:log';
const REV = 'tasker:rev';

function redisStore(url: string, token: string): Store {
  const redis = new Redis({ url, token, automaticDeserialization: false });
  return {
    rev: async () => Number((await redis.get<string>(REV)) ?? 0),
    nextRev: () => redis.incr(REV),
    // With automaticDeserialization off, HGETALL / HMGET come back as raw Redis replies (flat arrays),
    // not objects — handle both shapes.
    getAll: async () => {
      const raw = (await redis.hgetall(HASH)) as unknown;
      if (!raw) return {};
      if (!Array.isArray(raw)) return raw as Record<string, string>;
      const out: Record<string, string> = {};
      for (let i = 0; i + 1 < raw.length; i += 2) out[String(raw[i])] = String(raw[i + 1]);
      return out;
    },
    getMany: async (keys) => {
      if (!keys.length) return [];
      const raw = (await redis.hmget(HASH, ...keys)) as unknown;
      if (!raw) return keys.map(() => null);
      if (Array.isArray(raw)) return keys.map((_, i) => (raw[i] == null ? null : String(raw[i])));
      const obj = raw as Record<string, string | null>;
      return keys.map((k) => obj[k] ?? null);
    },
    write: async (rev, entries) => {
      const keys = Object.keys(entries);
      if (!keys.length) return;
      const p = redis.multi();
      p.hset(HASH, entries);
      const [first, ...rest] = keys.map((member) => ({ score: rev, member }));
      p.zadd(LOG, first, ...rest);
      await p.exec();
    },
    changedSince: (rev) => redis.zrange<string[]>(LOG, `(${rev}`, '+inf', { byScore: true }),
  };
}

/**
 * In-process store for `npm run dev`, so several local tabs can share a board without Redis.
 * Kept on globalThis: Vite can instantiate this module more than once, and every copy must share one store.
 */
type Memory = { rev: number; hash: Map<string, string>; log: Map<string, number> };
const g = globalThis as { __taskerMemory?: Memory };
const memory = (g.__taskerMemory ??= { rev: 0, hash: new Map(), log: new Map() });
const memoryStore: Store = {
  rev: async () => memory.rev,
  nextRev: async () => ++memory.rev,
  getAll: async () => Object.fromEntries(memory.hash),
  getMany: async (keys) => keys.map((k) => memory.hash.get(k) ?? null),
  write: async (rev, entries) => {
    for (const [k, v] of Object.entries(entries)) {
      memory.hash.set(k, v);
      memory.log.set(k, rev);
    }
  },
  changedSince: async (rev) => [...memory.log].filter(([, r]) => r > rev).map(([k]) => k),
};

export function getStore(): Store | null {
  if (process.env.TASKER_DEV_MEMORY === '1') return memoryStore;
  // Names used by the Upstash integration on the Vercel Marketplace (KV_*) or by Upstash directly.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? redisStore(url, token) : null;
}

/**
 * How attachments reach Vercel Blob: 'token' for stores with BLOB_READ_WRITE_TOKEN, 'presigned' for
 * newer stores that authenticate with OIDC (BLOB_STORE_ID), or false when no store is connected.
 */
export type BlobMode = 'token' | 'presigned' | false;
export const blobMode = (): BlobMode =>
  process.env.BLOB_READ_WRITE_TOKEN ? 'token' : process.env.BLOB_STORE_ID ? 'presigned' : false;

/** Optional shared team passcode (TASKER_PASSCODE). */
export function authorized(passcode: string | null) {
  const expected = process.env.TASKER_PASSCODE;
  return !expected || passcode === expected;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
