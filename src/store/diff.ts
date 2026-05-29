/**
 * diff (PLAN.md §4.3) — pure. Compares previous vs next WorldState and emits
 * ordered intents the game layer animates. Order matters: despawns first (free
 * slots), then spawns, then per-agent changes.
 *
 *   spawn(id)              — new agent enters (walk in from a door)
 *   despawn(id)            — left the snapshot / recent window (walk out / fade)
 *   moveRoom(id, zone)     — zone changed → walk to the new zone
 *   activity(id, …)        — same zone, activity/active changed → swap animation
 *   say(id, text)          — recentMessages tail changed → speech bubble
 */
import type { Activity } from '../api/types';
import type { AgentState, WorldState } from './worldStore';
import type { ZoneId } from './zoneMap';
import type { Look } from './look';

export type Intent =
  | { kind: 'spawn'; id: string; zone: ZoneId; activity: Activity; active: boolean; look: Look }
  | { kind: 'despawn'; id: string }
  | { kind: 'moveRoom'; id: string; zone: ZoneId; activity: Activity }
  | { kind: 'activity'; id: string; activity: Activity; active: boolean }
  | { kind: 'say'; id: string; text: string };

function spawnIntent(a: AgentState): Intent {
  return {
    kind: 'spawn',
    id: a.id,
    zone: a.zone,
    activity: a.activity,
    active: a.active,
    look: a.look,
  };
}

export function diffWorlds(prev: WorldState, next: WorldState): Intent[] {
  const intents: Intent[] = [];

  // 1) Despawns — anything in prev but not in next.
  for (const id of prev.agents.keys()) {
    if (!next.agents.has(id)) intents.push({ kind: 'despawn', id });
  }

  // 2) Spawns + 3) per-agent changes.
  for (const [id, a] of next.agents) {
    const before = prev.agents.get(id);
    if (!before) {
      intents.push(spawnIntent(a));
      if (a.say) intents.push({ kind: 'say', id, text: a.say });
      continue;
    }

    if (before.zone !== a.zone) {
      intents.push({ kind: 'moveRoom', id, zone: a.zone, activity: a.activity });
    } else if (before.activity !== a.activity || before.active !== a.active) {
      // Same zone: just update the animation (idle/work) and active glow.
      intents.push({ kind: 'activity', id, activity: a.activity, active: a.active });
    }

    if (a.say && a.say !== before.say) {
      intents.push({ kind: 'say', id, text: a.say });
    }
  }

  return intents;
}
