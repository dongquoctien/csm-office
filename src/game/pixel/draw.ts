/**
 * Pixel-grid DSL → cached Phaser texture (the "draw in code, bake once" pattern
 * from the pixel-art skill). Define a sprite as rows of single-char palette
 * keys; bakeSprite() rasterises it 1px-per-char into a nearest-neighbor texture
 * generated ONCE and reused.
 *
 * Example:
 *   const MAP = { '0': PAL.ink, 'G': PAL.green, '.': null };  // '.' = transparent
 *   const GRID = ['.00.', '0GG0', '0GG0', '.00.'];
 *   const key = bakeSprite(scene, 'gen:thing', GRID, MAP);
 *   scene.add.image(x, y, key).setOrigin(0.5, 1);
 *
 * Keep coordinates integer and the texture nearest-filtered (Phaser pixelArt
 * mode handles this globally).
 */
import Phaser from 'phaser';

/** char → hex colour, or null for transparent. */
export type PixelMap = Record<string, string | null>;

export interface BakeOpts {
  /** logical pixel size of each grid cell (default 1; baked texture is grid×px). */
  px?: number;
}

/**
 * Bake a pixel grid into a cached texture; returns the texture key. If the key
 * already exists it is reused (generate-once).
 */
export function bakeSprite(
  scene: Phaser.Scene,
  key: string,
  grid: readonly string[],
  map: PixelMap,
  opts: BakeOpts = {},
): string {
  if (scene.textures.exists(key)) return key;
  const px = opts.px ?? 1;
  const rows = grid.length;
  const cols = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const g = scene.make.graphics({ x: 0, y: 0 });
  for (let r = 0; r < rows; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      const hex = map[row[c]];
      if (!hex) continue; // transparent
      g.fillStyle(parseInt(hex.replace('#', ''), 16), 1);
      g.fillRect(c * px, r * px, px, px);
    }
  }
  g.generateTexture(key, cols * px, rows * px);
  g.destroy();
  return key;
}

/** Width/height (in cells) of a grid, for placement math. */
export function gridSize(grid: readonly string[]): { w: number; h: number } {
  return { w: grid.reduce((m, r) => Math.max(m, r.length), 0), h: grid.length };
}

/**
 * Soft contact/drop shadow ellipse beneath an object — grounds it (top-down
 * skill rule). Returns the created ellipse so callers can depth-sort it.
 */
export function contactShadow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  depth = 0,
): Phaser.GameObjects.Ellipse {
  return scene.add.ellipse(x, y, w, w * 0.32, 0x000000, 0.22).setDepth(depth);
}
