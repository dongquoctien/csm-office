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

/**
 * A static furniture piece sitting on the FLOOR (not a station, no agent) —
 * used to fill the empty mid/lower floor with believable clusters (sofa nook,
 * dining table, reading nook). Optionally draws a rug under it.
 */
export interface FloorProp {
  prop: PropName;
  x: number;
  y: number;
  scale?: number;
  rug?: { prop: PropName; scale: number }; // rug drawn centred under this prop
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
  floorProps: FloorProp[]; // static mid-floor furniture clusters
}

// ── Zone rectangles ────────────────────────────────────────────────────────
// L-shaped office. Left column: Coding (top) over OUTDOOR (bottom). Right
// column (stacked): Kitchen, Read (library), Meeting — Coding & Kitchen share
// the same height (top band), Read & Meeting split the lower band.
const TOP_SPLIT_Y = 360; // Coding & Kitchen bottom edge (equal height)
const READ_SPLIT_Y = 540; // Read bottom edge / Meeting top edge

/**
 * A vertical hallway separates the left column (Coding) from the right column.
 * It has its own floor; every room opens onto it through a doorway. Door
 * openings are this tall (a gap in the side wall).
 */
export const CORRIDOR_W = 48;
export const CORRIDOR_X = 700; // left edge of the hallway
export const CORRIDOR: Rect = { x: CORRIDOR_X, y: 0, w: CORRIDOR_W, h: WORLD_H };
/** Center x of the hallway (where cross-zone routing travels). */
export const CORRIDOR_CX = CORRIDOR_X + CORRIDOR_W / 2;
/** Height of a doorway opening cut into a wall. */
export const DOOR_W = 72;
/** Shared door height for the two top rooms so their doors line up. */
const TOP_DOOR_Y = 180;

const RIGHT_X = CORRIDOR_X + CORRIDOR_W; // 748 — left edge of the right column
const RIGHT_W = WORLD_W - RIGHT_X;
const CODING: Rect = { x: 0, y: 0, w: CORRIDOR_X, h: TOP_SPLIT_Y };
const KITCHEN: Rect = { x: RIGHT_X, y: 0, w: RIGHT_W, h: TOP_SPLIT_Y };
const READ: Rect = { x: RIGHT_X, y: TOP_SPLIT_Y, w: RIGHT_W, h: READ_SPLIT_Y - TOP_SPLIT_Y };
const MEETING: Rect = { x: RIGHT_X, y: READ_SPLIT_Y, w: RIGHT_W, h: WORLD_H - READ_SPLIT_Y };

/** Outdoor ambient street region (bottom-left of the L). Not a Zone. */
export const OUTDOOR: Rect = {
  x: 0,
  y: TOP_SPLIT_Y,
  w: CORRIDOR_X,
  h: WORLD_H - TOP_SPLIT_Y,
};

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
  // Desk monitors are 2 tiles tall (top tile drawn above). Push fy down enough
  // that the full monitor + its top tile clear the wall band (no clip).
  return {
    activity,
    furniture,
    fx: x,
    fy: topY + 46,
    seat: { x, y: topY + 70 },
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
  // One center pod row: desks face UP and the agent stands BELOW the monitor
  // (in front of it) — same orientation as the top-wall row, so nobody appears
  // to lie on top of the computer.
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
      seat: { x, y: podY + 26 }, // stand in front of (below) the desk
      facing: 'up',
    });
  }

  return {
    id: 'coding',
    rect: r,
    inner: inr,
    floor: 'wood',
    // doorway in the RIGHT wall, aligned with Kitchen's door across the hall.
    door: { x: r.x + r.w, y: TOP_DOOR_Y },
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
    floorProps: [
      // breakout nook in the lower-left (fills the empty lower band).
      {
        prop: 'sofa',
        x: inr.x + 70,
        y: inr.y + inr.h - 26,
        scale: 2,
        rug: { prop: 'rugOrange', scale: 2.4 },
      },
      { prop: 'sideTable', x: inr.x + 128, y: inr.y + inr.h - 30, scale: 1.6 },
      { prop: 'plant', x: inr.x + 20, y: inr.y + inr.h - 30, scale: 1.8 },
      // a filing cabinet mid-floor breaking the lower-right emptiness.
      { prop: 'cabinet', x: inr.x + inr.w * 0.7, y: inr.y + inr.h - 26, scale: 1.8 },
    ],
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
    // doorway in the LEFT wall, aligned with Coding's door across the hall.
    door: { x: r.x, y: TOP_DOOR_Y },
    decor: [
      { prop: 'framedPic', sheet: 'rpg', x: inr.x + inr.w - 60, y: r.y + 12, scale: 2 },
      { prop: 'plantBush', sheet: 'rpg', x: inr.x + 16, y: inr.y + inr.h - 16, scale: 2 },
    ],
    stations,
    // Canteen seating: two long bench tables, each with chairs on both long
    // sides (a row layout reads as a cafeteria, not a single dining table).
    floorProps: canteenRows(inr),
  };
}

