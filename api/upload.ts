import { del } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { authorized, json } from './_store.js';

const MAX_BYTES = 25 * 1024 * 1024;

/** Issues short-lived tokens so the browser can upload attachments straight to Vercel Blob. */
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json({ error: 'Attachments storage is not configured' }, 404);
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (!authorized(clientPayload)) throw new Error('Wrong passcode');
        return { maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
      },
    });
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Upload failed' }, 400);
  }
}

/** DELETE ?url=<blob url>: remove an attachment from storage. */
export async function DELETE(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json({ error: 'not configured' }, 404);
  if (!authorized(request.headers.get('x-tasker-passcode'))) return json({ error: 'passcode' }, 401);
  const url = new URL(request.url).searchParams.get('url');
  if (!url || !/^https:\/\/[\w.-]+\.blob\.vercel-storage\.com\//.test(url)) return json({ error: 'bad url' }, 400);
  await del(url);
  return json({ ok: true });
}
