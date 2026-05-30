/**
 * Office layout — 3 non-symmetric top-down rooms (docs/art-target.jpg), authored
 * by top-down interior-design principles (research): big furniture HUGS WALLS,
 * shelves/art are WALL-MOUNTED, people sit AT stations, the CENTER stays OPEN,
 * rugs define sub-zones. Pure geometry + station lists; no Phaser imports.
 *
 *   World 1200 x 720. Coding fills the left; the right column splits into
 *   Kitchen (top) and Meeting/Reading (bottom). Each zone has a wall band drawn
 *   with visible height by the scene.
 *
 *   ┌────────────────────────┬───────────────────────┐
 *   │  CODING (wood)         │  KITCHEN/BREAK (tile)  │
 *   │  desks along walls,    │  fridge·counter·stove  │
 *   │  open center           │  along top wall        │
 *   │                        ├───────────────────────┤
 *   │                        │  MEETING/READING(blue) │
 *   │                        │  central table focal   │
 *   └────────────────────────┴───────────────────────┘
 *
 * A "station" is one furniture piece anchored to a wall + a seat point in front
 * where exactly one agent stands. Activities map to clusters of stations.
 */
import type { Activity } from '../api/types';
import { ZONE_ACTIVITIES, type ZoneId } from '../store/zoneMap';
import type { PropName, RpgPropName } from './propsData';

export const WORLD_W = 1200;
export const WORLD_H = 720;

/** Wall band thickness drawn with visible height (cap + face). */
export const WALL_FACE = 22;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Point {
  x: number;
  y: number;
}

export type Facing = 'up' | 'down' | 'left' | 'right';

/** A furniture piece anchored at (x,y) + the seat point an agent stands at. */
export interface Station {
  activity: Activity;
  furniture: PropName; // frame in the indoor sheet
  fx: number; // furniture center x
  fy: number; // furniture center y (origin 0.5,0.8 → sits on floor)
  seat: Point; // where the agent stands (in front of the furniture)
  facing: Facing; // direction the agent faces (toward the furniture)
}

/** A decoration placed on the wall band (bookshelf, art, window). */
export interface WallDecor {
  prop: PropName | RpgPropName;
  sheet: 'indoor' | 'rpg';
  x: number;
  y: number;
  scale?: number;
}

export interface Zone {
  id: ZoneId;
  rect: Rect; // full zone incl. wall band
  inner: Rect; // floor area inside the walls
  floor: 'wood' | 'tile' | 'blue';
  door: Point; // opening agents walk through
  rug?: { prop: PropName; x: number; y: number; scale: number };
  decor: WallDecor[];
  stations: Station[];
}

// ── Zone rectangles ────────────────────────────────────────────────────────
// L-shaped office: Coding (top-left) + Kitchen (top-right) + Meeting (bottom-
// right). The bottom-left notch is the OUTDOOR street (ambient, not a Zone).
const CODING_SPLIT_Y = 360;
const CODING: Rect = { x: 0, y: 0, w: 720, h: CODING_SPLIT_Y };
const KITCHEN: Rect = { x: 720, y: 0, w: WORLD_W - 720, h: 300 };
const MEETING: Rect = { x: 720, y: 300, w: WORLD_W - 720, h: WORLD_H - 300 };

/** Outdoor ambient street region (bottom-left of the L). Not a Zone. */
export const OUTDOOR: Rect = { x: 0, y: CODING_SPLIT_Y, w: 720, h: WORLD_H - CODING_SPLIT_Y };

function inner(r: Rect): Rect {
  return {
    x: r.x + WALL_FACE,
    y: r.y + WALL_FACE,
    w: r.w - WALL_FACE * 2,
    h: r.h - WALL_FACE * 2,
  };
}

// ── Station builders ─────────────────────────────────────────────────────────
// A desk against the TOP wall: furniture tucked under the wall-face, the agent
// stands just below it facing up (toward the monitor) — the classic workstation.
function deskTop(activity: Activity, furniture: PropName, x: number, topY: number): Station {
  // fy pushed below the wall band so the full monitor clears WALL_FACE (no clip).
  return {
    activity,
    furniture,
    fx: x,
    fy: topY + 30,
    seat: { x, y: topY + 58 },
    facing: 'up',
  };
}

