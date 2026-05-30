/**
 * NPCs — non-agent characters with light ambient behaviour. They are NOT driven
 * by SSE; pure flavour. All three STAND IN PLACE, do a gentle idle bob, and emit
 * a rotating one-line "chatter" bubble:
 *   - Guard: by the Coding entrance.
 *   - Boss: at the head of the meeting table.
 *   - Chef: by the kitchen cooktop.
 * Drawn with the pixel-art skill (pixelProps), grounded by a contact shadow, and
 * respect prefers-reduced-motion (static pose, no tweens). Self-contained like
 * outdoor.ts; call createNpcs(scene) once from OfficeScene.create().
 */
import Phaser from 'phaser';
import { ensurePixelProp } from './pixelProps';
import { ZONES, BOSS_SPOT } from './zones';

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const BOSS_LINES = ['Status?', 'Ship it.', 'Good work.', 'Any blockers?', "Let's sync."];
const CHEF_LINES = ['Order up!', 'Fresh coffee', 'Hot & ready', 'Bon appétit'];
const GUARD_LINES = ['All clear.', 'Badges, please.', 'Quiet shift.', 'Morning!'];

export function createNpcs(scene: Phaser.Scene): void {
  createGuard(scene);
  createBoss(scene);
  createChef(scene);
}

/**
 * A standing NPC: contact shadow + sprite (origin bottom-centre) + name tag, a
 * gentle idle bob, and a rotating chatter bubble above the head. Returns the
 * sprite so callers can add extra behaviour (e.g. the boss's wider sway).
 */
function standingNpc(
  scene: Phaser.Scene,
  key: string,
  x: number,
  y: number,
  scale: number,
  tag: string,
  tagColor: string,
  lines: string[],
  bubbleDy: number,
): Phaser.GameObjects.Image {
  scene.add.ellipse(x, y + 2, 18 * scale, 6 * scale, 0x000000, 0.26).setDepth(9.5);
  const img = scene.add.image(x, y, key).setOrigin(0.5, 1).setScale(scale).setDepth(9.55);
  scene.add
    .text(x, y + 3, tag, { fontFamily: 'monospace', fontSize: '8px', color: tagColor })
    .setOrigin(0.5, 0)
    .setDepth(9.55);

  if (reduceMotion) return img;
  // gentle idle bob.
  scene.tweens.add({
    targets: img,
    y: y - 2,
    duration: 700,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut',
  });
  // rotating chatter bubble (cadence near the agents' 3s bubble rotation).
  let i = 0;
  const bubble = makeBubble(scene, x, y + bubbleDy);
  const cycle = (): void => {
    setBubble(bubble, lines[i % lines.length]);
    i++;
  };
  cycle();
  scene.time.addEvent({ delay: 3400, loop: true, callback: cycle });
  return img;
}

// ── Security guard: stands by the Coding entrance, chatters ──────────────────
function createGuard(scene: Phaser.Scene): void {
  const key = ensurePixelProp(scene, 'npcGuard');
  if (!key) return;
  const inr = ZONES.coding.inner;
  // stand in the lower-left corner (clear of desks), near the room.
  const x = inr.x + 40;
  const y = inr.y + inr.h - 40;
  standingNpc(scene, key, x, y, 1.15, 'Guard', '#9fb4d8', GUARD_LINES, -44);
}

// ── Boss: stands at the head of the meeting table (hand-drawn, slightly big).
function createBoss(scene: Phaser.Scene): void {
  const key = ensurePixelProp(scene, 'npcBoss');
  if (!key) return;
  const { x, y } = BOSS_SPOT;
  // 1.45 → ~1.3x the agents' on-screen size (pixel prop baked at PX=2 = 32px).
  standingNpc(scene, key, x, y, 1.45, 'Boss', '#ffcd75', BOSS_LINES, -52);
}

// ── Chef: stands by the cooktop, chatters ────────────────────────────────────
function createChef(scene: Phaser.Scene): void {
  const key = ensurePixelProp(scene, 'npcChef');
  if (!key) return;
  const inr = ZONES.kitchen.inner;
  // Tuck against the left wall, below the appliance line — clear of the agent
  // seats (evenly spaced from inr.x+gap) and above the canteen tables.
  const x = inr.x + 26;
  const y = inr.y + inr.h * 0.34;
  standingNpc(scene, key, x, y, 1.15, 'Chef', '#f0e0c0', CHEF_LINES, -40);
}

// ── tiny speech bubble ───────────────────────────────────────────────────────
interface MiniBubble {
  bg: Phaser.GameObjects.Rectangle;
  txt: Phaser.GameObjects.Text;
}
function makeBubble(scene: Phaser.Scene, x: number, y: number): MiniBubble {
  const txt = scene.add
    .text(x, y, '', { fontFamily: 'monospace', fontSize: '9px', color: '#1a1a1a' })
    .setOrigin(0.5, 1)
    .setDepth(9.7);
  const bg = scene.add
    .rectangle(x, y, 10, 14, 0xf4f1e8, 0.96)
    .setOrigin(0.5, 1)
    .setStrokeStyle(1, 0x000000, 0.25)
    .setDepth(9.69);
  return { bg, txt };
}
function setBubble(b: MiniBubble, text: string): void {
  b.txt.setText(text);
  const w = b.txt.width + 12;
  const h = b.txt.height + 8;
  b.bg.setSize(w, h);
}
