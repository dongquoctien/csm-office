/**
 * Slot allocator (PLAN.md §4.5, ported from the csm MVP). Assigns each agent a
 * non-overlapping slot within its activity sub-spot; round-robin reuse when a
 * sub-spot overflows, and a logged warning instead of silent stacking.
 *
 * Pure bookkeeping — no Phaser. Keyed by `${zone}:${activity}`.
 */
import type { Activity } from '../api/types';
import type { Slot } from './zones';
import { subspotFor } from './zones';
import type { ZoneId } from '../store/zoneMap';

interface Pool {
  slots: Slot[];
  /** agent id occupying each slot index (or null). */
  occupants: (string | null)[];
  /** round-robin cursor for overflow reuse. */
  cursor: number;
}

export class SlotManager {
  private pools = new Map<string, Pool>();
  private placement = new Map<string, string>(); // agentId -> poolKey:index
  private overflowed = new Set<string>();

  private key(zone: ZoneId, activity: Activity): string {
    return `${zone}:${activity}`;
  }

  private pool(zone: ZoneId, activity: Activity): Pool {
    const k = this.key(zone, activity);
    let p = this.pools.get(k);
    if (!p) {
      const ss = subspotFor(zone, activity);
      const slots = ss ? ss.slots : [{ x: 0, y: 0 }];
      p = { slots, occupants: slots.map(() => null), cursor: 0 };
      this.pools.set(k, p);
    }
    return p;
  }

  /** Release any slot the agent currently holds. */
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
   * Place an agent in a free slot of its (zone, activity) sub-spot. If the agent
   * already holds a slot in a different pool, it is released first. Returns the
   * slot coordinates.
   */
  take(agentId: string, zone: ZoneId, activity: Activity): Slot {
    const targetKey = this.key(zone, activity);
    const current = this.placement.get(agentId);
    if (current && !current.startsWith(targetKey + '#')) this.release(agentId);
    else if (current) {
      // Already in the right pool — keep the same slot (stable position).
      const [k, idxStr] = current.split('#');
      return this.pools.get(k)!.slots[Number(idxStr)];
    }

    const p = this.pool(zone, activity);
    let idx = p.occupants.indexOf(null);
    if (idx === -1) {
      // Overflow: reuse round-robin (stacking) and log once per pool.
      idx = p.cursor % p.slots.length;
      p.cursor++;
      if (!this.overflowed.has(targetKey)) {
        this.overflowed.add(targetKey);
        console.warn(
          `[slots] ${targetKey} overflowed (${p.slots.length} slots); agents will stack.`,
        );
      }
    }
    p.occupants[idx] = agentId;
    this.placement.set(agentId, `${targetKey}#${idx}`);
    return p.slots[idx];
  }
}
