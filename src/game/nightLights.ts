/**
 * Shared night-state hub. Two jobs:
 *   1. A registry of night-time light blobs (lamp posts, windows) that the
 *      day/night cycle (dayNight.ts) fades in/out with the night factor.
 *   2. A tiny pub/sub for the night factor itself, so other ambient systems
 *      (e.g. the park pets going home to sleep at dusk) can react to it without
 *      importing dayNight.
 *
 * Module-level so a fresh scene starts empty — resetNightLights() clears both on
 * scene create to avoid leaking from a previous (hot-reloaded) scene.
 */
/** A night light exposes setIntensity(0..1); dayNight drives it each frame. */
export interface NightLight {
  setIntensity: (k: number) => void;
}

const registry: NightLight[] = [];
const observers: ((night: number) => void)[] = [];

/** Register a soft light (ADD blend) to fade with the night factor. */
export function registerNightLight(light: NightLight): void {
  registry.push(light);
}

/** All registered lights (dayNight reads this). */
export function nightLights(): readonly NightLight[] {
  return registry;
}

/** Subscribe to the night factor (0 = full day, 1 = full night). */
export function onNightChange(cb: (night: number) => void): void {
  observers.push(cb);
}

/** dayNight calls this each frame with the current night factor. */
export function setNightFactor(night: number): void {
  for (const cb of observers) cb(night);
}

/** Clear the registry + observers (call once per scene create). */
export function resetNightLights(): void {
  registry.length = 0;
  observers.length = 0;
}
