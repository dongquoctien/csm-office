/**
 * Ambient day/night cycle (research: composite a full-screen MULTIPLY tint over
 * the world, then ADD-blend light blobs so lamps/windows punch back at night).
 *
 * Two ambient layers, because "it's night outside but the office lights are on":
 *   - OUTDOOR tint goes the full curve → deep indigo at night (cool, never black).
 *   - INTERIOR tint is weaker + warmer (rooms stay legible/cozy under their lamps).
 * Light blobs (ADD) over lamps/windows/fountain fade IN as night falls.
 *
 * One continuous per-channel lerp over a ~6 min cycle. prefers-reduced-motion →
 * pick the phase from the wall clock once, no tween. Pure Phaser; no SSE.
 * Depth sits above the scene but the DOM HUD (src/hud) naturally stays on top.
 */
import Phaser from 'phaser';
import { ALL_ZONES, OUTDOOR, WORLD_W, WORLD_H, type Rect } from './zones';
import { nightLights, setNightFactor } from './nightLights';

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const CYCLE_MS = 360_000; // full day→night→day loop (ambient viewer)
const TINT_DEPTH = 80; // above all scene sprites; DOM HUD is above the canvas
// ADD light blobs sit ABOVE the tint so lamps/windows punch back through the
// darkness (research: draw world → multiply/darken → add lights on top).
const LIGHT_DEPTH = 82;

// Phase keyframes at normalized cycle time t∈[0,1). NORMAL-blend overlays (a
// color + alpha) — reliable across renderers, unlike a MULTIPLY GameObject. Each
// phase gives the outdoor + interior overlay (color, alpha) and a 0..1 "night
// factor" driving the ADD light blobs. Outdoor goes deep indigo; interior stays
// warmer + weaker (the office "has its lights on").
interface Layer {
  c: number;
  a: number;
}
interface Phase {
  t: number;
  outdoor: Layer;
  interior: Layer;
  night: number;
}
const DAY: Layer = { c: 0x000000, a: 0 };
const PHASES: Phase[] = [
  { t: 0.0, outdoor: DAY, interior: DAY, night: 0.0 }, // day
  { t: 0.4, outdoor: DAY, interior: DAY, night: 0.0 }, // day (hold)
  { t: 0.52, outdoor: { c: 0xff8c3c, a: 0.2 }, interior: { c: 0xff9a4a, a: 0.1 }, night: 0.35 }, // dusk
  { t: 0.62, outdoor: { c: 0x141840, a: 0.46 }, interior: { c: 0x24306a, a: 0.24 }, night: 1.0 }, // night
  { t: 0.88, outdoor: { c: 0x141840, a: 0.46 }, interior: { c: 0x24306a, a: 0.24 }, night: 1.0 }, // night hold
  { t: 0.96, outdoor: { c: 0x6a6ab0, a: 0.18 }, interior: { c: 0x8a7ab0, a: 0.08 }, night: 0.3 }, // dawn
  { t: 1.0, outdoor: DAY, interior: DAY, night: 0.0 }, // back to day
];

function lerpHex(a: number, b: number, f: number): number {
  const ar = (a >> 16) & 0xff,
    ag = (a >> 8) & 0xff,
    ab = a & 0xff;
  const br = (b >> 16) & 0xff,
    bg = (b >> 8) & 0xff,
    bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * f) << 16) |
    (Math.round(ag + (bg - ag) * f) << 8) |
    Math.round(ab + (bb - ab) * f)
  );
}
function lerpLayer(a: Layer, b: Layer, f: number): Layer {
  return { c: lerpHex(a.c, b.c, f), a: a.a + (b.a - a.a) * f };
}

/** Sample the phase table at normalized time t (continuous lerp). */
function sample(t: number): { outdoor: Layer; interior: Layer; night: number } {
  for (let i = 0; i < PHASES.length - 1; i++) {
    const a = PHASES[i];
    const b = PHASES[i + 1];
    if (t >= a.t && t <= b.t) {
      const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      return {
        outdoor: lerpLayer(a.outdoor, b.outdoor, f),
        interior: lerpLayer(a.interior, b.interior, f),
        night: a.night + (b.night - a.night) * f,
      };
    }
  }
  return { outdoor: DAY, interior: DAY, night: 0 };
}

export function createDayNight(scene: Phaser.Scene): void {
  // ── ambient tint layers (NORMAL blend, color + alpha) ──────────────────────
  // Initialise with fillAlpha=1 so the Rectangle's `isFilled` flag is true, then
  // drive the actual strength via fillAlpha in `apply` (a Rectangle created with
  // alpha 0 stays isFilled=false and never draws even after setFillStyle).
  const outdoorTint = scene.add
    .rectangle(OUTDOOR.x, OUTDOOR.y, OUTDOOR.w, OUTDOOR.h, 0x000000, 1)
    .setOrigin(0, 0)
    .setDepth(TINT_DEPTH);
  // interior = the whole world (the outdoor notch is re-darkened by outdoorTint
  // on top, so the office reads warmer/lighter than the park at night).
  const interiorTint = scene.add
    .rectangle(0, 0, WORLD_W, WORLD_H, 0x000000, 1)
    .setOrigin(0, 0)
    .setDepth(TINT_DEPTH - 0.1);

  // ── night lights (ADD, ABOVE the tint) — fade in with the night factor ──────
  // Room glow = a broad faint ELLIPSE matching the rectangular room (a radial
  // gradient looked like an odd round spot in a rectangle). Created fillAlpha 1
  // (isFilled=true); apply() drives the alpha.
  const roomGlows = ALL_ZONES.map((z) => {
    const inr: Rect = z.inner;
    return scene.add
      .ellipse(inr.x + inr.w / 2, inr.y + inr.h / 2, inr.w * 0.92, inr.h * 0.72, 0xffe6b0, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(LIGHT_DEPTH);
  });
  const ROOM_GLOW_A = 0.12;
  // (The PARK lamp posts register their own glows in outdoor.ts, already above
  // the tint so they punch through the night darkness like real lamps.)

  const apply = (t: number): void => {
    const s = sample(t);
    // fillAlpha (2nd arg) is the channel that actually tints; isFilled stays true.
    outdoorTint.setFillStyle(s.outdoor.c, s.outdoor.a);
    interiorTint.setFillStyle(s.interior.c, s.interior.a);
    for (const rg of roomGlows) rg.setFillStyle(0xffe6b0, ROOM_GLOW_A * s.night);
    for (const nl of nightLights()) nl.setIntensity(s.night);
    setNightFactor(s.night); // broadcast so the pets know to go home / wake up
  };

  if (reduceMotion) {
    // static: derive a phase from the wall clock (e.g. evening → dusk-ish).
    const hour = new Date().getHours();
    const t = hour >= 19 || hour < 6 ? 0.7 : hour >= 17 ? 0.52 : 0.2;
    apply(t);
    return;
  }

  // continuous loop driven off the scene clock (no Date in the render path).
  let elapsed = 0;
  apply(0);
  scene.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, dms: number) => {
    elapsed = (elapsed + dms) % CYCLE_MS;
    apply(elapsed / CYCLE_MS);
  });
}
