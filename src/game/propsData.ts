/**
 * Pure asset DATA (frame indices, keys, palettes) — NO Phaser import, so it can
 * be used by pure modules (zones.ts) and unit tests without dragging in the
 * engine (which references `window`). `assets.ts` re-exports these and adds the
 * Phaser-dependent loaders/texture helpers.
 */

export type FloorKey = 'wood' | 'tile' | 'blue';

export const INDOOR_KEY = 'indoor';
export const INDOOR_PATH = '/assets/indoor.png';
export const INDOOR_TILE = 16;
export const INDOOR_SPACING = 1;

export const CHARS_KEY = 'chars';
export const CHARS_PATH = '/assets/chars.png';
export const CHARS_COLS = 54;

// Kenney "Roguelike/RPG pack" (CC0) — 57-col sheet, 16px + 1px spacing. Source
// of seamless indoor floor tiles (the procedural floor's replacement).
export const RPG_KEY = 'rpg';
export const RPG_PATH = '/assets/rpg.png';
export const RPG_COLS = 57;

// Kenney "Roguelike: Modern City" (CC0) — 37-col PACKED sheet, 16px NO spacing.
// Source of outdoor street tiles: road, grass, cars. Used by outdoor.ts.
export const CITY_KEY = 'city';
export const CITY_PATH = '/assets/city.png';
export const CITY_COLS = 37;
export const CITY_SPACING = 0;

/** Verified city frames (tile-picker). Cars are 2-tile wide (left+right). */
export const CITY = {
  roadPlain: 750,
  roadDashed: 823, // dashed white centre line
  roadYellow: 754, // yellow centre line
  // curb/edge tiles (white line marking road border on asphalt)
  edgeTop: 795,
  edgeBottom: 869,
  edgeLeft: 829,
  edgeRight: 831,
  crosswalk: 760, // zebra stripes
  sidewalk: 945, // light paneled pavement
  grass: 933,
  // static street furniture (park decor)
  lampPost: 600, // wooden lamp post
  crate: 676, // fruit market crate (static detail)
} as const;

/** Floor tile frame per zone, from the RPG sheet (verified indices). */
export const FLOOR_FRAME: Record<FloorKey, number> = {
  wood: 119, // parquet wood
  tile: 121, // cream tile
  blue: 120, // grey tile (blue tint wash applied by the scene)
};

/**
 * Curated "fully-dressed" character frames from Kenney roguelike-characters
 * (CC0). Picked deterministically per session id so avatars stay stable and
 * varied.
 */
export const CHAR_FRAMES = [270, 271, 324, 325, 378, 379, 432, 433, 486, 487, 540, 541] as const;

/** Named prop frames in the INDOOR sheet (verified via tile-picker). */
export const PROPS = {
  // plants / small decor
  plant: 16,
  plant2: 17,
  lamp: 127,
  // desks / work surfaces (read as monitor desks)
  deskItems: 112,
  deskItems2: 113,
  deskItems3: 114,
  deskWood: 365,
  // seating (chairs by facing)
  chairDown: 83,
  chairUp: 110,
  chairLeft: 137,
  chairRight: 56,
  // tables
  tableSmall: 0,
  tableRound: 4,
  tableLong: 166,
  sideTable: 4, // small round side table for nooks (distinct from cabinet)
  // lounge seating (decor clusters)
  armchair: 110, // armchair (faces near side)
  sofa: 243, // upholstered orange sofa (verified — 216 was a fridge)
  // bookshelves (free-standing stacks on the floor; pixel prop preferred)
  bookshelf: 54,
  bookshelf2: 54,
  bookshelf3: 54,
  // wall-anchored storage / appliances
  cabinet: 54,
  counter: 356,
  fridge: 241,
  stove: 392,
  // wall art
  wallArtTeal: 397,
  wallArtMap: 398,
  framedGreen: 451,
  framedOrange: 452,
  framedTeal: 453,
  // rugs (define sub-zones)
  rugOrange: 217,
  rugOrangeRound: 220,
  rugGreen: 278,
  rugGreenRound: 281,
} as const;

export type PropName = keyof typeof PROPS;

/**
 * INDOOR sheet is 27 columns wide. Some furniture is 2 tiles TALL (the desk
 * monitors: the listed frame is the lower half; the upper half is `frame - 27`).
 * These props must draw their top tile one tile above, or they look "cut off".
 */
export const INDOOR_COLS = 27;
export const TALL_PROPS = new Set<PropName>(['deskItems', 'deskItems2', 'deskItems3']);

/** Named prop frames in the RPG sheet (wall-mounted decor). */
export const RPG_PROPS = {
  bookshelf: 842,
  bookshelf2: 845,
  bookshelf3: 848,
  framedPic: 956,
  framedPic2: 1013,
  plantBush: 1355,
  plantBush2: 1412,
  windowWood: 40,
  bannerOrange: 49,
  bannerTeal: 220,
  bannerGreen: 448,
} as const;

export type RpgPropName = keyof typeof RPG_PROPS;
