/**
 * Outdoor garden/park (bottom-left of the L). A calm, STATIC, composed scene —
 * no moving cars or wandering actors (those read as fake/cluttered). Built from
 * top-down landscape principles (research): varied grass, a path that connects
 * to the road, ONE focal point (fountain), odd-numbered tree clusters at the
 * edges, a planted border hugging the building wall, benches + lamps, scattered
 * flowers, soft shadows under everything, and ~half the lawn left open.
 *
 * The only motion is an optional gentle fountain shimmer (gated on
 * prefers-reduced-motion). Pure Phaser; no SSE. Called from OfficeScene.create.
 */
import Phaser from 'phaser';
import { OUTDOOR, type Rect } from './zones';
import { CITY, CITY_KEY, hasCity } from './assets';

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Lawn palette (4 greens) + path/flower colors.
const GRASS_BASE = 0x4f8a3c;
const GRASS_LIGHT = 0x59963f;
const GRASS_DARK = 0x447c34;
const PATH_FILL = 0xc7b793;
const PATH_EDGE = 0xb09a73;

export function createOutdoor(scene: Phaser.Scene): void {
  const r: Rect = OUTDOOR;

  drawLawn(scene, r);
  const fountain = { x: r.x + r.w * 0.5, y: r.y + r.h * 0.32 };
  drawParkPath(scene, r, fountain); // winding gravel park path (no road)
  drawWallBorder(scene, r); // planted border hugging the building wall (top)
  drawFountain(scene, r, fountain); // focal point
  drawTreesAndProps(scene, r);
  drawSakura(scene, r); // pink cherry-blossom trees
  scatterFlowers(scene, r);
  if (!reduceMotion) {
    spawnPetals(scene, r); // blossom petals drifting on the wind
    spawnCat(scene, r); // one black cat that hops around the park
  }
}

// ── Lawn: varied grass (not a flat rectangle) ────────────────────────────────
function drawLawn(scene: Phaser.Scene, r: Rect): void {
  scene.add.rectangle(r.x, r.y, r.w, r.h, GRASS_BASE, 1).setOrigin(0, 0).setDepth(0);
  const g = scene.add.graphics().setDepth(0.02);
  for (let gx = r.x; gx < r.x + r.w; gx += 24) {
    for (let gy = r.y; gy < r.y + r.h; gy += 24) {
      const k = (gx * 7 + gy * 13) % 5;
      if (k === 0) g.fillStyle(GRASS_LIGHT, 1).fillRect(gx, gy, 14, 14);
      else if (k === 1) g.fillStyle(GRASS_DARK, 0.8).fillRect(gx + 6, gy + 4, 10, 8);
    }
  }
}

// ── Winding gravel park path (replaces the road) ─────────────────────────────
// A soft curved walkway from the building door → around the fountain → looping
// to the lower-left, drawn as a smooth gravel ribbon (no asphalt, no lane
// markings). Curve is a Catmull-Rom spline sampled into overlapping discs.
function drawParkPath(scene: Phaser.Scene, r: Rect, fountain: { x: number; y: number }): void {
  const W = 22; // path half-handled via disc radius
  const pts: { x: number; y: number }[] = [
    { x: r.x + r.w * 0.32, y: r.y - 4 }, // enters from the building door (top)
    { x: r.x + r.w * 0.34, y: r.y + r.h * 0.18 },
    { x: fountain.x - 70, y: fountain.y + 36 }, // sweeps past the fountain
    { x: fountain.x + 10, y: r.y + r.h * 0.62 },
    { x: r.x + r.w * 0.5, y: r.y + r.h * 0.82 },
    { x: r.x + r.w * 0.16, y: r.y + r.h - 18 }, // ends at the lower-left
  ];
  const curve = new Phaser.Curves.Spline(pts.flatMap((p) => [p.x, p.y]));
  const n = 90;
  const gravel = scene.add.graphics().setDepth(0.06);
  const edge = scene.add.graphics().setDepth(0.055);
  for (let i = 0; i <= n; i++) {
    const p = curve.getPoint(i / n);
    edge.fillStyle(PATH_EDGE, 1).fillCircle(p.x, p.y, W / 2 + 2); // soft border
    gravel.fillStyle(PATH_FILL, 1).fillCircle(p.x, p.y, W / 2); // gravel fill
  }
  // speckle the gravel with a few darker pebbles for texture.
  const peb = scene.add.graphics().setDepth(0.065);
  peb.fillStyle(0xb09a73, 0.7);
  for (let i = 2; i < n; i += 3) {
    const p = curve.getPoint(i / n);
    peb.fillCircle(p.x + ((i * 7) % 9) - 4, p.y + ((i * 5) % 9) - 4, 1.4);
  }
}

