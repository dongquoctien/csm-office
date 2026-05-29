/**
 * Dev-only mock stream. Loads the sample fixture and, while no live SSE is
 * connected, periodically flips random agents' activities to emit synthetic
 * snapshots — so walking/animation can be seen and verified without a csm token.
 * Never bundled into a meaningful prod path (guarded by import.meta.env.DEV).
 */
import type { Activity, MonitorSession, Snapshot } from '../api/types';
import { ACTIVITIES } from '../api/types';

export interface MockController {
  stop: () => void;
}

/** Start emitting mock snapshots. Returns null if the fixture can't be loaded. */
export async function startMockStream(
  onSnapshot: (snap: Snapshot) => void,
  isLive: () => boolean,
  intervalMs = 2500,
): Promise<MockController | null> {
  const res = await fetch('/test/fixtures/snapshot.sample.json').catch(() => null);
  if (!res || !res.ok) return null;
  const base = (await res.json()) as Snapshot;

  // Re-stamp mtimes to "now" so the recent-window keeps them visible.
  const now = Date.now();
  const sessions: MonitorSession[] = base.sessions.map((s) => ({ ...s, mtime: now, active: true }));
  let snap: Snapshot = { ...base, sessions };
  onSnapshot(snap);

  let i = 0;
  const timer = setInterval(() => {
    if (isLive()) return; // live stream took over — stand down
    // Flip one agent to a new random activity, bump its mtime + message.
    const idx = i % sessions.length;
    const nextActivity: Activity = ACTIVITIES[(i * 3 + 1) % ACTIVITIES.length];
    sessions[idx] = {
      ...sessions[idx],
      activity: nextActivity,
      mtime: Date.now(),
      active: true,
      recentMessages: [{ role: 'assistant', text: `now ${nextActivity}…`, ts: Date.now() }],
    };
    snap = { ...snap, sessions: sessions.slice() };
    onSnapshot(snap);
    i++;
  }, intervalMs);

  return { stop: () => clearInterval(timer) };
}
