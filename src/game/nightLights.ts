/**
 * Shared registry of night-time light blobs. Anything that should glow at night
 * (a park lamp post, a window) registers its ADD-blend glow object here; the
 * day/night cycle (dayNight.ts) fades them all in/out with the night factor.
 *
 * Module-level so a fresh scene starts empty — reset() clears it on scene create
 * to avoid leaking objects from a previous (hot-reloaded) scene.
 */
import type Phaser from 'phaser';

export interface NightLight {
  obj: Phaser.GameObjects.GameObject & { setFillStyle?: (c: number, a: number) => unknown };
  color: number;
  baseAlpha: number;
}

const registry: NightLight[] = [];

/** Register a glow object (created with ADD blend) to fade with night. */
export function registerNightLight(obj: NightLight['obj'], color: number, baseAlpha: number): void {
  registry.push({ obj, color, baseAlpha });
}

/** All registered lights (dayNight reads this). */
export function nightLights(): readonly NightLight[] {
  return registry;
}

/** Clear the registry (call once per scene create). */
export function resetNightLights(): void {
  registry.length = 0;
}
