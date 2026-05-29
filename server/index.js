// Production server: serve the built static bundle + proxy /api/* (SSE) to the
// csm agent with a server-injected token (PLAN.md §3.3).
//
// Rules that keep SSE alive: NO compression on /api/*, pass through the
// upstream's x-accel-buffering/cache-control verbatim, don't buffer the body.
//
// Stub for Phase 0 — fleshed out in Phase 4/5. Run with `npm run serve` after
// `npm run build`.
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';

const PORT = Number(process.env.PORT || 5180);
const CSM_AGENT_URL = process.env.CSM_AGENT_URL || 'http://127.0.0.1:4777';
const CSM_TOKEN = process.env.CSM_TOKEN || '';

const app = new Hono();

// Proxy /api/* to the csm agent, injecting the token. No compression here.
app.all('/api/*', async (c) => {
  const upstream = new URL(c.req.path + (c.req.url.includes('?') ? '?' + c.req.url.split('?')[1] : ''), CSM_AGENT_URL);
  const headers = new Headers(c.req.raw.headers);
  if (CSM_TOKEN) headers.set('x-csm-token', CSM_TOKEN);
  headers.delete('host');
  const res = await fetch(upstream, {
    method: c.req.method,
    headers,
    body: c.req.method === 'GET' || c.req.method === 'HEAD' ? undefined : c.req.raw.body,
    // @ts-expect-error node fetch needs duplex for streaming bodies
    duplex: 'half',
  });
  // Stream the body through verbatim (SSE-safe).
  return new Response(res.body, { status: res.status, headers: res.headers });
});

app.use('/*', serveStatic({ root: './dist' }));

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`csm-office serving on http://127.0.0.1:${PORT} → proxy ${CSM_AGENT_URL}`);
});
