/**
 * BubbleRotator (PLAN.md §4.5) — shows exactly one speech bubble per sub-spot at
 * a time, rotating every BUBBLE_ROTATE_MS. Prefers active speakers; falls back
 * to any agent with text. Ported behavior from the csm MVP.
 *
 * Holds the latest text per agent; the scene tells it which agents exist and
 * where (zone:activity key). Pure scheduling + selection — calls back into the
 * sprite to show/hide.
 */
import { BUBBLE_ROTATE_MS } from '../config';
import type { AgentSprite } from './AgentSprite';

interface Entry {
  sprite: AgentSprite;
  key: string; // zone:activity (the sub-spot)
  text: string;
  active: boolean;
}

function wordTruncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + '…';
}

export class BubbleRotator {
  private entries = new Map<string, Entry>();
  private offset = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.offset++;
      this.apply();
    }, BUBBLE_ROTATE_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  setText(id: string, sprite: AgentSprite, key: string, text: string, active: boolean): void {
    this.entries.set(id, { sprite, key, text: wordTruncate(text, 90), active });
    this.apply();
  }

  setActive(id: string, active: boolean): void {
    const e = this.entries.get(id);
    if (e) e.active = active;
  }

  setKey(id: string, key: string): void {
    const e = this.entries.get(id);
    if (e) e.key = key;
  }

  remove(id: string): void {
    this.entries.delete(id);
  }

  /** Choose one speaker per sub-spot and show its bubble; hide the rest. */
  private apply(): void {
    const perSpot = new Map<string, Entry[]>();
    for (const e of this.entries.values()) {
      e.sprite.hideBubble();
      if (!e.text) continue;
      if (!perSpot.has(e.key)) perSpot.set(e.key, []);
      perSpot.get(e.key)!.push(e);
    }
    for (const list of perSpot.values()) {
      const actives = list.filter((e) => e.active);
      const pickFrom = actives.length ? actives : list;
      const chosen = pickFrom[this.offset % pickFrom.length];
      chosen.sprite.showBubble(chosen.text);
    }
  }
}
