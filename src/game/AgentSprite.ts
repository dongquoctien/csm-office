/**
 * AgentSprite — one avatar. Placeholder figure drawn from the deterministic
 * Look; motion ported from the csm MVP (PLAN.md §4.5):
 *   - walkPath(): tween through routing waypoints, per-leg duration
 *     clamp(dist / SPEED, MIN, MAX), legs queued, reduced-motion → instant.
 *   - idle bob + active glow.
 *   - showBubble()/hideBubble(): speech bubble (driven by BubbleRotator).
 *
 * Public surface stays stable so Phase 4 can swap in a real sprite sheet without
 * touching callers: placeAt / walkPath / setActive / setActivity / say helpers.
 */
import Phaser from 'phaser';
import type { Look } from '../store/look';
import { hashId, INK } from '../store/look';
import type { Activity } from '../api/types';
import type { Point } from './routing';
import { WALK_LEG_MAX_MS, WALK_LEG_MIN_MS, WALK_SPEED_PX_PER_MS } from '../config';
import { charFrameFor, CHARS_KEY, hasChars } from './assets';

const W = 22;
const H = 30;

function hex(s: string): number {
  return parseInt(s.replace('#', ''), 16);
}

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class AgentSprite {
  readonly id: string;
  readonly container: Phaser.GameObjects.Container;
  private scene: Phaser.Scene;
  private body: Phaser.GameObjects.Graphics;
  private sprite?: Phaser.GameObjects.Image; // real pixel character (preferred)
  // Whichever figure is shown (sprite or drawn body); both share these members.
  private gfx?: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private glow: Phaser.GameObjects.Ellipse;
  private bubble?: Phaser.GameObjects.Container;
  private active = false;
  private look: Look;
  activity: Activity;

  private queue: Point[] = [];
  private walking = false;
  private bobTween?: Phaser.Tweens.Tween;
  private bobBaseY = this.sprite ? -2 : 0;

  constructor(scene: Phaser.Scene, id: string, look: Look, name: string, activity: Activity) {
    this.scene = scene;
    this.id = id;
    this.look = look;
    this.activity = activity;

    const shadow = scene.add.ellipse(0, H / 2, 18, 6, 0x000000, 0.25);
    this.glow = scene.add.ellipse(0, 0, 30, 36, 0x7fc8a0, 0).setVisible(false);

    // Prefer a real pixel character; fall back to the drawn figure.
    this.body = scene.add.graphics();
    const members: Phaser.GameObjects.GameObject[] = [this.glow, shadow];
    if (hasChars(scene)) {
      const frame = charFrameFor(hashId(id));
      this.sprite = scene.add.image(0, -2, CHARS_KEY, frame).setOrigin(0.5, 0.5).setScale(2.2);
      this.gfx = this.sprite;
      this.body.setVisible(false);
      members.push(this.body, this.sprite);
    } else {
      this.drawFigure();
      this.gfx = this.body;
      members.push(this.body);
    }

    this.label = scene.add
      .text(0, H / 2 + 2, name, { fontFamily: 'monospace', fontSize: '9px', color: '#cfcfcf' })
      .setOrigin(0.5, 0);
    members.push(this.label);

    this.container = scene.add.container(0, 0, members);
    this.container.setDepth(1);
    // Clickable hit area around the figure → scene emits 'agent-click'.
    this.container
      .setSize(W + 8, H + 10)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => scene.events.emit('agent-click', this.id));
  }

  setVisible(v: boolean): void {
    this.container.setVisible(v);
  }

  private drawFigure(): void {
    const g = this.body;
    g.clear();
    g.fillStyle(hex(this.look.shirt), 1).fillRoundedRect(-W / 2, 0, W, H / 2, 4);
    g.fillStyle(hex(this.look.skin), 1).fillCircle(0, -H / 4, 8);
    g.fillStyle(hex(this.look.hair), 1);
    if (this.look.hairStyle === 'bald') {
      /* none */
    } else if (this.look.hairStyle === 'long' || this.look.hairStyle === 'ponytail') {
      g.fillRoundedRect(-9, -H / 4 - 9, 18, 14, 5);
    } else {
      g.fillRoundedRect(-9, -H / 4 - 9, 18, 9, 5);
    }
    if (this.look.hasHat) {
      g.fillStyle(hex(this.look.hat), 1).fillRoundedRect(-10, -H / 4 - 11, 20, 6, 3);
    }
    g.fillStyle(hex(INK), 1)
      .fillCircle(-3, -H / 4, 1.4)
      .fillCircle(3, -H / 4, 1.4);
    if (this.look.hasGlasses) {
      g.lineStyle(1, hex(INK), 0.9)
        .strokeCircle(-3, -H / 4, 2.6)
        .strokeCircle(3, -H / 4, 2.6);
    }
  }

  setName(name: string): void {
    this.label.setText(name);
  }

  setActivity(activity: Activity): void {
    this.activity = activity;
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    this.label.setColor(active ? '#7fc8a0' : '#cfcfcf');
    this.glow.setVisible(active).setAlpha(active ? 0.18 : 0);
    if (active) this.startBob();
    else this.stopBob();
  }

  private startBob(): void {
    if (this.bobTween || prefersReducedMotion || !this.gfx) return;
    this.bobBaseY = this.gfx.y;
    this.bobTween = this.scene.tweens.add({
      targets: this.gfx,
      y: this.bobBaseY - 2,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private stopBob(): void {
    this.bobTween?.stop();
    this.bobTween = undefined;
    if (this.gfx) this.gfx.y = this.bobBaseY;
  }

  /** Instant placement (initial spawn). */
  placeAt(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /** Queue a walk along waypoints; legs run sequentially (PLAN.md §4.5). */
  walkPath(points: Point[]): void {
    if (points.length === 0) return;
    if (prefersReducedMotion) {
      const last = points[points.length - 1];
      this.placeAt(last.x, last.y);
      return;
    }
    this.queue = points.slice();
    if (!this.walking) this.stepNext();
  }

  private stepNext(): void {
    const next = this.queue.shift();
    if (!next) {
      this.walking = false;
      return;
    }
    this.walking = true;
    const dx = next.x - this.container.x;
    const dy = next.y - this.container.y;
    const dist = Math.hypot(dx, dy);
    const dur = Math.min(WALK_LEG_MAX_MS, Math.max(WALK_LEG_MIN_MS, dist / WALK_SPEED_PX_PER_MS));
    // Face the direction of travel (flip the figure horizontally), preserving
    // the figure's own scale magnitude (sprite is 2.2, drawn body is 1).
    if (Math.abs(dx) > 1 && this.gfx) {
      const mag = Math.abs(this.gfx.scaleX) || 1;
      this.gfx.scaleX = dx < 0 ? -mag : mag;
    }
    this.scene.tweens.add({
      targets: this.container,
      x: next.x,
      y: next.y,
      duration: dur,
      ease: 'Linear',
      onComplete: () => this.stepNext(),
    });
  }

  // --- Speech bubble -------------------------------------------------------
  showBubble(text: string): void {
    this.hideBubble();
    const padX = 6;
    const t = this.scene.add
      .text(0, 0, text, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#1a1a1a',
        wordWrap: { width: 130 },
      })
      .setOrigin(0.5, 1);
    const b = t.getBounds();
    const bg = this.scene.add
      .rectangle(0, 0, b.width + padX * 2, b.height + 8, 0xf4f1e8, 0.96)
      .setOrigin(0.5, 1)
      .setStrokeStyle(1, 0x000000, 0.25);
    this.bubble = this.scene.add.container(0, -H / 2 - 14, [bg, t]);
    this.bubble.setDepth(5);
    this.container.add(this.bubble);
  }

  hideBubble(): void {
    this.bubble?.destroy(true);
    this.bubble = undefined;
  }

  hasText(): boolean {
    return !!this.bubble;
  }

  isActive(): boolean {
    return this.active;
  }

  get x(): number {
    return this.container.x;
  }
  get y(): number {
    return this.container.y;
  }

  destroy(): void {
    this.stopBob();
    this.container.destroy(true);
  }
}
