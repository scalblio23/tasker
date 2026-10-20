import { authorized, filesConfigured, getStore, json } from './_store.js';

/** A whole-entity write (data, or null to delete) or a field-level patch of an item. */
type Change =
  | { key: string; data: unknown }
  | { key: string; patch: { fields?: Record<string, unknown>; values?: Record<string, unknown> } };

const KEY = /^(meta|columns|groups|views|users|item:[\w-]+|time:[\w-]+)$/;

const parse = (s: string | null) => {
  if (s == null) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

/**
 * GET ?full=1: the whole board. GET ?since=<rev>: entities changed after that revision (tombstones included).
 * `known` is the latest revision the client has seen: when nothing is newer the poll costs one read.
 */
export async function GET(request: Request) {
  const store = getStore();
  if (!store) return json({ configured: false });
  if (!authorized(request.headers.get('x-tasker-passcode'))) return json({ error: 'passcode' }, 401);

  const params = new URL(request.url).searchParams;
  const since = Number(params.get('since') ?? 0) || 0;
  const rev = await store.rev();
  if (params.get('full') === '1') {
    const all = await store.getAll();
    const entities = Object.fromEntries(
      Object.entries(all)
        .map(([k, v]) => [k, parse(v)] as const)
        .filter(([, v]) => v != null),
    );
    return json({ configured: true, files: filesConfigured(), rev, entities });
  }
  const knownParam = params.get('known');
  const known = knownParam == null ? since : Number(knownParam) || 0;
  if (rev <= known) return json({ configured: true, rev, changes: [] });
  const keys = await store.changedSince(since);
  const values = await store.getMany(keys);
  return json({ configured: true, rev, changes: keys.map((key, i) => ({ key, data: parse(values[i]) })) });
}

/** POST { changes }: apply a batch of client changes under one new revision. */
export async function POST(request: Request) {
  const store = getStore();
  if (!store) return json({ configured: false }, 404);
  if (!authorized(request.headers.get('x-tasker-passcode'))) return json({ error: 'passcode' }, 401);

  let body: { changes?: Change[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const changes = (body.changes ?? []).filter((c) => typeof c?.key === 'string' && KEY.test(c.key));
  if (!changes.length) return json({ rev: await store.rev() });

  // Item patches merge into the stored item, so two people editing different cells of one task both win.
  const patchKeys = changes.filter((c) => 'patch' in c).map((c) => c.key);
  const patchIndex = new Map(patchKeys.map((k, i) => [k, i]));
  const stored = await store.getMany(patchKeys);

  const entries: Record<string, string> = {};
  for (const c of changes) {
    if ('patch' in c) {
      const base = parse(entries[c.key] ?? stored[patchIndex.get(c.key)!]);
      if (!base) continue; // deleted meanwhile — don't resurrect it
      const merged = { ...base, ...(c.patch.fields ?? {}), values: { ...(base.values ?? {}) } };
      for (const [k, v] of Object.entries(c.patch.values ?? {})) {
        if (v == null) delete merged.values[k];
        else merged.values[k] = v;
      }
      entries[c.key] = JSON.stringify(merged);
    } else {
      entries[c.key] = JSON.stringify(c.data ?? null);
    }
  }
  const rev = await store.nextRev();
  await store.write(rev, entries);
  return json({ rev });
}
