/**
 * Office layout (PLAN.md "Target structure") — the 3 non-symmetric zones from
 * docs/art-target.jpg, in a fixed world coordinate space. Pure geometry + slot
 * pools; no Phaser imports so it can be unit-reasoned and reused by HUD.
 *
 *   World 1200 x 720 (16:~9.6). Wood Coding zone fills the left; the right
 *   column splits into Kitchen (top) and Meeting/Reading (bottom).
 *
 *   ┌────────────────────────┬───────────────────────┐
 *   │                        │  KITCHEN / BREAK       │
 *   │   CODING (wood)        │  (tile)  idle·waiting  │
 *   │   writing·running·     ├───────────────────────┤
 *   │   searching            │  MEETING / READING     │
 *   │                        │  (blue) reading·       │
 *   │                        │  browsing·think·spawn  │
 *   └────────────────────────┴───────────────────────┘
 *
 * Each zone owns a set of per-activity sub-spots; each sub-spot is a pool of
 * non-overlapping slots an avatar can stand in.
 */
import type { Activity } from '../api/types';
import { ZONE_ACTIVITIES, type ZoneId } from '../store/zoneMap';

export const WORLD_W = 1200;
export const WORLD_H = 720;
const WALL = 8; // wall thickness drawn between zones
const PAD = 28; // inner padding before slots start

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Slot {
  x: number;
  y: number;
}

export interface SubSpot {
  activity: Activity;
  /** Center of the sub-spot label. */
  labelX: number;
  labelY: number;
  slots: Slot[];
}

export interface Zone {
  id: ZoneId;
  rect: Rect;
  floor: 'wood' | 'tile' | 'blue';
  /** A point on the zone boundary the avatars walk through (Phase 3). */
  door: Slot;
  subspots: SubSpot[];
}

/** Zone rectangles. Coding is the big left block; right column is split. */
const CODING_RECT: Rect = { x: 0, y: 0, w: 720, h: WORLD_H };
const KITCHEN_RECT: Rect = { x: 720 + WALL, y: 0, w: WORLD_W - 720 - WALL, h: 300 };
const MEETING_RECT: Rect = {
  x: 720 + WALL,
  y: 300 + WALL,
  w: WORLD_W - 720 - WALL,
  h: WORLD_H - 300 - WALL,
};

/** Build a grid of slots inside a rectangle for one sub-spot. */
function gridSlots(area: Rect, cols: number, rows: number): Slot[] {
  const slots: Slot[] = [];
  const gx = cols > 1 ? area.w / (cols - 1) : 0;
  const gy = rows > 1 ? area.h / (rows - 1) : 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({
        x: area.x + (cols > 1 ? c * gx : area.w / 2),
        y: area.y + (rows > 1 ? r * gy : area.h / 2),
      });
    }
  }
  return slots;
}

/**
 * Split a zone's inner area into N horizontal bands (one per activity sub-spot),
 * each with its own slot grid.
 */
function buildSubspots(zoneRect: Rect, activities: Activity[]): SubSpot[] {
  const inner: Rect = {
    x: zoneRect.x + PAD,
    y: zoneRect.y + PAD + 14, // leave room for a zone title at the top
    w: zoneRect.w - PAD * 2,
    h: zoneRect.h - PAD * 2 - 14,
  };
  const bandH = inner.h / activities.length;
  return activities.map((activity, i) => {
    const band: Rect = { x: inner.x, y: inner.y + i * bandH, w: inner.w, h: bandH };
    // Slot grid sized to the band; 4 columns, 2 rows = 8 slots per sub-spot.
    const slotArea: Rect = {
      x: band.x + 10,
      y: band.y + 22,
      w: band.w - 20,
      h: Math.max(20, band.h - 40),
    };
    return {
      activity,
      labelX: band.x + band.w / 2,
      labelY: band.y + 10,
      slots: gridSlots(slotArea, 4, 2),
    };
  });
}

export const ZONES: Record<ZoneId, Zone> = {
  coding: {
    id: 'coding',
    rect: CODING_RECT,
    floor: 'wood',
    door: { x: CODING_RECT.w - 4, y: WORLD_H / 2 },
    subspots: buildSubspots(CODING_RECT, ZONE_ACTIVITIES.coding),
  },
  kitchen: {
    id: 'kitchen',
    rect: KITCHEN_RECT,
    floor: 'tile',
    door: { x: KITCHEN_RECT.x + 4, y: KITCHEN_RECT.y + KITCHEN_RECT.h / 2 },
    subspots: buildSubspots(KITCHEN_RECT, ZONE_ACTIVITIES.kitchen),
  },
  meeting: {
    id: 'meeting',
    rect: MEETING_RECT,
    floor: 'blue',
    door: { x: MEETING_RECT.x + 4, y: MEETING_RECT.y + MEETING_RECT.h / 2 },
    subspots: buildSubspots(MEETING_RECT, ZONE_ACTIVITIES.meeting),
  },
};

export const ALL_ZONES: Zone[] = [ZONES.coding, ZONES.kitchen, ZONES.meeting];

export function subspotFor(zone: ZoneId, activity: Activity): SubSpot | undefined {
  return ZONES[zone].subspots.find((s) => s.activity === activity);
}
