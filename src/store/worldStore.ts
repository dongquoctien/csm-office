/**
 * worldStore (PLAN.md §3.1/§4.1) — pure reducer that turns a raw csm snapshot
 * into the world state the game renders. No Phaser/DOM/SSE imports.
 *
 *  - Applies the recent-window filter so the office doesn't fill with dead
 *    sessions (active || now - mtime < RECENT_MS).
 *  - Computes each agent's zone + a stable look once.
 *
 * `diff.ts` compares two WorldStates to emit ordered intents for the game layer.
 */
import { MAX_VISIBLE_AGENTS, RECENT_MS } from '../config';
import type { Activity, MonitorSession, Snapshot, SystemStats } from '../api/types';
import { lookFor, type Look } from './look';
import { zoneFor, type ZoneId } from './zoneMap';

export interface AgentState {
  id: string;
  label: string; // projectLabel || title — human name for the agent
  activity: Activity;
  zone: ZoneId;
  active: boolean;
  /** Tail of recentMessages, pre-trimmed; null when none. */
  say: string | null;
  mtime: number;
  look: Look;
  /** Raw session kept for the detail panel (Phase 4). */
  session: MonitorSession;
}

export interface WorldState {
  agents: Map<string, AgentState>;
  stats: SystemStats | null;
}

export function emptyWorld(): WorldState {
  return { agents: new Map(), stats: null };
}

/** True if a session should be visible right now. */
export function isRecent(s: MonitorSession, now: number): boolean {
  return s.active || now - (s.mtime || 0) < RECENT_MS;
}

function tailMessage(s: MonitorSession): string | null {
  const msgs = s.recentMessages;
  if (!msgs || msgs.length === 0) return null;
  const last = msgs[msgs.length - 1];
  const t = (last?.text || '').trim();
  return t.length ? t : null;
}

function toAgent(s: MonitorSession): AgentState {
  return {
    id: s.id,
    label: s.projectLabel || s.title || s.id,
    activity: s.activity,
    zone: zoneFor(s.activity),
    active: s.active,
    say: tailMessage(s),
    mtime: s.mtime,
    look: lookFor(s.id),
    session: s,
  };
}

/**
 * Pure: build the next WorldState from a snapshot. `now` is injected so tests
 * are deterministic (defaults to Date.now() in real use).
 */
export function applySnapshot(snapshot: Snapshot, now: number = Date.now()): WorldState {
  let recent = snapshot.sessions.filter((s) => isRecent(s, now));
  // Cap visible agents (PLAN.md §4.5): keep the most-recently-touched, log drops.
  if (recent.length > MAX_VISIBLE_AGENTS) {
    const dropped = recent.length - MAX_VISIBLE_AGENTS;
    recent = [...recent].sort((a, b) => b.mtime - a.mtime).slice(0, MAX_VISIBLE_AGENTS);
    console.warn(`[world] capped at ${MAX_VISIBLE_AGENTS} agents; dropped ${dropped} older ones.`);
  }
  const agents = new Map<string, AgentState>();
  for (const s of recent) agents.set(s.id, toAgent(s));
  return { agents, stats: snapshot.systemStats };
}
