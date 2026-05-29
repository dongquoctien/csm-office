import type { ClientRequest } from 'node:http';
import { defineConfig, loadEnv } from 'vite';

/**
 * Dev server + SSE-aware proxy for /api/* → the csm agent (PLAN.md §3.3).
 *
 * Proxy mode is the only viable v1 path: csm sends no CORS headers, so the
 * browser cannot read its stream cross-origin. We proxy same-origin and inject
 * the token server-side so it never appears in client JS.
 *
 * Env (.env / shell):
 *   CSM_AGENT_URL  e.g. http://127.0.0.1:4777   (default below)
 *   CSM_TOKEN      the per-run random token csm prints on launch (optional in
 *                  dev — without it /api/* returns 401, but the app still boots
 *                  and runs on mock fixtures).
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.CSM_AGENT_URL || 'http://127.0.0.1:4777';
  const token = env.CSM_TOKEN || '';

  return {
    server: {
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
          // SSE is long-lived: do not let idle streams be dropped.
          timeout: 3_600_000,
          proxyTimeout: 3_600_000,
          configure: (proxy: { on: (e: string, cb: (req: ClientRequest) => void) => void }) => {
            proxy.on('proxyReq', (proxyReq: ClientRequest) => {
              // Inject the token server-side (header form; csm accepts either
              // x-csm-token or ?token=). Keeps it out of client JS.
              if (token) proxyReq.setHeader('x-csm-token', token);
            });
          },
        },
      },
    },
    build: {
      target: 'es2022',
      sourcemap: true,
    },
  };
});
