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
  private shareCount = new Map<string, number>(); // poolKey#index -> agents sharing it
  private stackRank = new Map<string, number>(); // agentId -> its fan-out rank

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
    // decrement the shared-seat count so freed fan-out ranks can be reused.
    const shared = this.shareCount.get(placed);
    if (shared) this.shareCount.set(placed, shared - 1);
    this.stackRank.delete(agentId);
    this.placement.delete(agentId);
  }

  /**
   * Place an agent at a free station of its (zone, activity) cluster. If it
   * already holds a station in a different pool, that one is released first.
   * Returns the chosen station (seat point + facing + furniture).
   *
   * Anti-overlap: a station is normally taken by exactly one agent, but when a
   * cluster is full (more agents than stations) extra agents reuse a station —
   * so the seat point is OFFSET by a deterministic fan-out (`fanOffset`) keyed on
   * how many agents already share that slot, so they spread out instead of
   * stacking on the exact same pixel.
   */
  take(agentId: string, zone: ZoneId, activity: Activity): Station {
    const targetKey = this.key(zone, activity);
    const current = this.placement.get(agentId);
    if (current && !current.startsWith(targetKey + '#')) this.release(agentId);
    else if (current) {
      const [k, idxStr] = current.split('#');
      return this.withOffset(
        this.pools.get(k)!.stations[Number(idxStr)],
        this.stackRank.get(agentId) ?? 0,
      );
    }

    const p = this.pool(zone, activity);
    let idx = p.occupants.indexOf(null);
    if (idx === -1) {
      idx = p.cursor % p.stations.length;
      p.cursor++;
      if (!this.overflowed.has(targetKey)) {
        this.overflowed.add(targetKey);
        console.warn(
          `[slots] ${targetKey} overflowed (${p.stations.length} stations); agents fan out around shared seats.`,
        );
      }
    }
    p.occupants[idx] = agentId;
    const placed = `${targetKey}#${idx}`;
    // rank = how many agents already share this exact slot (0 = first/no offset).
    const rank = this.shareCount.get(placed) ?? 0;
    this.shareCount.set(placed, rank + 1);
    this.stackRank.set(agentId, rank);
    this.placement.set(agentId, placed);
    return this.withOffset(p.stations[idx], rank);
  }

  /** Apply a fan-out offset to a station's seat for stacked (overflow) agents. */
  private withOffset(st: Station, rank: number): Station {
    if (rank === 0) return st;
    const [dx, dy] = fanOffset(rank);
    return { ...st, seat: { x: st.seat.x + dx, y: st.seat.y + dy } };
  }
}

/**
 * Deterministic spread for the Nth agent sharing a seat: rings of points around
 * the origin (ring 1 = 6 points at radius 22, ring 2 = 12 at radius 40, …) so
 * overflowing agents form a small huddle instead of overlapping exactly.
 */
function fanOffset(rank: number): [number, number] {
  let n = rank; // rank>=1 here
  let ring = 1;
  let perRing = 6;
  while (n > perRing) {
    n -= perRing;
    ring++;
    perRing += 6;
  }
  const radius = 12 + ring * 12;
  const angle = (2 * Math.PI * (n - 1)) / perRing + ring * 0.5; // stagger rings
  return [Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius * 0.6)];
}
