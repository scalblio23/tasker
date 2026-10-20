import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Serves the Vercel functions in /api during `npm run dev`, backed by an in-memory store,
 * so sync can be tried locally across tabs without Redis. On Vercel the same files run as functions.
 */
function devApi(): Plugin {
  return {
    name: 'tasker-dev-api',
    apply: 'serve',
    configureServer(server) {
      // Use an in-memory store unless real (or test) Redis settings are provided.
      if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) process.env.TASKER_DEV_MEMORY = '1';
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([\w-]+)/);
        if (!match) return next();
        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.ts`);
          const handler = mod[req.method ?? 'GET'];
          if (typeof handler !== 'function') {
            res.statusCode = 405;
            return res.end();
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const request = new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: chunks.length ? Buffer.concat(chunks) : undefined,
          });
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          server.config.logger.error(String(e));
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
});
