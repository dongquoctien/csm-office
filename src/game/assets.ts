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

// Pure data (frame indices, keys, palettes) lives in propsData.ts so pure
// modules + tests don't import Phaser. Re-exported here for existing call sites.
export {
  INDOOR_KEY,
  INDOOR_PATH,
  INDOOR_TILE,
  INDOOR_SPACING,
  CHARS_KEY,
  CHARS_PATH,
  CHARS_COLS,
  RPG_KEY,
  RPG_PATH,
  RPG_COLS,
  CITY_KEY,
  CITY_PATH,
  CITY_COLS,
  CITY_SPACING,
  CITY,
  FLOOR_FRAME,
  CHAR_FRAMES,
  PROPS,
  RPG_PROPS,
} from './propsData';
export type { FloorKey, PropName, RpgPropName } from './propsData';

import {
  CHARS_KEY,
  CHARS_PATH,
  CHAR_FRAMES,
  CITY_KEY,
  CITY_PATH,
  CITY_SPACING,
  FLOOR_FRAME,
  INDOOR_KEY,
  INDOOR_PATH,
  INDOOR_SPACING,
  INDOOR_TILE,
  RPG_COLS,
  RPG_KEY,
  RPG_PATH,
  type FloorKey,
} from './propsData';

/** Load real tilesheets. Called from the scene's preload(). */
export function preloadAssets(scene: Phaser.Scene): void {
  const cfg = { frameWidth: INDOOR_TILE, frameHeight: INDOOR_TILE, spacing: INDOOR_SPACING };
  scene.load.spritesheet(INDOOR_KEY, INDOOR_PATH, cfg);
  scene.load.spritesheet(CHARS_KEY, CHARS_PATH, cfg);
  scene.load.spritesheet(RPG_KEY, RPG_PATH, cfg);
  // City sheet is packed (no spacing) — different frame config.
  scene.load.spritesheet(CITY_KEY, CITY_PATH, {
    frameWidth: INDOOR_TILE,
    frameHeight: INDOOR_TILE,
    spacing: CITY_SPACING,
  });
}

export function hasRpg(scene: Phaser.Scene): boolean {
  return scene.textures.exists(RPG_KEY);
}

export function hasCity(scene: Phaser.Scene): boolean {
  return scene.textures.exists(CITY_KEY);
}

/**
 * Extract a single RPG floor frame into its own gap-free texture so tileSprite
 * can repeat it seamlessly (the source sheet has 1px spacing between tiles,
 * which would otherwise show as seams when tiled). Cached per zone.
 */
function makeRpgFloorTexture(scene: Phaser.Scene, key: FloorKey): string {
  const texKey = `floor:rpg:${key}`;
  if (scene.textures.exists(texKey)) return texKey;
  const frame = FLOOR_FRAME[key];
  const col = frame % RPG_COLS;
  const row = Math.floor(frame / RPG_COLS);
  const src = scene.textures.get(RPG_KEY).getSourceImage() as CanvasImageSource;
  const canvas = scene.textures.createCanvas(texKey, INDOOR_TILE, INDOOR_TILE);
  if (!canvas) return texKey;
  const ctx = canvas.getContext();
  // Draw just the tile body (no spacing) into a tight 16x16 canvas.
  ctx.drawImage(
    src,
    col * (INDOOR_TILE + INDOOR_SPACING),
    row * (INDOOR_TILE + INDOOR_SPACING),
    INDOOR_TILE,
    INDOOR_TILE,
    0,
    0,
    INDOOR_TILE,
    INDOOR_TILE,
  );
  canvas.refresh();
  return texKey;
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
  // Prefer the real Kenney RPG floor tile; fall back to procedural if absent.
  if (hasRpg(scene)) return makeRpgFloorTexture(scene, key);
  return makeFloorTexture(scene, key);
}
