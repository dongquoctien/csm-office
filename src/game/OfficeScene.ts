/**
 * OfficeScene — draws the 3-zone office and animates agents from store intents.
 *   spawn    → create sprite, place at slot
 *   despawn  → free slot, destroy
 *   moveRoom → walk through doorways to the new sub-spot (routing.ts)
 *   activity → swap sub-spot within the same zone (walk) or just toggle active
 *   say      → feed the bubble rotator (1 per sub-spot, rotates)
 *
 * Consumes intents only; never touches SSE. Phase 4 swaps the placeholder art
 * for a real tileset/sprite sheet via the asset manifest.
 */
import Phaser from 'phaser';
import { ALL_ZONES, WORLD_H, WORLD_W, ZONES, subspotFor } from './zones';
import { ensureFloor, hasIndoor, INDOOR_KEY, INDOOR_TILE, preloadAssets, PROPS } from './assets';
import type { PropName } from './assets';
import { AgentSprite } from './AgentSprite';
import { SlotManager } from './slots';
import { BubbleRotator } from './bubble';
import { routeTo } from './routing';
import { ACTIVITY_LABEL, ZONE_LABEL, type ZoneId } from '../store/zoneMap';
import type { Intent } from '../store/diff';
import type { Activity } from '../api/types';
import type { Look } from '../store/look';

const FLOOR_HEX: Record<'wood' | 'tile' | 'blue', number> = {
  wood: 0x9b6a3f,
  tile: 0xe7e2d8,
  blue: 0x2f5d7c,
};
const WALL_HEX = 0x1c1c22;
const TITLE_HEX: Record<'wood' | 'tile' | 'blue', string> = {
  wood: '#3a2616',
  tile: '#4a4636',
  blue: '#cfe2f0',
};

interface Tracked {
  sprite: AgentSprite;
  zone: ZoneId;
  activity: Activity;
}

export class OfficeScene extends Phaser.Scene {
  private agents = new Map<string, Tracked>();
  private slots = new SlotManager();
  private bubbles = new BubbleRotator();
  private agentNames = new Map<string, string>();

  constructor() {
    super('Office');
  }

  preload(): void {
    preloadAssets(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b0e');
    this.drawWorld();
    this.drawProps();
    this.fitCamera();
    this.scale.on('resize', () => this.fitCamera());
    this.bubbles.start();
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.bubbles.stop());
  }

  private drawWorld(): void {
    for (const zone of ALL_ZONES) {
      const tex = ensureFloor(this, zone.floor);
      this.add
        .tileSprite(zone.rect.x, zone.rect.y, zone.rect.w, zone.rect.h, tex)
        .setOrigin(0, 0)
        .setAlpha(1)
        .setDepth(0);
      // Light tint wash to deepen each zone's identity without hiding the floor.
      this.add
        .rectangle(zone.rect.x, zone.rect.y, zone.rect.w, zone.rect.h, FLOOR_HEX[zone.floor], 0.12)
        .setOrigin(0, 0)
        .setDepth(0);
      this.add
        .rectangle(zone.rect.x, zone.rect.y, zone.rect.w, zone.rect.h)
        .setOrigin(0, 0)
        .setStrokeStyle(6, WALL_HEX, 1)
        .setDepth(0);
      this.add
        .text(zone.rect.x + 14, zone.rect.y + 8, ZONE_LABEL[zone.id].toUpperCase(), {
          fontFamily: 'monospace',
          fontSize: '13px',
          fontStyle: 'bold',
          color: TITLE_HEX[zone.floor],
        })
        .setDepth(0.7); // above props (0.5), below avatars (1)
      for (const ss of zone.subspots) {
        this.add
          .text(ss.labelX, ss.labelY, ACTIVITY_LABEL[ss.activity], {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: TITLE_HEX[zone.floor],
          })
          .setOrigin(0.5, 0)
          .setAlpha(0.85)
          .setDepth(0.7);
      }
    }
  }

