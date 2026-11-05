import { authorized, getStore, json } from './_store.js';
import { listKeys, newKey, type KeyRecord } from './_keys.js';

/**
 * The board's API key, shown in the app for copying (guarded by the team passcode when one is set).
 *   GET               → the current key, created automatically the first time
 *   POST {regenerate} → replaces every key with a new one (old ones stop working)
 */
const pub = ({ hash: _hash, ...rest }: KeyRecord) => rest;

async function guard(request: Request) {
  const store = getStore();
  if (!store) return { res: json({ error: 'Shared storage is not configured on this deployment.' }, 503) };
  if (!authorized(request.headers.get('x-tasker-passcode'))) return { res: json({ error: 'passcode' }, 401) };
  return { store };
}

export async function GET(request: Request) {
  const { store, res } = await guard(request);
  if (!store) return res;
  // The newest key that can still be shown; make one if there is none.
  let current = (await listKeys(store)).find((k) => k.key);
  if (!current) {
    current = newKey('API key').record;
    await store.putKey(current.id, JSON.stringify(current));
  }
  return json({ key: pub(current) });
}

export async function POST(request: Request) {
  const { store, res } = await guard(request);
  if (!store) return res;
  for (const k of await listKeys(store)) await store.deleteKey(k.id);
  const { record } = newKey('API key');
  await store.putKey(record.id, JSON.stringify(record));
  return json({ key: pub(record) });
}
