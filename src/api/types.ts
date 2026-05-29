/**
 * Wire types for the csm agent HTTP/SSE API.
 *
 * These are OWNED BY csm-office and re-declared here on purpose — they are NOT
 * imported from claude-session-manager (csm). csm-office stays source-independent
 * of csm (see PLAN.md §3.0); the only coupling is the runtime HTTP/SSE call to a
 * *running* csm agent. If csm changes its API, update this file by hand.
 *
 * Verified 2026-05-29 against the csm source at D:\Github\claude-session-manager:
 *   - Endpoints/SSE:        packages/agent/src/server.js
 *   - Snapshot/session shape: packages/core/src/scanner.js
 *   - activity/status enums:  packages/core/src/metrics.js
 */

// ---------------------------------------------------------------------------
// Enums (frozen in csm metrics.js — keep in exact sync)
// ---------------------------------------------------------------------------

/** csm `Activity` — exactly these 9 values. Drives room placement. */
export const ACTIVITIES = [
  'idle',
  'waiting',
  'thinking',
  'reading',
  'writing',
  'running',
  'searching',
  'browsing',
  'spawning',
] as const;
export type Activity = (typeof ACTIVITIES)[number];

/** csm `Status` — finer turn-state. Use for nuance only, not placement. */
export const STATUSES = ['unknown', 'waiting', 'thinking', 'tool', 'idle'] as const;
export type Status = (typeof STATUSES)[number];

// ---------------------------------------------------------------------------
// Per-session unit (the thing we render). The ONLY fields present in the
// /api/stream snapshot — `lastPrompt`, `size`, `file` exist on csm's base
// Session but are intentionally dropped from the stream, so they are absent here.
// ---------------------------------------------------------------------------

export interface SessionTokens {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
}

export interface RecentMessage {
  role: string;
  /** Pre-trimmed by csm to 300 chars max. */
  text: string;
  /** epoch ms */
  ts: number;
}

export interface MonitorSession {
  /** Stable key for an agent sprite — survives reconnects. */
  id: string;
  title: string;
  titleSource: string;
  cwd: string | null;
  branch: string | null;
  projectSlug: string;
  /** Human label for the agent. */
  projectLabel: string;
  /** Last-touched epoch ms — drives the recent-window filter (§4.1). */
  mtime: number;
  favorite: boolean;
  cwdExists: boolean;
  activity: Activity;
  /** now - lastActivityMs < 60_000 */
  active: boolean;
  status: Status;
  model: string | null;
  tokens: SessionTokens;
  totalTokens: number;
  costUSD: number;
  cacheHitRate: number;
  messages: number;
  durationMs: number;
  modifiedFiles: string[];
  recentMessages: RecentMessage[];
}

// ---------------------------------------------------------------------------
// Snapshot (payload of the `snapshot` SSE event, and of GET /api/monitor)
// ---------------------------------------------------------------------------

export interface ByModelStat {
  model: string;
  tokens: number;
  costUSD: number;
}

export interface SystemStats {
  activeSessions: number;
  totalSessions: number;
  totalMessages: number;
  tokensUsed: number;
  totalCost: number;
  avgDurationMs: number;
  topModel: string | null;
  byModel: ByModelStat[];
}

export interface Snapshot {
  sessions: MonitorSession[];
  systemStats: SystemStats;
}

// ---------------------------------------------------------------------------
// GET /api/session?id=&slug=  →  detail incl. tokens-over-time buckets
// ---------------------------------------------------------------------------

/** Parallel arrays: tokenBuckets.tokens[i] was accrued at tokenBuckets.ts[i]. */
export interface TokenBuckets {
  ts: number[];
  tokens: number[];
}

export interface SessionDetail {
  session: MonitorSession;
  tokenBuckets: TokenBuckets;
}

// ---------------------------------------------------------------------------
// SSE event envelope
// ---------------------------------------------------------------------------

/** `event: error\ndata: {"error":"..."}` */
export interface StreamError {
  error: string;
}

/** Discriminated union of what the SSE client surfaces upward. */
export type StreamEvent =
  | { type: 'snapshot'; data: Snapshot }
  | { type: 'error'; data: StreamError };

/** Connection state the HUD's connection pill mirrors. */
export type ConnectionState = 'connecting' | 'connected' | 'offline';
