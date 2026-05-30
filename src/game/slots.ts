/**
 * Station allocator (ported from the csm MVP slot system). Assigns each agent a
 * non-overlapping wall-anchored station within its activity cluster; round-robin
 * reuse when a cluster overflows, with a logged warning instead of silent
 * stacking. Pure bookkeeping — no Phaser. Keyed by `${zone}:${activity}`.
 */
import type { Activity } from '../api/types';
import type { Station } from './zones';
import { stationsFor } from './zones';
import type { ZoneId } from '../store/zoneMap';

interface Pool {
  stations: Station[];
  /** agent id occupying each station index (or null). */
  occupants: (string | null)[];
  /** round-robin cursor for overflow reuse. */
  cursor: number;
}

export class SlotManager {
  private pools = new Map<string, Pool>();
  private placement = new Map<string, string>(); // agentId -> poolKey#index
  private overflowed = new Set<string>();

  private key(zone: ZoneId, activity: Activity): string {
    return `${zone}:${activity}`;
  }

  private pool(zone: ZoneId, activity: Activity): Pool {
    const k = this.key(zone, activity);
    let p = this.pools.get(k);
    if (!p) {
      const stations = stationsFor(zone, activity);
      const list: Station[] = stations.length
        ? stations
        : [
            {
              activity,
              furniture: 'deskItems',
              fx: 0,
              fy: 0,
              seat: { x: 0, y: 0 },
              facing: 'up',
            },
          ];
      p = { stations: list, occupants: list.map(() => null), cursor: 0 };
      this.pools.set(k, p);
    }
    return p;
  }

  /** Release any station the agent currently holds. */
  release(agentId: string): void {
    const placed = this.placement.get(agentId);
    if (!placed) return;
    const [k, idxStr] = placed.split('#');
    const p = this.pools.get(k);
    const idx = Number(idxStr);
    if (p && p.occupants[idx] === agentId) p.occupants[idx] = null;
    this.placement.delete(agentId);
  }

  /**
   * Place an agent at a free station of its (zone, activity) cluster. If it
   * already holds a station in a different pool, that one is released first.
   * Returns the chosen station (seat point + facing + furniture).
   */
  take(agentId: string, zone: ZoneId, activity: Activity): Station {
    const targetKey = this.key(zone, activity);
    const current = this.placement.get(agentId);
    if (current && !current.startsWith(targetKey + '#')) this.release(agentId);
    else if (current) {
      const [k, idxStr] = current.split('#');
      return this.pools.get(k)!.stations[Number(idxStr)];
    }

    const p = this.pool(zone, activity);
    let idx = p.occupants.indexOf(null);
    if (idx === -1) {
      idx = p.cursor % p.stations.length;
      p.cursor++;
      if (!this.overflowed.has(targetKey)) {
        this.overflowed.add(targetKey);
        console.warn(
          `[slots] ${targetKey} overflowed (${p.stations.length} stations); agents will stack.`,
        );
      }
    }
    p.occupants[idx] = agentId;
    this.placement.set(agentId, `${targetKey}#${idx}`);
    return p.stations[idx];
  }
}
