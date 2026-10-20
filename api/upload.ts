import { del, issueSignedToken } from '@vercel/blob';
import { handleUpload, handleUploadPresigned, type HandleUploadBody, type HandleUploadPresignedBody } from '@vercel/blob/client';
import { authorized, blobMode, json } from './_store.js';

const MAX_BYTES = 25 * 1024 * 1024;

/** Lets the browser upload attachments straight to Vercel Blob (classic token or presigned flow). */
export async function POST(request: Request) {
  const mode = blobMode();
  if (!mode) return json({ error: 'Attachments storage is not configured' }, 404);
  try {
    if (mode === 'token') {
      const result = await handleUpload({
        body: (await request.json()) as HandleUploadBody,
        request,
        onBeforeGenerateToken: async (_pathname, clientPayload) => {
          if (!authorized(clientPayload)) throw new Error('Wrong passcode');
          return { maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true };
        },
      });
      return json(result);
    }
    const result = await handleUploadPresigned({
      body: (await request.json()) as HandleUploadPresignedBody,
      request,
      getSignedToken: async (_pathname, clientPayload) => {
        if (!authorized(clientPayload)) throw new Error('Wrong passcode');
        const token = await issueSignedToken({
          pathname: '*', // the final name gets a random suffix, so scope to the store
          operations: ['put'],
          maximumSizeInBytes: MAX_BYTES,
          validUntil: Date.now() + 10 * 60 * 1000,
        });
        return { token, urlOptions: { maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true } };
      },
    });
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Upload failed' }, 400);
  }
}

/** DELETE ?url=<blob url>: remove an attachment from storage. */
export async function DELETE(request: Request) {
  if (!blobMode()) return json({ error: 'not configured' }, 404);
  if (!authorized(request.headers.get('x-tasker-passcode'))) return json({ error: 'passcode' }, 401);
  const url = new URL(request.url).searchParams.get('url');
  if (!url || !/^https:\/\/[\w.-]+\.blob\.vercel-storage\.com\//.test(url)) return json({ error: 'bad url' }, 400);
  try {
    await del(url);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Delete failed' }, 500);
  }
}