  /** Decorate zones with real furniture props (Kenney indoor sheet). */
  private drawProps(): void {
    if (!hasIndoor(this)) return; // no asset → procedural-only scene
    const SCALE = 2; // 16px tile → 32px
    const prop = (name: PropName, x: number, y: number, scale = SCALE): void => {
      this.add
        .image(x, y, INDOOR_KEY, PROPS[name])
        .setOrigin(0.5, 0.8)
        .setScale(scale)
        .setDepth(0.5);
    };

    // Per-zone, per-activity decoration. Props sit just above each sub-spot's
    // first slot row so avatars stand "at" them.
    const deco: Record<string, PropName[]> = {
      'coding:writing': ['deskItems', 'deskWood'],
      'coding:running': ['deskWood', 'deskItems'],
      'coding:searching': ['deskItems', 'deskWood'],
      'meeting:reading': ['framedTeal', 'plant'],
      'meeting:browsing': ['wallArtMap'],
      'meeting:thinking': ['framedGreen', 'plant2'],
      'meeting:spawning': ['lamp'],
      'kitchen:idle': ['fridge', 'plant'],
      'kitchen:waiting': ['stove', 'counter'],
    };

    for (const zone of ALL_ZONES) {
      for (const ss of zone.subspots) {
        const names = deco[`${zone.id}:${ss.activity}`] ?? [];
        const topRow = ss.slots.slice(0, 4); // top row of the 4x2 slot grid
        names.forEach((name, i) => {
          const slot = topRow[i % topRow.length];
          // Place the prop a bit above the slot so the avatar stands in front.
          prop(name, slot.x, slot.y - INDOOR_TILE * SCALE * 0.5);
        });
      }
      // A couple of ambient plants in each zone's corner.
      this.add
        .image(zone.rect.x + 22, zone.rect.y + zone.rect.h - 22, INDOOR_KEY, PROPS.plant2)
        .setOrigin(0.5, 0.8)
        .setScale(SCALE)
        .setDepth(0.5);
    }
  }

  private fitCamera(): void {
    const cam = this.cameras.main;
    const zoom = Math.min(this.scale.width / WORLD_W, this.scale.height / WORLD_H);
    cam.setZoom(zoom);
    cam.centerOn(WORLD_W / 2, WORLD_H / 2);
  }

  applyIntents(intents: Intent[], names: Map<string, string>): void {
    this.agentNames = names;
    for (const intent of intents) {
      switch (intent.kind) {
        case 'spawn':
          this.spawn(intent.id, intent.look, intent.zone, intent.activity, intent.active);
          break;
        case 'despawn':
          this.despawn(intent.id);
          break;
        case 'moveRoom':
          this.moveTo(intent.id, intent.zone, intent.activity, true);
          break;
        case 'activity':
          this.onActivity(intent.id, intent.activity, intent.active);
          break;
        case 'say':
          this.onSay(intent.id, intent.text);
          break;
      }
    }
  }

  private key(zone: ZoneId, activity: Activity): string {
    return `${zone}:${activity}`;
  }

  private spawn(id: string, look: Look, zone: ZoneId, activity: Activity, active: boolean): void {
    if (this.agents.has(id)) return;
    const name = this.agentNames.get(id) || id.slice(0, 8);
    const sprite = new AgentSprite(this, id, look, name, activity);
    const slot = this.slots.take(id, zone, activity);
    sprite.placeAt(slot.x, slot.y); // spawn instantly at the slot
    sprite.setActive(active);
    this.agents.set(id, { sprite, zone, activity });
    this.bubbles.setKey(id, this.key(zone, activity));
    this.bubbles.setActive(id, active);
  }

  /** Move an agent to a (zone, activity) sub-spot; walk if `animate`. */
  private moveTo(id: string, zone: ZoneId, activity: Activity, animate: boolean): void {
    const t = this.agents.get(id);
    if (!t) return;
    const slot = this.slots.take(id, zone, activity);
    const target = subspotFor(zone, activity)
      ? slot
      : { x: ZONES[zone].rect.x + ZONES[zone].rect.w / 2, y: ZONES[zone].rect.y + 40 };
    if (animate) {
      const path = routeTo(t.zone, zone, { x: t.sprite.x, y: t.sprite.y }, target);
      t.sprite.walkPath(path);
    } else {
      t.sprite.placeAt(target.x, target.y);
    }
    t.zone = zone;
    t.activity = activity;
    t.sprite.setActivity(activity);
    this.bubbles.setKey(id, this.key(zone, activity));
  }

  private onActivity(id: string, activity: Activity, active: boolean): void {
    const t = this.agents.get(id);
    if (!t) return;
    t.sprite.setActive(active);
    this.bubbles.setActive(id, active);
    // Same zone but the activity changed → walk to the new sub-spot.
    if (t.activity !== activity) this.moveTo(id, t.zone, activity, true);
  }

  private onSay(id: string, text: string): void {
    const t = this.agents.get(id);
    if (!t) return;
    this.bubbles.setText(id, t.sprite, this.key(t.zone, t.activity), text, t.sprite.isActive());
  }

  private despawn(id: string): void {
    this.slots.release(id);
    this.bubbles.remove(id);
    this.agents.get(id)?.sprite.destroy();
    this.agents.delete(id);
  }

  /** Show/hide sprites by a predicate (filters/search). */
  setFilter(match: (id: string) => boolean): void {
    for (const [id, t] of this.agents) t.sprite.setVisible(match(id));
  }

  hasAgent(id: string): boolean {
    return this.agents.has(id);
  }
}
