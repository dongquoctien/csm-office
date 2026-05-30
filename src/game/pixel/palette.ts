/**
 * Pixel-art palette + ramps + hue-shift — the colour discipline from the
 * pixel-art skill (.claude/skills/pixel-art), expressed in code.
 *
 *  - One small shared palette (cohesion).
 *  - Per-material value ramps: ordered dark→light, HUE-SHIFTED (warm toward the
 *    light, cool toward shadow) so shading never looks flat.
 *  - hueShift() lets you derive a lit/shadow variant of any colour by the rule.
 *
 * Pure data + math — no Phaser. Hex strings are '#rrggbb'.
 */

/** Named base palette (Sweetie-16–style, hue-shifted, CC0-spirit). */
export const PAL = {
  ink: '#1a1c2c', // darkest outline / shadow anchor
  wineDark: '#5d275d',
  red: '#b13e53',
  orange: '#ef7d57',
  gold: '#ffcd75',
  limeLight: '#a7f070',
  green: '#38b764',
  teal: '#257179',
  navy: '#29366f',
  blue: '#3b5dc9',
  sky: '#41a6f6',
  cyan: '#73eff7',
  white: '#f4f4f4',
  steel: '#94b0c2',
  slate: '#566c86',
  slateDark: '#333c57',
} as const;

export type PalName = keyof typeof PAL;

/**
 * Per-material value ramps (dark → light), hue-shifted along the ramp. Pick the
 * next index to shade; index 0 = core shadow, last = highlight.
 */
export const RAMPS = {
  skin: ['#8d5a3c', '#c1855a', '#e8b088', '#ffdbac'],
  wood: ['#5a3d22', '#6f4a2a', '#8a5a34', '#b0824a'],
  metal: ['#333c57', '#566c86', '#94b0c2', '#d7d2c4'],
  glass: ['#0a1410', '#12302a', '#1c4a40', '#39ff77'], // dark screen → green glow
  foliage: ['#1f5b34', '#2f6b2c', '#3f8a38', '#55a84a'],
  fabricOrange: ['#a63a3a', '#c25d6b', '#e07a5a', '#ef9d6a'],
  stone: ['#333c57', '#566c86', '#8b8676', '#b6b2a2'],
  blueFloor: ['#244860', '#2a5470', '#2f5d7c', '#4a86c4'],
} as const;

export type RampName = keyof typeof RAMPS;

/** Recommended ramp length (steps) for a material — skill default 4. */
export const RAMP_STEPS = 4;

/** Ordered shades for a material ramp (dark → light). */
export function ramp(name: RampName): readonly string[] {
  return RAMPS[name];
}

// ── hue-shift ───────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number): string =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/**
 * Shift a colour for shading per the skill rule: lighten → warm hue shift
 * (toward orange/yellow); darken → cool shift (toward blue/purple).
 *   amount > 0 = lighter/warmer step, amount < 0 = darker/cooler step.
 *   deg = degrees of hue shift per unit (skill default ~20).
 */
export function hueShift(hex: string, amount: number, deg = 20): string {
  const [r, g, b] = hexToRgb(hex);
  let [h, s, l] = rgbToHsl(r, g, b);
  // warm hues sit ~40° (orange); cool shadows ~250° (blue/purple).
  const target = amount > 0 ? 40 : 250;
  const t = Math.min(1, Math.abs(amount));
  // rotate hue toward target, scaled by deg.
  let dh = target - h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  h = (h + (dh > 0 ? 1 : -1) * Math.min(Math.abs(dh), deg) * t + 360) % 360;
  l = Math.max(0, Math.min(1, l + amount * 0.16)); // value step
  s = Math.max(0, Math.min(1, s - Math.abs(amount) * 0.05)); // sat peaks mid
  const [nr, ng, nb] = hslToRgb(h, s, l);
  return rgbToHex(nr, ng, nb);
}

/** Convenience: lit (amount +1) / shadow (amount -1) variants of a colour. */
export const lit = (hex: string): string => hueShift(hex, 1);
export const shade = (hex: string): string => hueShift(hex, -1);