/** Two long canteen tables with chairs on both sides — the cafeteria look. */
function canteenRows(inr: Rect): FloorProp[] {
  const props: FloorProp[] = [];
  const cx = inr.x + inr.w / 2;
  const rows = [inr.y + inr.h * 0.52, inr.y + inr.h * 0.83];
  for (const ty of rows) {
    // a long table (drawn wide) with two chairs per side, tucked close so the
    // table reads as the bigger piece (chairs hug it, not float).
    props.push({ prop: 'tableLong', x: cx, y: ty, scale: 3 });
    for (const dx of [-30, 30]) {
      props.push({ prop: 'chairDown', x: cx + dx, y: ty - 18, scale: 1.5 });
      props.push({ prop: 'chairUp', x: cx + dx, y: ty + 18, scale: 1.5 });
    }
  }
  return props;
}

// The Read (library) room: perimeter shelves + a free-standing stack with an
// aisle, plus a reading nook. Each 'reading' agent walks to a shelf spot, then
// the scene plays the search→read FX there.
function buildRead(): Zone {
  const r = READ;
  const inr = inner(r);
  const acts = ZONE_ACTIVITIES.read; // reading
  // Reading "stations": spots in front of the shelves where an agent browses.
  const shelfY = inr.y + 18; // just below the top wall (shelves mounted there)
  const spots = 4;
  const gap = inr.w / (spots + 1);
  const stations: Station[] = [];
  for (let i = 0; i < spots; i++) {
    const x = inr.x + gap * (i + 1);
    stations.push({
      activity: acts[0],
      furniture: 'deskWood', // placeholder; reading stations draw no furniture
      fx: x,
      fy: shelfY,
      seat: { x, y: shelfY + 34 }, // stand below the shelf, facing up to browse
      facing: 'up',
    });
  }
  return {
    id: 'read',
    rect: r,
    inner: inr,
    floor: 'wood',
    // doorway in the LEFT wall, opening onto the hallway.
    door: { x: r.x, y: r.y + r.h / 2 },
    rug: { prop: 'rugOrange', x: inr.x + inr.w * 0.72, y: inr.y + inr.h - 30, scale: 2.2 },
    decor: [
      // perimeter shelves line the top wall (the library's reading face).
      { prop: 'bookshelf', sheet: 'rpg', x: inr.x + 70, y: r.y + 12, scale: 2 },
      { prop: 'bookshelf2', sheet: 'rpg', x: inr.x + 200, y: r.y + 12, scale: 2 },
      { prop: 'bookshelf3', sheet: 'rpg', x: inr.x + 330, y: r.y + 12, scale: 2 },
      { prop: 'bookshelf', sheet: 'rpg', x: inr.x + inr.w - 60, y: r.y + 12, scale: 2 },
      { prop: 'plantBush', sheet: 'rpg', x: inr.x + 16, y: inr.y + inr.h - 16, scale: 2 },
    ],
    stations,
    floorProps: [
      // a free-standing shelf stack mid-floor (the "aisle"), left of centre.
      { prop: 'bookshelf2', x: inr.x + inr.w * 0.34, y: inr.y + inr.h * 0.5, scale: 2 },
      // cozy reading nook on the right: armchair + side table + lamp.
      { prop: 'armchair', x: inr.x + inr.w * 0.72, y: inr.y + inr.h - 28, scale: 1.8 },
      { prop: 'sideTable', x: inr.x + inr.w * 0.72 + 40, y: inr.y + inr.h - 32, scale: 1.4 },
      { prop: 'lamp', x: inr.x + inr.w * 0.72 - 38, y: inr.y + inr.h - 34, scale: 1.5 },
    ],
  };
}

