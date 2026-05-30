/**
 * Pixel-art helpers (see .claude/skills/pixel-art/SKILL.md). Import from here:
 *   import { PAL, ramp, hueShift, bakeSprite, contactShadow } from './pixel';
 */
export { PAL, RAMPS, RAMP_STEPS, ramp, hueShift, lit, shade } from './palette';
export type { PalName, RampName } from './palette';
export { bakeSprite, contactShadow, gridSize } from './draw';
export type { PixelMap, BakeOpts } from './draw';