// ── Planted border (hedge) hugging the building wall along the top edge ──────
function drawWallBorder(scene: Phaser.Scene, r: Rect): void {
  const g = scene.add.graphics().setDepth(0.5);
  for (let x = r.x + 8; x < r.x + r.w - 8; x += 22) {
    if (x > r.x + r.w * 0.28 && x < r.x + r.w * 0.36) continue; // gap for the path
    g.fillStyle(0x000000, 0.18).fillEllipse(x, r.y + 14, 22, 7);
    g.fillStyle(0x356b30, 1).fillRoundedRect(x - 11, r.y + 2, 22, 12, 5);
    g.fillStyle(0x3f7d3a, 1).fillRoundedRect(x - 9, r.y, 18, 8, 4);
  }
}

// ── Focal point: a fountain with a spouting water jet + falling droplets ─────
function drawFountain(scene: Phaser.Scene, _r: Rect, at: { x: number; y: number }): void {
  const fx = at.x;
  const fy = at.y;
  scene.add.ellipse(fx, fy + 8, 64, 22, 0x000000, 0.18).setDepth(0.9);
  // stone basin
  scene.add.ellipse(fx, fy, 60, 30, 0x8b8676, 1).setDepth(1);
  scene.add.ellipse(fx, fy, 50, 24, 0x6f6a5c, 1).setDepth(1.01);
  // water surface
  const water = scene.add.ellipse(fx, fy, 40, 18, 0x4a86c4, 1).setDepth(1.02);
  scene.add.ellipse(fx, fy - 1, 22, 9, 0x6ba3da, 1).setDepth(1.03);
  // centre pedestal
  scene.add.rectangle(fx, fy - 6, 5, 14, 0x8b8676, 1).setDepth(1.04);

  if (reduceMotion) {
    // static jet representation when motion is off.
    scene.add.rectangle(fx, fy - 18, 4, 18, 0xbfe2f5, 0.85).setDepth(1.2);
    return;
  }

  // gentle surface shimmer.
  scene.tweens.add({
    targets: water,
    scaleX: 1.08,
    scaleY: 1.12,
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });

  drawFountainJet(scene, fx, fy);
}

/** Vertical jet column + arcing droplets that fall back into the basin. */
function drawFountainJet(scene: Phaser.Scene, fx: number, fy: number): void {
  const topY = fy - 26; // jet apex above the pedestal
  // The column: a thin tapered stream that pulses height.
  const column = scene.add.ellipse(fx, fy - 14, 5, 26, 0xcdeafb, 0.85).setDepth(1.2);
  scene.tweens.add({
    targets: column,
    scaleY: 1.18,
    y: fy - 16,
    duration: 700,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });
  // a soft splash glow where the jet meets the surface.
  const splash = scene.add.ellipse(fx, fy - 2, 16, 6, 0xeaf6ff, 0.5).setDepth(1.18);
  scene.tweens.add({
    targets: splash,
    scaleX: 1.4,
    alpha: 0.2,
    duration: 700,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });

  // Arcing droplets: spawn at the apex, fly out + fall into the basin, loop.
  const DROPS = 8;
  let seed = 13;
  const rnd = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < DROPS; i++) {
    const drop = scene.add.circle(fx, topY, 1.6, 0xbfe2f5, 0.95).setDepth(1.21);
    const fly = (): void => {
      const dir = rnd() < 0.5 ? -1 : 1;
      const spread = 16 + rnd() * 16;
      const dur = 850 + rnd() * 350;
      drop.setPosition(fx, topY).setAlpha(0.95);
      // horizontal drift out from the apex.
      scene.tweens.add({ targets: drop, x: fx + dir * spread, duration: dur, ease: 'Linear' });
      // parabola: up a touch then down into the basin (separate Y tween + fade).
      scene.tweens.add({
        targets: drop,
        y: fy - 2,
        duration: dur,
        ease: 'Quad.in',
        delay: i * 90,
        onComplete: () => {
          drop.setAlpha(0);
          scene.time.delayedCall(120 + rnd() * 260, fly);
        },
      });
    };
    fly();
  }
}

