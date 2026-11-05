import { authorized, getStore, json } from './_store.js';
import { listKeys, newKey, type KeyRecord } from './_keys.js';

/**
 * Manage export API keys from the app (guarded by the team passcode when one is set).
 *   GET    → keys without their secret (name, prefix, created, last used)
 *   POST   { name } → creates a key and returns it once
 *   DELETE ?id=…   → revokes a key
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
  return json({ keys: (await listKeys(store)).map(pub) });
}

export async function POST(request: Request) {
  const { store, res } = await guard(request);
  if (!store) return res;
  let name = '';
  try {
    name = String((await request.json()).name ?? '');
  } catch {
    /* unnamed */
  }
  if ((await listKeys(store)).length >= 20) return json({ error: 'Too many keys — revoke one first.' }, 400);
  const { key, record } = newKey(name);
  await store.putKey(record.id, JSON.stringify(record));
  return json({ key, record: pub(record) });
}

export async function DELETE(request: Request) {
  const { store, res } = await guard(request);
  if (!store) return res;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id required' }, 400);
  await store.deleteKey(id);
  return json({ ok: true });
}
