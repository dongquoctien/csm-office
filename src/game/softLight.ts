/**
 * Soft radial light helper (research: a hard-edged solid ellipse reads as a cheap
 * ring; bake ONE radial-gradient texture with an eased alpha falloff to fully
 * transparent at the rim, then reuse it as tinted ADD-blend sprites). Filtered
 * LINEAR (the deliberate exception to the project's NEAREST pixels) so scaling
 * never reintroduces stair-stepped rings.
 *
 * A light = a wide dim HALO + a tighter bright CORE, both fading with the night
 * factor; the halo breathes gently for life (respects prefers-reduced-motion).
 */
import Phaser from 'phaser';

const TEX_KEY = 'gen:softlight';
const TEX_SIZE = 256; // baked once, scaled down per light (never up)

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Bake the white radial-gradient sprite once (eased falloff, transparent rim). */
export function ensureSoftLightTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(TEX_KEY)) return TEX_KEY;
  const cv = scene.textures.createCanvas(TEX_KEY, TEX_SIZE, TEX_SIZE);
  if (!cv) return TEX_KEY;
  const ctx = cv.getContext();
  const c = TEX_SIZE / 2;
  const r = c - 6; // a few px of transparent padding so the rim never clips
  const grad = ctx.createRadialGradient(c, c, 0, c, c, r);
  // eased (front-loaded) alpha so the centre is bright and the last ~30% feathers
  // out — white so it can be tinted to any warm colour at draw time.
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  grad.addColorStop(0.75, 'rgba(255,255,255,0.06)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  cv.refresh();
  cv.setFilter(Phaser.Textures.FilterMode.LINEAR); // smooth — glows are the exception
  return TEX_KEY;
}

export interface SoftLight {
  /** Set the overall brightness (0 = off). Halo+core scale from this. */
  setIntensity: (k: number) => void;
}

/**
 * Place a soft light at (x,y): a wide halo (diameter `size`) + a brighter core.
 * `color` tints both. `depth` should sit above the night tint. Returns a handle
 * whose intensity the caller drives from the day/night night-factor.
 */
export function addSoftLight(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  color: number,
  depth: number,
): SoftLight {
  const key = ensureSoftLightTexture(scene);
  const halo = scene.add
    .image(x, y, key)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(color)
    .setDepth(depth)
    .setDisplaySize(size, size)
    .setAlpha(0);
  const core = scene.add
    .image(x, y, key)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setTint(color)
    .setDepth(depth + 0.01)
    .setDisplaySize(size * 0.5, size * 0.5)
    .setAlpha(0);

  // gentle breathing on the halo only (core stays anchored). ±8% over ~3s.
  let breathe = 1;
  if (!reduceMotion) {
    const state = { k: 1 };
    scene.tweens.add({
      targets: state,
      k: 1.08,
      duration: 3000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
      onUpdate: () => (breathe = state.k),
    });
  }

  const HALO_A = 0.32;
  const CORE_A = 0.6;
  return {
    setIntensity: (k: number): void => {
      halo.setAlpha(Math.min(1, HALO_A * k * breathe));
      core.setAlpha(Math.min(1, CORE_A * k));
    },
  };
}
