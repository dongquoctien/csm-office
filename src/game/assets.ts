/**
 * Asset abstraction (PLAN.md Phase 2/4): logical names → real tiles, with a
 * procedural fallback so the scene never blocks on missing art.
 *
 * Real assets: Kenney "Roguelike Indoors" (CC0) — a 16px tilesheet with 1px
 * spacing, loaded as `indoor`. Furniture props are referenced by frame index
 * (verified via the dev tile-picker). Floors stay procedural (they read fine as
 * wood/tile/blue and need no extra art). See ASSETS.md.
 */
import Phaser from 'phaser';

export type FloorKey = 'wood' | 'tile' | 'blue';

export const INDOOR_KEY = 'indoor';
export const INDOOR_PATH = '/assets/indoor.png';
export const INDOOR_TILE = 16;
export const INDOOR_SPACING = 1;

export const CHARS_KEY = 'chars';
export const CHARS_PATH = '/assets/chars.png';
export const CHARS_COLS = 54;

/**
 * Curated "fully-dressed" character frames from Kenney roguelike-characters
 * (CC0). Picked deterministically per session id so avatars stay stable and
 * varied. These are detailed people (hair/clothing), unlike the bare base rows.
 */
export const CHAR_FRAMES = [270, 271, 324, 325, 378, 379, 432, 433, 486, 487, 540, 541] as const;

/**
 * Named prop frames in the indoor sheet (verified indices). Swapping art = point
 * these at a different sheet/frames; no scene logic changes.
 */
export const PROPS = {
  plant: 16,
  plant2: 17,
  lamp: 127,
  deskWood: 365,
  deskItems: 329, // desk with stuff on it (reads as a monitor desk)
  counter: 356,
  fridge: 241,
  stove: 392,
  wallArtTeal: 397,
  wallArtMap: 398,
  framedGreen: 451,
  framedOrange: 452,
  framedTeal: 453,
} as const;

export type PropName = keyof typeof PROPS;

/** Load real tilesheets. Called from the scene's preload(). */
export function preloadAssets(scene: Phaser.Scene): void {
  const cfg = { frameWidth: INDOOR_TILE, frameHeight: INDOOR_TILE, spacing: INDOOR_SPACING };
  scene.load.spritesheet(INDOOR_KEY, INDOOR_PATH, cfg);
  scene.load.spritesheet(CHARS_KEY, CHARS_PATH, cfg);
}

export function hasIndoor(scene: Phaser.Scene): boolean {
  return scene.textures.exists(INDOOR_KEY);
}

export function hasChars(scene: Phaser.Scene): boolean {
  return scene.textures.exists(CHARS_KEY);
}

/** Deterministic character frame for a session (stable across reconnects). */
export function charFrameFor(hash: number): number {
  return CHAR_FRAMES[hash % CHAR_FRAMES.length];
}

/**
 * Floor styling per zone. `wood` = horizontal planks with seams + grain;
 * `tile`/`blue` = tiles with grout lines. Drawn procedurally so it reads like a
 * real floor (not a checkerboard) without an extra asset. Tileable at TILE px.
 */
const FLOOR_STYLE: Record<
  FloorKey,
  { base: number; shade: number; line: number; kind: 'planks' | 'tiles' }
> = {
  wood: { base: 0x9b6a3f, shade: 0x8a5d36, line: 0x6f4a2a, kind: 'planks' },
  tile: { base: 0xe7e2d8, shade: 0xddd6c8, line: 0xc7bfae, kind: 'tiles' },
  blue: { base: 0x2f5d7c, shade: 0x2a5470, line: 0x244860, kind: 'tiles' },
};

const TILE = 32;

function makeFloorTexture(scene: Phaser.Scene, key: FloorKey): string {
  const texKey = `floor:${key}`;
  if (scene.textures.exists(texKey)) return texKey;
  const { base, shade, line, kind } = FLOOR_STYLE[key];
  const N = 2; // 2x2 cells so planks/grout tile seamlessly
  const W = TILE * N;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(base, 1).fillRect(0, 0, W, W);

  if (kind === 'planks') {
    const plankH = TILE / 2;
    for (let y = 0; y < W; y += plankH) {
      if ((y / plankH) % 2 === 1) g.fillStyle(shade, 1).fillRect(0, y, W, plankH);
      g.fillStyle(line, 0.18).fillRect(0, y + plankH * 0.4, W, 1); // grain
      g.fillStyle(line, 0.6).fillRect(0, y, W, 1); // plank seam
    }
    g.fillStyle(line, 0.4); // staggered board breaks
    for (let y = 0; y < W; y += plankH) {
      const off = (y / plankH) % 2 === 0 ? 0 : TILE;
      g.fillRect((off + TILE) % W, y, 1, plankH);
    }
  } else {
    g.fillStyle(shade, 1);
    g.fillRect(0, 0, TILE, TILE).fillRect(TILE, TILE, TILE, TILE);
    g.fillStyle(line, 0.5);
    for (let i = 0; i <= N; i++) {
      g.fillRect(i * TILE, 0, 1, W).fillRect(0, i * TILE, W, 1);
    }
  }

  g.generateTexture(texKey, W, W);
  g.destroy();
  return texKey;
}

export function ensureFloor(scene: Phaser.Scene, key: FloorKey): string {
  return makeFloorTexture(scene, key);
}
