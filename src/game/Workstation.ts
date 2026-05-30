/**
 * Procedural pixel workstation (desk + computer monitor), authored with the
 * pixel-art DSL (src/game/pixel) per the project skill: limited palette,
 * hue-shifted ramps, one light direction (top-left), dark glass screen with a
 * specular streak, contact-grounded. Baked once into a cached texture.
 *
 * Drawn as a pixel grid where each char is a palette key:
 *   . transparent   K bezel-dark   k bezel-mid   h bezel-hilite (top-left light)
 *   S screen glass   s screen reflection (specular)   T desk top   t desk shade
 *   L desk lip light   l leg
 * Screen glass centre is exposed via SCREEN so Screen.ts overlays binary FX.
 */
import Phaser from 'phaser';
import { bakeSprite, hueShift, type PixelMap } from './pixel';

// 14 wide × 16 tall grid (×2 in-scene → 28×32). Light from top-left.
const GRID = [
  '..hhhhhhhhhh..', // bezel top (lit edge)
  '.hKSSSSSSSSKk.',
  '.hKSSSSSSSSKk.',
  '.hKSsSSSSSSKk.', // specular dab top-left of glass
  '.hKSSSSSSSSKk.',
  '.hKSSSSSSSSKk.',
  '.hKSSSSSSSSKk.',
  '.kKKKKKKKKKKk.', // bezel bottom (shaded)
  '......KK......', // monitor stand
  '.....kKKk.....', // stand base
  '..TTTTTTTTTT..', // desk top lip (lit)
  '.LTTTTTTTTTTt.',
  '.tTTTTTTTTTTt.',
  '.tttttttttttt.', // desk front edge (shaded)
  '..l........l..', // legs
  '..l........l..',
];

// Palette keys → hex. Built from ramps + hue-shift so it obeys the skill rules.
const SCREEN_GLASS = '#0a1410';
const BEZEL = '#26262b';
const WOOD = '#8a5a34';
const MAP: PixelMap = {
  '.': null,
  K: BEZEL,
  k: hueShift(BEZEL, -1), // shaded bezel side/bottom
  h: hueShift(BEZEL, 1), // lit bezel top/left
  S: SCREEN_GLASS,
  s: '#1d4a40', // faint specular reflection on glass
  T: WOOD,
  t: hueShift(WOOD, -1), // desk shade
  L: hueShift(WOOD, 1), // desk lit lip
  l: '#5a3d22', // legs (darkest wood)
};

const TEX_KEY = 'gen:workstation';
const PX = 2; // each grid cell → 2×2 px

/** Screen-glass centre offset (from sprite bottom, origin 0.5,1) for the FX. */
export const SCREEN = {
  cx: 0,
  // glass spans grid rows 1..6 (centre row ~3.5); sprite is 16 rows tall.
  cy: -(16 - 3.5) * PX, // ≈ -25 px above the bottom
  w: 10 * PX,
  h: 6 * PX,
};

export function ensureWorkstation(scene: Phaser.Scene): string {
  return bakeSprite(scene, TEX_KEY, GRID, MAP, { px: PX });
}

export const WORKSTATION_W = GRID[0].length * PX;
export const WORKSTATION_H = GRID.length * PX;