// ── Trees (odd clusters, varied sizes, framing the corners) + benches/lamps ──
function drawTreesAndProps(scene: Phaser.Scene, r: Rect): void {
  // bottom-left corner: a cluster of 3 (small/medium/large).
  tree(scene, r.x + 40, r.y + r.h - 40, 1.4);
  tree(scene, r.x + 78, r.y + r.h - 30, 1.0);
  tree(scene, r.x + 30, r.y + r.h - 76, 0.8);
  // a lone large tree mid-left (focal-ish, not clumped).
  tree(scene, r.x + r.w * 0.18, r.y + r.h * 0.42, 1.6);
  // right-side grass corner.
  tree(scene, r.x + r.w * 0.82, r.y + r.h - 40, 1.3);
  tree(scene, r.x + r.w * 0.9, r.y + r.h - 70, 0.9);

  // benches facing the fountain, beside the path.
  bench(scene, r.x + r.w * 0.4, r.y + r.h * 0.34);
  bench(scene, r.x + r.w * 0.22, r.y + r.h * 0.6);
  // lamp posts along the path.
  lamp(scene, r.x + r.w * 0.26, r.y + r.h * 0.22);
  lamp(scene, r.x + r.w * 0.5, r.y + r.h * 0.5);
  // a static market crate near the building (story detail).
  if (hasCity(scene)) {
    scene.add
      .image(r.x + r.w * 0.62, r.y + 30, CITY_KEY, CITY.crate)
      .setOrigin(0.5, 0.8)
      .setScale(1.6)
      .setDepth(0.55);
  }
}

function tree(scene: Phaser.Scene, x: number, y: number, scale: number): void {
  scene.add
    .ellipse(x, y + 10 * scale, 26 * scale, 9 * scale, 0x000000, 0.22)
    .setDepth(0.9 + y / 2000);
  const g = scene.add.graphics().setDepth(1 + y / 2000);
  g.fillStyle(0x5a3d22, 1).fillRect(x - 3 * scale, y, 6 * scale, 14 * scale); // trunk
  g.fillStyle(0x2f6b2c, 1).fillCircle(x, y - 6 * scale, 15 * scale); // canopy shadow
  g.fillStyle(0x3f8a38, 1).fillCircle(x - 2 * scale, y - 9 * scale, 13 * scale); // mid
  g.fillStyle(0x55a84a, 1).fillCircle(x - 5 * scale, y - 12 * scale, 7 * scale); // highlight
}

function bench(scene: Phaser.Scene, x: number, y: number): void {
  scene.add.ellipse(x, y + 6, 28, 7, 0x000000, 0.2).setDepth(0.9 + y / 2000);
  const g = scene.add.graphics().setDepth(1 + y / 2000);
  g.fillStyle(0x7a5a36, 1).fillRoundedRect(x - 14, y - 4, 28, 8, 2); // seat
  g.fillStyle(0x5e4327, 1).fillRect(x - 14, y - 10, 28, 4); // backrest
  g.fillStyle(0x4a3520, 1)
    .fillRect(x - 12, y + 4, 3, 5)
    .fillRect(x + 9, y + 4, 3, 5); // legs
}

function lamp(scene: Phaser.Scene, x: number, y: number): void {
  if (hasCity(scene)) {
    scene.add.ellipse(x, y + 6, 14, 5, 0x000000, 0.22).setDepth(0.9 + y / 2000);
    scene.add
      .image(x, y, CITY_KEY, CITY.lampPost)
      .setOrigin(0.5, 0.85)
      .setScale(1.6)
      .setDepth(1 + y / 2000);
  }
}

// ── Cherry-blossom (sakura) trees — pink canopy, a soft accent ───────────────
function drawSakura(scene: Phaser.Scene, r: Rect): void {
  // Two sakura: one near the fountain, one framing the right grass corner.
  sakuraTree(scene, r.x + r.w * 0.42, r.y + r.h * 0.5, 1.5);
  sakuraTree(scene, r.x + r.w * 0.66, r.y + r.h * 0.66, 1.2);
}

function sakuraTree(scene: Phaser.Scene, x: number, y: number, scale: number): void {
  scene.add
    .ellipse(x, y + 10 * scale, 30 * scale, 10 * scale, 0x000000, 0.22)
    .setDepth(0.9 + y / 2000);
  const g = scene.add.graphics().setDepth(1 + y / 2000);
  g.fillStyle(0x6b4630, 1).fillRect(x - 3 * scale, y, 6 * scale, 14 * scale); // trunk
  g.fillStyle(0xe48cb4, 1).fillCircle(x, y - 6 * scale, 16 * scale); // blossom shadow
  g.fillStyle(0xf2a8cd, 1).fillCircle(x - 3 * scale, y - 9 * scale, 13 * scale); // mid
  g.fillStyle(0xffc7e0, 1).fillCircle(x - 6 * scale, y - 12 * scale, 7 * scale); // highlight
  // a few darker blossom dabs for texture
  g.fillStyle(0xd87aa6, 1)
    .fillCircle(x + 6 * scale, y - 5 * scale, 3 * scale)
    .fillCircle(x - 1 * scale, y - 14 * scale, 2 * scale);
}

