import { getStore } from './_store.js';
import { keyFromRequest, verifyKey } from './_keys.js';
import { buildExport, tasksCsv, timeCsv, type ArchivedMode } from './_export.js';

/**
 * Read-only data export for external apps.
 *
 *   GET /api/export                      → JSON: board, columns, groups, people, tasks, timeEntries
 *   GET /api/export?format=csv           → tasks as CSV
 *   GET /api/export?format=csv&resource=time → time entries as CSV
 *   ?archived=exclude|include|only (default exclude) · ?subtasks=false
 *
 * Authenticate with `Authorization: Bearer <key>`, an `X-API-Key` header, or `?key=<key>`.
 */
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-api-key',
  'access-control-allow-methods': 'GET, OPTIONS',
};

const reply = (body: string, status: number, type = 'application/json; charset=utf-8', extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': type, 'cache-control': 'no-store', ...CORS, ...extra } });
const error = (message: string, status: number) => reply(JSON.stringify({ error: message }), status);

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  try {
    const store = getStore();
    if (!store) return error('Shared storage is not configured on this deployment.', 503);
    if (!(await verifyKey(store, keyFromRequest(request))))
      return error('Missing or invalid API key. Send it as "Authorization: Bearer <key>", an X-API-Key header, or ?key=.', 401);

    const params = new URL(request.url).searchParams;
    const archivedParam = params.get('archived');
    const archived: ArchivedMode = archivedParam === 'include' || archivedParam === 'only' ? archivedParam : 'exclude';
    const subtasks = params.get('subtasks') !== 'false';

    const entities: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(await store.getAll())) {
      try {
        const parsed = JSON.parse(v);
        if (parsed != null) entities[k] = parsed;
      } catch {
        /* skip unreadable entries */
      }
    }
    const data = buildExport(entities, { archived, subtasks });

    if (params.get('format') === 'csv') {
      const time = params.get('resource') === 'time';
      return reply(time ? timeCsv(data) : tasksCsv(data), 200, 'text/csv; charset=utf-8', {
        'content-disposition': `inline; filename="${time ? 'time-entries' : 'tasks'}.csv"`,
      });
    }
    return reply(JSON.stringify(data, null, 2), 200);
  } catch (e) {
    return error(e instanceof Error ? e.message : String(e), 500);
  }
}
