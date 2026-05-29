/**
 * SSE client (PLAN.md §3.1, Phase 1). Subscribes to /api/stream (proxied
 * same-origin; token injected server-side — see vite.config.ts / server/).
 *
 * Wire format (verified, PLAN.md §1.2):
 *   - event: snapshot \n data: <Snapshot JSON>
 *   - event: error    \n data: {"error":"..."}
 *   - : ping  comment heartbeats (~15s) — EventSource ignores comments for us.
 *
 * Surfaces a ConnectionState and snapshot/error callbacks; reconnects with
 * capped exponential backoff. No Phaser/DOM-render imports — pure transport.
 */
import { API_BASE, SSE_BACKOFF_MAX_MS, SSE_BACKOFF_MIN_MS } from '../config';
import type { ConnectionState, Snapshot, StreamError } from './types';

export interface SseClient {
  start(): void;
  stop(): void;
  readonly state: ConnectionState;
}

export interface SseHandlers {
  onSnapshot: (snapshot: Snapshot) => void;
  onState?: (state: ConnectionState) => void;
  onError?: (err: StreamError) => void;
}

export function createSseClient(handlers: SseHandlers): SseClient {
  let es: EventSource | null = null;
  let state: ConnectionState = 'offline';
  let backoff = SSE_BACKOFF_MIN_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const setState = (s: ConnectionState): void => {
    if (s === state) return;
    state = s;
    handlers.onState?.(s);
  };

  const scheduleReconnect = (): void => {
    if (stopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, backoff);
    backoff = Math.min(backoff * 2, SSE_BACKOFF_MAX_MS);
  };

  const connect = (): void => {
    if (stopped) return;
    setState('connecting');
    es = new EventSource(`${API_BASE}/stream`);

    es.addEventListener('open', () => {
      backoff = SSE_BACKOFF_MIN_MS; // reset on a healthy connection
      setState('connected');
    });

    es.addEventListener('snapshot', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as Snapshot;
        setState('connected');
        handlers.onSnapshot(data);
      } catch {
        // Malformed payload — ignore this frame, keep the stream.
      }
    });

    es.addEventListener('error', (ev) => {
      // Two cases: an app-level `event: error` with data, or a transport drop.
      const data = (ev as MessageEvent).data;
      if (typeof data === 'string' && data.length) {
        try {
          handlers.onError?.(JSON.parse(data) as StreamError);
        } catch {
          /* ignore */
        }
        return;
      }
      // Transport error: EventSource auto-retries, but we manage state + backoff.
      setState('offline');
      es?.close();
      es = null;
      scheduleReconnect();
    });
  };

  return {
    start(): void {
      stopped = false;
      connect();
    },
    stop(): void {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      es?.close();
      es = null;
      setState('offline');
    },
    get state(): ConnectionState {
      return state;
    },
  };
}
