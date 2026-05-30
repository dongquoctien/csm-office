/**
 * Monitor "online" FX for Coding desks. One ScreenLayer owns all desk screens
 * and a single shared ticker that scrolls binary on the screens that are ON
 * (avoids a timer per desk). A screen turns ON when an agent occupies its desk
 * and OFF when the desk is vacated.
 *
 *   ON  = dark panel + green glow + a few rows of scrolling 1010… (terminal).
 *   OFF = dark/blank panel.
 * Respects prefers-reduced-motion (lit, but no scroll).
 */
import Phaser from 'phaser';

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Sized to fit inside the monitor's display rectangle (≈24×20px at scale 2).
const W = 20;
const H = 14;
const ROWS = 2;
const COLS = 6;

interface Screen {
  panel: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
  on: boolean;
}

export class ScreenLayer {
  private scene: Phaser.Scene;
  private screens = new Map<string, Screen>();
  private ticker?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.ticker = scene.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => this.tick(),
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.ticker?.remove());
  }

  /** Register a monitor screen at a desk (x is desk center, y its monitor row). */
  add(key: string, x: number, y: number, depth: number): void {
    if (this.screens.has(key)) return;
    const glow = this.scene.add.rectangle(x, y, W + 8, H + 8, 0x39ff77, 0).setDepth(depth - 0.02);
    const panel = this.scene.add
      .rectangle(x, y, W, H, 0x0a1410, 1)
      .setStrokeStyle(1, 0x1c2b22, 1)
      .setDepth(depth - 0.01);
    const text = this.scene.add
      .text(x, y, '', {
        fontFamily: 'monospace',
        fontSize: '5px',
        color: '#39ff77',
        lineSpacing: 0,
        align: 'center',
      })
      .setOrigin(0.5, 0.5) // centred in the monitor screen
      .setDepth(depth);
    panel.setVisible(false);
    text.setVisible(false);
    this.screens.set(key, { panel, glow, text, on: false });
  }

  setOn(key: string, on: boolean): void {
    const s = this.screens.get(key);
    if (!s) return;
    s.on = on;
    s.panel.setVisible(on);
    s.text.setVisible(on);
    s.glow.setFillStyle(0x39ff77, on ? 0.16 : 0);
    if (on && reduceMotion) s.text.setText(this.staticBits());
  }

  remove(key: string): void {
    const s = this.screens.get(key);
    if (!s) return;
    s.panel.destroy();
    s.glow.destroy();
    s.text.destroy();
    this.screens.delete(key);
  }

  private tick(): void {
    if (reduceMotion) return;
    for (const s of this.screens.values()) {
      if (s.on) s.text.setText(this.randomBits());
    }
  }

  private randomBits(): string {
    let out = '';
    for (let r = 0; r < ROWS; r++) {
      let row = '';
      for (let c = 0; c < COLS; c++) {
        // deterministic-ish churn without Math.random (varies per tick frame)
        row += (this.scene.time.now / 80 + r * 7 + c * 3) % 2 < 1 ? '1' : '0';
      }
      out += row + (r < ROWS - 1 ? '\n' : '');
    }
    return out;
  }

  private staticBits(): string {
    return '10110\n01001\n11010';
  }
}
