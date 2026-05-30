/**
 * Walk routing (PLAN.md Phase 3, §4.5) — compute a waypoint path so an avatar
 * walks through doorways and the central corridor instead of cutting through
 * walls. Pure geometry; AgentSprite tweens along the returned points.
 *
 * Layout recap (zones.ts): Coding occupies the left; the right column splits
 * into Kitchen (top) and Meeting (bottom). A vertical corridor sits at the seam
 * between left and right (x ≈ CORRIDOR_X). All cross-zone travel routes via each
 * zone's door, then the corridor.
 */
import { WORLD_H, CORRIDOR_CX } from './zones';
import { ZONES, type Zone } from './zones';
import type { ZoneId } from '../store/zoneMap';

export interface Point {
  x: number;
  y: number;
}

/**
 * Path from a current position in `fromZone` to `target` slot in `toZone`.
 * Same zone → straight line. Cross zone → out our door, along the corridor to
 * the target door's height, in through the target door, then to the slot.
 */
export function routeTo(fromZone: ZoneId, toZone: ZoneId, _from: Point, target: Point): Point[] {
  // `_from` (current position) is implicit — the sprite is already there, so the
  // path begins by walking to our own door. Kept in the signature for clarity at
  // call sites and in case future routing wants the start point.
  if (fromZone === toZone) return [target];

  const a: Zone = ZONES[fromZone];
  const b: Zone = ZONES[toZone];
  const pts: Point[] = [];

  // 1) walk to our own door.
  pts.push({ x: a.door.x, y: a.door.y });
  // 2) step into the hallway at our door height.
  pts.push({ x: CORRIDOR_CX, y: clampY(a.door.y) });
  // 3) travel along the hallway to the target door height.
  pts.push({ x: CORRIDOR_CX, y: clampY(b.door.y) });
  // 4) in through the target door.
  pts.push({ x: b.door.x, y: b.door.y });
  // 5) square off to the slot (move vertically first, then to the slot).
  pts.push({ x: b.door.x, y: target.y });
  pts.push(target);
  return pts;
}

function clampY(y: number): number {
  return Math.max(20, Math.min(WORLD_H - 20, y));
}
