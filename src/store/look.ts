/**
 * Deterministic avatar look (PLAN.md §4.4) — clean-room port of the csm MVP's
 * id-hash approach (reference: csm packages/ui/public/app.js). Re-implemented
 * here by hand; NOT imported from csm (PLAN.md §3.0).
 *
 * Same session id → same character across reconnects. Returns a plain descriptor
 * of color/feature indices; the Phaser layer turns it into tints/frames. No DOM
 * or Phaser imports — keep this pure so it stays Vitest-friendly.
 */

/** FNV-1a 32-bit. Stable across runtimes. */
export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Palettes ported verbatim from the MVP — contrast-balanced, tied to room colors.
export const SKIN = [
  '#ffdbac',
  '#f2c9a0',
  '#e8b088',
  '#d99a6c',
  '#c1855a',
  '#8d5a3c',
  '#6b4423',
] as const;

export const HAIR = [
  '#2b2620',
  '#4a2f1a',
  '#5a3a22',
  '#8d5a3c',
  '#b06a2c',
  '#c08a4a',
  '#d4b483',
  '#9a9286',
  '#cfcfcf',
  '#3a3550',
  '#7a3b5d',
] as const;

export const SHIRT = [
  '#d97757',
  '#7fc8a0',
  '#c08adb',
  '#e0a458',
  '#5b8def',
  '#5fae8c',
  '#c25d6b',
  '#6b7280',
  '#3a3550',
  '#b0894a',
] as const;

export const HAT = ['#d97757', '#7fc8a0', '#c08adb', '#e0a458', '#5b8def', '#e06a5a'] as const;

/** Facial-feature ink color (eyes/mouth/brows). */
export const INK = '#2b2620';

const MASC_HAIR = ['short', 'sidePart', 'buzz', 'curly', 'bald'] as const;
const FEMI_HAIR = ['long', 'ponytail', 'bob', 'curly', 'sidePart'] as const;

export type HairStyle = (typeof MASC_HAIR)[number] | (typeof FEMI_HAIR)[number];

export interface Look {
  skin: string;
  hair: string;
  shirt: string;
  hat: string;
  feminine: boolean;
  hairStyle: HairStyle;
  hasHat: boolean;
  hasGlasses: boolean;
}

/**
 * Derive a stable look from a session id. Bit-shift positions match the MVP
 * exactly so the same id renders the same character.
 */
export function lookFor(id: string): Look {
  const h = hashId(id);
  const bit = (shift: number): number => (h >>> shift) & 1;
  const pick = <T>(arr: readonly T[], shift: number): T => arr[(h >>> shift) % arr.length];

  const feminine = bit(28) === 1;
  const hairStyle = (feminine ? FEMI_HAIR : MASC_HAIR)[(h >>> 9) % 5];
  const hasHat = (h >>> 13) % 10 < 3 && hairStyle !== 'long' && hairStyle !== 'ponytail';
  const hasGlasses = (h >>> 24) % 10 < 3;

  return {
    skin: pick(SKIN, 2),
    hair: pick(HAIR, 5),
    shirt: pick(SHIRT, 21),
    hat: pick(HAT, 17),
    feminine,
    hairStyle,
    hasHat,
    hasGlasses,
  };
}
