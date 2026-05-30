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
import { registerNightLight, resetNightLights, onNightChange } from './nightLights';
import { addSoftLight } from './softLight';

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
  resetNightLights(); // fresh registry per scene (lamps re-register below)

  drawLawn(scene, r);
  const fountain = { x: r.x + r.w * 0.5, y: r.y + r.h * 0.32 };
  drawParkPath(scene, r, fountain); // winding gravel park path (no road)
  drawWallBorder(scene, r); // planted border hugging the building wall (top)
  drawFountain(scene, r, fountain); // focal point
  drawTreesAndProps(scene, r);
  drawSakura(scene, r); // pink cherry-blossom trees
  scatterFlowers(scene, r);
  // Pet houses sit side-by-side along the upper-right grass (same row).
  const homeY = r.y + r.h * 0.26;
  const catHome = petHouse(scene, r.x + r.w * 0.66, homeY, 0x6f7a86, 'CAT'); // grey
  const dogHome = petHouse(scene, r.x + r.w * 0.86, homeY, 0xb5683c, 'DOG'); // terracotta
  if (!reduceMotion) {
    spawnPetals(scene, r); // blossom petals drifting on the wind
    const cat = spawnCat(scene, r, catHome); // a black cat that hops around the park
    spawnDog(scene, r, cat, dogHome); // a brown dog that plays/chases near the cat
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
    { x: r.x + r.w * 0.32, y: r.y + 16 }, // enters through the wall gap, stays inside the park
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
    // never paint a disc whose top would spill above the park into the building.
    const topGuard = r.y + W / 2 + 2;
    const py = p.y < topGuard ? topGuard : p.y;
    edge.fillStyle(PATH_EDGE, 1).fillCircle(p.x, py, W / 2 + 2); // soft border
    gravel.fillStyle(PATH_FILL, 1).fillCircle(p.x, py, W / 2); // gravel fill
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

// A tall garden lamp post, drawn here (the Kenney "city" frame was a wall tap,
// not a lamp). Origin = the base at (x,y); the lantern head sits HEAD_H above it,
// and the night glow is anchored exactly to that head so light + lamp align.
const LAMP_HEAD_H = 38; // px from base to the lantern (the glow anchor)

function lamp(scene: Phaser.Scene, x: number, y: number): void {
  const dep = 1 + y / 2000;
  scene.add.ellipse(x, y + 4, 16, 6, 0x000000, 0.22).setDepth(dep - 0.05); // ground shadow
  const g = scene.add.graphics().setDepth(dep);
  const headY = y - LAMP_HEAD_H;
  // pole (dark teal-grey) + a small base.
  g.fillStyle(0x2f3a44, 1).fillRect(x - 2, headY + 6, 4, LAMP_HEAD_H - 6); // post
  g.fillStyle(0x3a4751, 1).fillRect(x - 1, headY + 6, 1, LAMP_HEAD_H - 6); // post highlight (left)
  g.fillStyle(0x2a333b, 1).fillRect(x - 5, y - 2, 10, 4); // base
  // lantern housing at the top + the warm bulb pane.
  g.fillStyle(0x3a4751, 1).fillRect(x - 5, headY - 5, 10, 4); // cap
  g.fillStyle(0x2f3a44, 1).fillRect(x - 4, headY - 1, 8, 9); // frame
  g.fillStyle(0xffe6a8, 1).fillRect(x - 3, headY, 6, 7); // glass / bulb (warm)

  // Night glow registered with the day/night cycle. The bulb HALO uses the baked
  // radial gradient (soft feather suits a round bulb); the ground POOL stays a
  // plain faint ellipse (a gradient circle on the grass looked off). Depth 82 =
  // above the tint so the lamp punches through the dark.
  const LIGHT_DEPTH = 82;
  const bulbY = headY + 3; // centre of the glass pane
  registerNightLight(addSoftLight(scene, x, bulbY, 84, 0xffe6a8, LIGHT_DEPTH)); // soft bulb halo
  const pool = scene.add
    .ellipse(x, y + 2, 80, 32, 0xffd9a0, 1)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(LIGHT_DEPTH - 0.02);
  registerNightLight({ setIntensity: (k) => pool.setFillStyle(0xffd9a0, 0.4 * k) });
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

// ── Pet house (a small kennel/cat house) + its sleep-Zzz position ────────────
interface PetHome {
  x: number; // doorway / where the pet walks to
  y: number;
  roofX: number; // where the Zzz floats up from (above the roof)
  roofY: number;
}
function petHouse(
  scene: Phaser.Scene,
  x: number,
  y: number,
  roofColor: number,
  label: string,
): PetHome {
  const dep = 1 + y / 2000;
  scene.add.ellipse(x, y + 6, 40, 12, 0x000000, 0.22).setDepth(dep - 0.05); // shadow
  const g = scene.add.graphics().setDepth(dep);
  // body (wood) + dark round doorway + a pitched roof in the pet's colour.
  g.fillStyle(0x9a6a3a, 1).fillRect(x - 16, y - 14, 32, 14); // body
  g.fillStyle(0x82572d, 1).fillRect(x - 16, y - 2, 32, 2); // body base shade
  g.fillStyle(0x1c140e, 1).fillEllipse(x, y - 4, 14, 16); // doorway hole
  g.fillStyle(roofColor, 1).fillTriangle(x - 20, y - 13, x + 20, y - 13, x, y - 28); // roof
  g.fillStyle(hueDark(roofColor), 1).fillTriangle(x + 2, y - 14, x + 20, y - 13, x, y - 28); // roof shade (right)

  // a little name plaque ("CAT" / "DOG") above the roof on a short post.
  const plaqueY = y - 38;
  g.fillStyle(0x5a3d22, 1).fillRect(x - 1, y - 30, 2, plaqueY - (y - 30) + 6); // post
  g.fillStyle(0xf4ead2, 1).fillRoundedRect(x - 13, plaqueY - 7, 26, 13, 2); // board
  g.fillStyle(0xcdbb8e, 1).fillRect(x - 13, plaqueY + 4, 26, 2); // board base shade
  scene.add
    .text(x, plaqueY, label, {
      fontFamily: 'monospace',
      fontSize: '9px',
      fontStyle: 'bold',
      color: '#5a3d22',
    })
    .setOrigin(0.5, 0.5)
    .setDepth(dep + 0.02);

  return { x, y: y + 2, roofX: x, roofY: y - 52 }; // Zzz floats above the plaque
}

/** A "Z z Z" sleep wisp that rises + fades above a point, looping. Hidden until shown. */
function makeZzz(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(3).setVisible(false);
  const letters = ['Z', 'z', 'Z'].map((ch, i) =>
    scene.add
      .text(i * 6, -i * 7, ch, {
        fontFamily: 'monospace',
        fontSize: `${10 + i * 2}px`,
        color: '#e8e2d2',
      })
      .setOrigin(0.5, 1)
      .setAlpha(0),
  );
  letters.forEach((t) => c.add(t));
  const float = (): void => {
    letters.forEach((t, i) => {
      t.setPosition(i * 6, -i * 7).setAlpha(0);
      scene.tweens.add({
        targets: t,
        y: -i * 7 - 16,
        alpha: { from: 0, to: 0.95 },
        duration: 900,
        delay: i * 260,
        ease: 'Sine.out',
        yoyo: true,
        hold: 200,
      });
    });
    if (c.visible) scene.time.delayedCall(1600, float);
  };
  c.setData('startFloat', float);
  return c;
}

// ── One black cat that hops around the park (single, charming, not a crowd) ──
function spawnCat(scene: Phaser.Scene, r: Rect, home: PetHome): Phaser.GameObjects.Container {
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
  let asleep = false;
  const hop = (): void => {
    if (asleep) return;
    // pick a nearby target on the grass (avoid the road band loosely).
    const tx = r.x + 30 + rnd() * (r.w * 0.6);
    const ty = r.y + 30 + rnd() * (r.h - 70);
    cat.scaleX = tx < cat.x ? -1 : 1; // face travel direction
    scene.tweens.add({
      targets: cat,
      x: tx,
      y: ty,
      duration: 600 + rnd() * 500,
      ease: 'Sine.inOut',
      onComplete: () => scene.time.delayedCall(700 + rnd() * 1800, hop),
    });
    scene.tweens.add({ targets: g, y: -6, duration: 300, yoyo: true, ease: 'Quad.out' });
  };
  cat.setPosition(r.x + r.w * 0.3, r.y + r.h * 0.7);
  scene.time.delayedCall(1500, hop);
  attachSleep(
    scene,
    cat,
    home,
    () => asleep,
    (v) => (asleep = v),
    hop,
  );
  return cat;
}

// ── A brown dog that romps near the cat — they "play" (the dog trots toward the
//    cat, the cat keeps hopping away). Same hop-arc style as the cat.
function spawnDog(
  scene: Phaser.Scene,
  r: Rect,
  cat: Phaser.GameObjects.Container,
  home: PetHome,
): void {
  const dog = scene.add.container(0, 0).setDepth(2);
  const g = scene.add.graphics();
  // simple top-down brown dog: longer body, head with snout, floppy ears, tail.
  g.fillStyle(0x000000, 0.25).fillEllipse(0, 8, 22, 7); // shadow
  g.fillStyle(0x8a5a34, 1).fillEllipse(0, 0, 20, 11); // body
  g.fillStyle(0x9a6a3a, 1).fillCircle(9, -2, 6); // head
  g.fillStyle(0x6f4a2a, 1).fillEllipse(13, -2, 5, 3); // snout
  g.fillStyle(0x6f4a2a, 1).fillEllipse(6, -7, 4, 5).fillEllipse(11, -7, 4, 5); // floppy ears
  g.fillStyle(0x8a5a34, 1).fillEllipse(-12, -3, 7, 3); // tail
  g.fillStyle(0x1a1c2c, 1).fillCircle(10, -3, 1).fillCircle(13, -3, 1); // eyes/nose
  dog.add(g);

  let seed = 53;
  const rnd = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  let asleep = false;
  const romp = (): void => {
    if (asleep) return;
    // aim a bit OFFSET from the cat so the dog circles/chases rather than overlaps.
    const off = 34 + rnd() * 24;
    const side = rnd() < 0.5 ? -1 : 1;
    const tx = Phaser.Math.Clamp(cat.x + side * off, r.x + 24, r.x + r.w * 0.66);
    const ty = Phaser.Math.Clamp(cat.y + (rnd() * 30 - 15), r.y + 28, r.y + r.h - 24);
    dog.scaleX = tx < dog.x ? -1 : 1; // face travel
    scene.tweens.add({
      targets: dog,
      x: tx,
      y: ty,
      duration: 700 + rnd() * 450,
      ease: 'Sine.inOut',
      onComplete: () => scene.time.delayedCall(500 + rnd() * 1400, romp),
    });
    scene.tweens.add({ targets: g, y: -5, duration: 260, yoyo: true, ease: 'Quad.out' });
  };
  dog.setPosition(r.x + r.w * 0.42, r.y + r.h * 0.66);
  scene.time.delayedCall(2200, romp);
  attachSleep(
    scene,
    dog,
    home,
    () => asleep,
    (v) => (asleep = v),
    romp,
  );
}

/**
 * Wire a pet to the night cycle: at NIGHT it walks home, hides, and a "Z z Z"
 * wisp floats over the roof; by DAY it reappears at the house and resumes its
 * wander loop. Debounced on a night threshold so dusk/dawn flip it once.
 */
function attachSleep(
  scene: Phaser.Scene,
  pet: Phaser.GameObjects.Container,
  home: PetHome,
  getAsleep: () => boolean,
  setAsleep: (v: boolean) => void,
  resumeLoop: () => void,
): void {
  const zzz = makeZzz(scene, home.roofX, home.roofY);
  const goToSleep = (): void => {
    if (getAsleep()) return;
    setAsleep(true);
    // walk to the house, then tuck inside (hide) and start the Zzz.
    scene.tweens.add({
      targets: pet,
      x: home.x,
      y: home.y,
      duration: 900,
      ease: 'Sine.inOut',
      onComplete: () => {
        if (!getAsleep()) return; // woke mid-walk
        pet.setVisible(false);
        zzz.setVisible(true);
        (zzz.getData('startFloat') as () => void)();
      },
    });
  };
  const wakeUp = (): void => {
    if (!getAsleep()) return;
    setAsleep(false);
    zzz.setVisible(false);
    pet.setPosition(home.x, home.y).setVisible(true);
    resumeLoop();
  };
  onNightChange((night) => {
    if (night > 0.8 && !getAsleep()) goToSleep();
    else if (night < 0.4 && getAsleep()) wakeUp();
  });
}

/** Darken a hex color ~25% (for roof shade). */
function hueDark(hex: number): number {
  const r = ((hex >> 16) & 0xff) * 0.75;
  const g = ((hex >> 8) & 0xff) * 0.75;
  const b = (hex & 0xff) * 0.75;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
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