function buildMeeting(): Zone {
  const r = MEETING;
  const inr = inner(r);
  const acts = ZONE_ACTIVITIES.meeting; // browsing, thinking, spawning
  // Focal point: a central conference table; agents sit along the LONG sides,
  // the Boss stands at the head (left). The room is short, so the table runs
  // horizontally and seats hug it.
  const cx = inr.x + inr.w / 2 + 14; // nudge right to leave the head (left) for Boss
  const cy = inr.y + inr.h / 2 + 4;
  const stations: Station[] = [];
  const ring: { dx: number; dy: number; facing: Facing }[] = [
    { dx: -34, dy: -26, facing: 'down' },
    { dx: 34, dy: -26, facing: 'down' },
    { dx: -34, dy: 30, facing: 'up' },
    { dx: 34, dy: 30, facing: 'up' },
  ];
  acts.forEach((activity, i) => {
    const slot = ring[i % ring.length];
    stations.push({
      activity,
      furniture: slot.facing === 'up' ? 'chairUp' : 'chairDown',
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
    // doorway in the LEFT wall, opening onto the hallway.
    door: { x: r.x, y: r.y + r.h / 2 },
    rug: { prop: 'rugGreen', x: cx, y: cy + 2, scale: 2.6 },
    decor: [
      // whiteboard/art on the wall behind the head of the table (front of room).
      { prop: 'framedPic2', sheet: 'rpg', x: inr.x + 60, y: r.y + 12, scale: 2 },
      { prop: 'framedPic', sheet: 'rpg', x: inr.x + inr.w - 60, y: r.y + 12, scale: 2 },
      { prop: 'plantBush', sheet: 'rpg', x: inr.x + inr.w - 16, y: inr.y + inr.h - 16, scale: 2 },
    ],
    stations,
    floorProps: [],
  };
}

export const ZONES: Record<ZoneId, Zone> = {
  coding: buildCoding(),
  read: buildRead(),
  kitchen: buildKitchen(),
  meeting: buildMeeting(),
};

export const ALL_ZONES: Zone[] = [ZONES.coding, ZONES.kitchen, ZONES.read, ZONES.meeting];

/** Conference table center for the meeting zone (drawn as a big decor piece). */
export const MEETING_TABLE: Point = {
  x: ZONES.meeting.inner.x + ZONES.meeting.inner.w / 2 + 14,
  y: ZONES.meeting.inner.y + ZONES.meeting.inner.h / 2 + 4,
};

/** Boss NPC stands at the head (left) of the meeting table. */
export const BOSS_SPOT: Point = {
  x: ZONES.meeting.inner.x + 30,
  y: ZONES.meeting.inner.y + ZONES.meeting.inner.h / 2 + 4,
};

/** Stations for a given (zone, activity), in declaration order. */
export function stationsFor(zone: ZoneId, activity: Activity): Station[] {
  return ZONES[zone].stations.filter((s) => s.activity === activity);
}
