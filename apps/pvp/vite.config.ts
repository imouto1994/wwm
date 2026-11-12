import type { IncomingMessage } from 'node:http';
import { URL, fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { type Plugin, defineConfig, loadEnv } from 'vite';

async function toRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    for await (const chunk of req) chunks.push(chunk as Buffer);
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(', '));
  }
  return new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
    method: req.method,
    headers,
    body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
  });
}

// Serves /api/tournament from the dev server with the same handler the Vercel
// Function uses, so `pnpm dev:pvp` works without the Vercel CLI. Loaded through
// ssrLoadModule so the TypeScript server code is compiled on the fly.
function devApi(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'pvp-dev-api',
    apply: 'serve',
    configureServer(server) {
      if (!env.HOST_PIN) server.config.logger.info('[pvp] HOST_PIN is not set; the local host PIN is "dev".');
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/tournament')) return next();
        try {
          const { handleDevRequest } = await server.ssrLoadModule('/server/dev.ts');
          const response: Response = await handleDevRequest(await toRequest(req), env);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

// base: '/' because Vercel serves the app at its own domain root (no sub-path).
export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
  return {
    base: '/',
    plugins: [react(), tailwindcss(), devApi(env)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: { port: 2140 },
  };
});
