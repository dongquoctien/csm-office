/**
 * Runtime config + tunables. Values that shape behavior live here so the rest
 * of the code reads them rather than hard-coding.
 */

/** Recent-window filter (PLAN.md §4.1): show agents active OR touched < this. */
export const RECENT_MS = 30 * 60 * 1000; // 30 minutes

/** Max sprites rendered at once; beyond this we cap + log (PLAN.md §4.5). */
export const MAX_VISIBLE_AGENTS = 120;

/** Walk tuning, ported from the csm MVP (PLAN.md §4.5). */
export const WALK_SPEED_PX_PER_MS = 0.18;
export const WALK_LEG_MIN_MS = 180;
export const WALK_LEG_MAX_MS = 1400;

/** Speech-bubble rotation interval. */
export const BUBBLE_ROTATE_MS = 3000;

/** SSE reconnect backoff. */
export const SSE_BACKOFF_MIN_MS = 1000;
export const SSE_BACKOFF_MAX_MS = 15000;

/** API path (proxied same-origin in dev/prod; see vite.config.ts / server/). */
export const API_BASE = '/api';