// ── Build the three zones ────────────────────────────────────────────────────
function buildCoding(): Zone {
  const r = CODING;
  const inr = inner(r);
  const topY = inr.y;
  const acts = ZONE_ACTIVITIES.coding; // writing, running, searching
  const stations: Station[] = [];

  // Top wall: a row of desks (6), grouped by activity (2 each).
  const cols = 6;
  const gap = inr.w / (cols + 1);
  acts.forEach((activity, ai) => {
    for (let i = 0; i < 2; i++) {
      const col = ai * 2 + i + 1;
      stations.push(deskTop(activity, i % 2 ? 'deskItems2' : 'deskItems', inr.x + gap * col, topY));
    }
  });
  // One center pod row (the room is now short): desks facing down, agents above.
  const podY = inr.y + inr.h * 0.62;
  const podCols = 6;
  const podGap = inr.w / (podCols + 1);
  for (let c = 0; c < podCols; c++) {
    const x = inr.x + podGap * (c + 1);
    stations.push({
      activity: acts[c % acts.length],
      furniture: c % 2 ? 'deskItems3' : 'deskItems',
      fx: x,
      fy: podY,
      seat: { x, y: podY - 22 },
      facing: 'down',
    });
  }

  return {
    id: 'coding',
    rect: r,
    inner: inr,
    floor: 'wood',
    door: { x: r.w - 4, y: r.y + r.h / 2 },
    decor: [
      // bookshelves mounted high on the top wall
      { prop: 'bookshelf', sheet: 'rpg', x: inr.x + 70, y: r.y + 12, scale: 2 },
      { prop: 'bookshelf2', sheet: 'rpg', x: inr.x + 300, y: r.y + 12, scale: 2 },
      { prop: 'bookshelf3', sheet: 'rpg', x: inr.x + 540, y: r.y + 12, scale: 2 },
      // corner plants
      { prop: 'plantBush', sheet: 'rpg', x: inr.x + 16, y: inr.y + inr.h - 16, scale: 2 },
      { prop: 'plantBush2', sheet: 'rpg', x: inr.x + inr.w - 16, y: inr.y + inr.h - 16, scale: 2 },
    ],
    stations,
  };
}

function buildKitchen(): Zone {
  const r = KITCHEN;
  const inr = inner(r);
  const topY = inr.y;
  const acts = ZONE_ACTIVITIES.kitchen; // idle, waiting
  // Appliance line along the top wall: fridge · counter · stove · counter.
  const line: PropName[] = ['fridge', 'counter', 'stove', 'counter', 'cabinet'];
  const gap = inr.w / (line.length + 1);
  const stations: Station[] = line.map((furniture, i) =>
    deskTop(acts[i % acts.length], furniture, inr.x + gap * (i + 1), topY),
  );
  return {
    id: 'kitchen',
    rect: r,
    inner: inr,
    floor: 'tile',
    door: { x: r.x + 4, y: r.y + r.h / 2 },
    rug: { prop: 'rugOrangeRound', x: inr.x + inr.w / 2, y: inr.y + inr.h * 0.66, scale: 2.4 },
    decor: [
      { prop: 'framedPic', sheet: 'rpg', x: inr.x + inr.w - 60, y: r.y + 12, scale: 2 },
      { prop: 'plantBush', sheet: 'rpg', x: inr.x + 16, y: inr.y + inr.h - 16, scale: 2 },
    ],
    stations,
  };
}

function buildMeeting(): Zone {
  const r = MEETING;
  const inr = inner(r);
  const acts = ZONE_ACTIVITIES.meeting; // reading, browsing, thinking, spawning
  // Focal point: a central conference table with chairs around it (the one
  // "floated" cluster). Each surrounding seat is a station.
  const cx = inr.x + inr.w / 2;
  const cy = inr.y + inr.h / 2 + 10;
  const stations: Station[] = [];
  // table is decor (drawn centrally); chairs/seats ring it.
  const ring: { dx: number; dy: number; facing: Facing }[] = [
    { dx: -52, dy: -20, facing: 'right' },
    { dx: 52, dy: -20, facing: 'left' },
    { dx: -52, dy: 28, facing: 'right' },
    { dx: 52, dy: 28, facing: 'left' },
  ];
  acts.forEach((activity, i) => {
    const slot = ring[i % ring.length];
    stations.push({
      activity,
      furniture: slot.facing === 'left' ? 'chairLeft' : 'chairRight',
      fx: cx + slot.dx,
      fy: cy + slot.dy,
      seat: { x: cx + slot.dx, y: cy + slot.dy },
      facing: slot.facing,
    });
  });
  return {
    id: 'meeting',
    rect: r,
    inner: inr,
    floor: 'blue',
    door: { x: r.x + 4, y: r.y + r.h / 2 },
    rug: { prop: 'rugGreen', x: cx, y: cy + 4, scale: 3 },
    decor: [
      { prop: 'bookshelf', sheet: 'rpg', x: inr.x + 80, y: r.y + 12, scale: 2 },
      { prop: 'framedPic2', sheet: 'rpg', x: cx, y: r.y + 12, scale: 2 },
      { prop: 'bookshelf2', sheet: 'rpg', x: inr.x + inr.w - 80, y: r.y + 12, scale: 2 },
      { prop: 'plantBush', sheet: 'rpg', x: inr.x + 16, y: inr.y + inr.h - 16, scale: 2 },
      { prop: 'plantBush2', sheet: 'rpg', x: inr.x + inr.w - 16, y: inr.y + inr.h - 16, scale: 2 },
    ],
    stations,
  };
}

export const ZONES: Record<ZoneId, Zone> = {
  coding: buildCoding(),
  kitchen: buildKitchen(),
  meeting: buildMeeting(),
};

export const ALL_ZONES: Zone[] = [ZONES.coding, ZONES.kitchen, ZONES.meeting];

/** Conference table center for the meeting zone (drawn as a big decor piece). */
export const MEETING_TABLE: Point = {
  x: ZONES.meeting.inner.x + ZONES.meeting.inner.w / 2,
  y: ZONES.meeting.inner.y + ZONES.meeting.inner.h / 2 + 10,
};

/** Stations for a given (zone, activity), in declaration order. */
export function stationsFor(zone: ZoneId, activity: Activity): Station[] {
  return ZONES[zone].stations.filter((s) => s.activity === activity);
}