// ── Blossom petals / leaves drifting on the wind (a calm ambient touch) ──────
function spawnPetals(scene: Phaser.Scene, r: Rect): void {
  const COUNT = 14;
  const colors = [0xffc7e0, 0xf2a8cd, 0xe48cb4, 0x9ccf6a];
  let seed = 31;
  const rnd = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < COUNT; i++) {
    const petal = scene.add.ellipse(0, 0, 4, 2.5, colors[i % colors.length], 0.95).setDepth(2.5);
    const drift = (): void => {
      const startX = r.x + rnd() * r.w;
      const startY = r.y - 6;
      petal.setPosition(startX, startY).setAngle(rnd() * 360);
      const dur = 5200 + rnd() * 4200;
      // fall down while sliding sideways (wind), with a gentle spin.
      scene.tweens.add({
        targets: petal,
        y: r.y + r.h + 6,
        x: startX + (rnd() * 120 - 30),
        angle: petal.angle + 220,
        duration: dur,
        ease: 'Sine.inOut',
        delay: rnd() * 6000,
        onComplete: drift,
      });
    };
    drift();
  }
}

// ── One black cat that hops around the park (single, charming, not a crowd) ──
function spawnCat(scene: Phaser.Scene, r: Rect): void {
  const cat = scene.add.container(0, 0).setDepth(2);
  const g = scene.add.graphics();
  // simple top-down black cat: body, head, ears, tail, green eyes.
  g.fillStyle(0x000000, 0.25).fillEllipse(0, 7, 18, 6); // shadow
  g.fillStyle(0x222226, 1).fillEllipse(0, 0, 16, 10); // body
  g.fillStyle(0x222226, 1).fillCircle(7, -3, 5); // head
  g.fillStyle(0x222226, 1).fillTriangle(4, -7, 7, -11, 9, -7).fillTriangle(8, -7, 11, -11, 12, -6); // ears
  g.fillStyle(0x222226, 1).fillEllipse(-10, -2, 8, 3); // tail
  g.fillStyle(0x9be86a, 1).fillCircle(6, -4, 1).fillCircle(9, -4, 1); // eyes
  cat.add(g);

  let seed = 91;
  const rnd = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const hop = (): void => {
    // pick a nearby target on the grass (avoid the road band loosely).
    const tx = r.x + 30 + rnd() * (r.w * 0.6);
    const ty = r.y + 30 + rnd() * (r.h - 70);
    cat.scaleX = tx < cat.x ? -1 : 1; // face travel direction
    // a little hop: move + arc up via a brief scale/!y bounce.
    scene.tweens.add({
      targets: cat,
      x: tx,
      y: ty,
      duration: 600 + rnd() * 500,
      ease: 'Sine.inOut',
      onComplete: () => scene.time.delayedCall(700 + rnd() * 1800, hop),
    });
    // bounce (hop arc) on the graphics child.
    scene.tweens.add({
      targets: g,
      y: -6,
      duration: 300,
      yoyo: true,
      ease: 'Quad.out',
    });
  };
  cat.setPosition(r.x + r.w * 0.3, r.y + r.h * 0.7);
  scene.time.delayedCall(1500, hop);
}

// ── Sparse flower clusters (semi-random, not uniform) ────────────────────────
function scatterFlowers(scene: Phaser.Scene, r: Rect): void {
  const colors = [0xe8d44a, 0xe06a8a, 0xe0e0e0, 0xd97757];
  const g = scene.add.graphics().setDepth(0.5);
  let seed = 7;
  const rnd = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 30; i++) {
    const x = r.x + 20 + rnd() * (r.w - 40);
    const y = r.y + 24 + rnd() * (r.h - 48);
    const c = colors[Math.floor(rnd() * colors.length)];
    g.fillStyle(0x356b30, 1).fillRect(x, y + 2, 1, 3); // stem
    g.fillStyle(c, 1).fillCircle(x, y, 2); // bloom
    g.fillStyle(0xfff2a8, 1).fillCircle(x, y, 0.7); // centre
  }
}

// (Road removed — the park uses a drawn gravel path instead of city road tiles.)
