/**
 * OfficeScene — draws 3 top-down rooms with depth (walls w/ visible height,
 * baked shadows, wall-anchored furniture, open centers) and animates agents from
 * store intents. Layered draw order per the interior-design research:
 *   floor → rug → wall-shadow → walls(top+face) → wall-mounted decor →
 *   furniture (shadowed) → agents (y-sorted) → bubbles.
 * Consumes intents only; never touches SSE.
 */
import Phaser from 'phaser';
import {
  ALL_ZONES,
  MEETING_TABLE,
  WALL_FACE,
  WORLD_H,
  WORLD_W,
  type Station,
  type WallDecor,
  type Zone,
} from './zones';
import {
  ensureFloor,
  hasIndoor,
  INDOOR_KEY,
  PROPS,
  preloadAssets,
  RPG_KEY,
  RPG_PROPS,
} from './assets';
import { AgentSprite } from './AgentSprite';
import { SlotManager } from './slots';
import { BubbleRotator } from './bubble';
import { ScreenLayer } from './Screen';
import { createOutdoor } from './outdoor';
import { routeTo } from './routing';
import { ZONE_LABEL, type ZoneId } from '../store/zoneMap';
import type { Intent } from '../store/diff';
import type { Activity } from '../api/types';
import type { Look } from '../store/look';

const FLOOR_HEX: Record<'wood' | 'tile' | 'blue', number> = {
  wood: 0x6b4a2a,
  tile: 0xc9c2b0,
  blue: 0x2f5d7c,
};
// Wall: a lighter cap on top of a darker face, plus a baseboard line.
const WALL_CAP = 0x6f6a78;
const WALL_FACE_HEX = 0x4a4652;
const WALL_BASE = 0x2a2730;
const TITLE_HEX: Record<'wood' | 'tile' | 'blue', string> = {
  wood: '#f0e0c0',
  tile: '#3a3630',
  blue: '#cfe2f0',
};
const FURNITURE_DEPTH_BASE = 10;

interface Tracked {
  sprite: AgentSprite;
  zone: ZoneId;
  activity: Activity;
  screenKey?: string; // the desk monitor this agent currently lights
}

export class OfficeScene extends Phaser.Scene {
  private agents = new Map<string, Tracked>();
  private slots = new SlotManager();
  private bubbles = new BubbleRotator();
  private agentNames = new Map<string, string>();
  private screens!: ScreenLayer;

  constructor() {
    super('Office');
  }

  preload(): void {
    preloadAssets(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b0b0e');
    createOutdoor(this); // ambient street (bottom-left of the L)
    this.screens = new ScreenLayer(this);
    for (const zone of ALL_ZONES) this.drawZone(zone);
    this.fitCamera();
    this.scale.on('resize', () => this.fitCamera());
    this.bubbles.start();
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => this.bubbles.stop());
  }

  /** Stable key for a station's monitor screen. */
  private stationScreenKey(st: Station): string {
    return `scr:${Math.round(st.fx)},${Math.round(st.fy)}`;
  }

  // ── Reusable contact shadow (glues objects to the floor) ───────────────────
  private contactShadow(x: number, y: number, w: number, depth: number): void {
    this.add.ellipse(x, y, w, w * 0.32, 0x000000, 0.22).setDepth(depth - 0.01);
  }

  private placeProp(d: WallDecor): void {
    const key = d.sheet === 'rpg' ? RPG_KEY : INDOOR_KEY;
    const frame =
      d.sheet === 'rpg'
        ? RPG_PROPS[d.prop as keyof typeof RPG_PROPS]
        : PROPS[d.prop as keyof typeof PROPS];
    this.add
      .image(d.x, d.y, key, frame)
      .setOrigin(0.5, 0.5)
      .setScale(d.scale ?? 2)
      .setDepth(0.4);
  }

  private drawZone(zone: Zone): void {
    const { rect, inner, floor } = zone;

    // 1) Floor (tiled), filling the inner area.
    const tex = ensureFloor(this, floor);
    this.add.tileSprite(inner.x, inner.y, inner.w, inner.h, tex).setOrigin(0, 0).setDepth(0);
    if (floor === 'blue') {
      this.add
        .rectangle(inner.x, inner.y, inner.w, inner.h, FLOOR_HEX.blue, 0.4)
        .setOrigin(0, 0)
        .setDepth(0.01);
    }

    // 2) Rug (defines a sub-zone), under the furniture.
    if (zone.rug && hasIndoor(this)) {
      this.add
        .image(zone.rug.x, zone.rug.y, INDOOR_KEY, PROPS[zone.rug.prop])
        .setOrigin(0.5, 0.5)
        .setScale(zone.rug.scale)
        .setDepth(0.05);
    }

    // 3) Walls with visible height: cap band + face band + baseboard line.
    //    Drawn as rectangles so it reads as a room, not a stroke outline.
    const x = rect.x,
      y = rect.y,
      w = rect.w,
      h = rect.h;
    // wall-base shadow strip just inside the top wall (light from top-left).
    this.add.rectangle(inner.x, inner.y, inner.w, 6, 0x000000, 0.12).setOrigin(0, 0).setDepth(0.2);
    // top wall: face then cap
    this.add.rectangle(x, y, w, WALL_FACE, WALL_FACE_HEX, 1).setOrigin(0, 0).setDepth(0.3);
    this.add.rectangle(x, y, w, 7, WALL_CAP, 1).setOrigin(0, 0).setDepth(0.31);
    this.add
      .rectangle(x, y + WALL_FACE - 2, w, 2, WALL_BASE, 1)
      .setOrigin(0, 0)
      .setDepth(0.32);
    // side + bottom walls: thinner caps (we see them edge-on)
    this.add
      .rectangle(x, y, WALL_FACE * 0.5, h, WALL_FACE_HEX, 1)
      .setOrigin(0, 0)
      .setDepth(0.3);
    this.add
      .rectangle(x + w - WALL_FACE * 0.5, y, WALL_FACE * 0.5, h, WALL_FACE_HEX, 1)
      .setOrigin(0, 0)
      .setDepth(0.3);
    this.add
      .rectangle(x, y + h - WALL_FACE * 0.5, w, WALL_FACE * 0.5, WALL_FACE_HEX, 1)
      .setOrigin(0, 0)
      .setDepth(0.3);

    // 5) Wall-mounted decor (bookshelves, art, plants).
    if (hasIndoor(this)) for (const d of zone.decor) this.placeProp(d);

    // 4) Zone title on the wall cap — drawn AFTER decor so it stays legible.
    this.add
      .text(inner.x + 6, y + 4, ZONE_LABEL[zone.id].toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color: TITLE_HEX[floor],
        backgroundColor: '#00000055',
        padding: { x: 3, y: 1 },
      })
      .setDepth(0.6);

    // 6) Meeting conference table (the central focal point).
    if (zone.id === 'meeting' && hasIndoor(this)) {
      this.contactShadow(MEETING_TABLE.x, MEETING_TABLE.y + 14, 96, 0.5);
      this.add
        .image(MEETING_TABLE.x, MEETING_TABLE.y, INDOOR_KEY, PROPS.tableLong)
        .setOrigin(0.5, 0.5)
        .setScale(3)
        .setDepth(0.5);
    }

    // 7) Station furniture (desks/counters/chairs), each with a contact shadow.
    if (hasIndoor(this)) {
      for (const st of zone.stations) this.drawStationFurniture(st);
    }
  }

  private drawStationFurniture(st: Station): void {
    const depth = FURNITURE_DEPTH_BASE + st.fy / WORLD_H;
    this.contactShadow(st.fx, st.fy + 12, 30, depth);
    this.add
      .image(st.fx, st.fy, INDOOR_KEY, PROPS[st.furniture])
      .setOrigin(0.5, 0.8)
      .setScale(2)
      .setDepth(depth);
    // Coding desks get a monitor screen (lit when occupied).
    if (st.activity === 'writing' || st.activity === 'running' || st.activity === 'searching') {
      this.screens.add(this.stationScreenKey(st), st.fx, st.fy - 16, depth + 0.005);
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
    const st = this.slots.take(id, zone, activity);
    sprite.placeAt(st.seat.x, st.seat.y);
    sprite.face(st.facing);
    sprite.setActive(active);
    const screenKey = this.stationScreenKey(st);
    this.screens.setOn(screenKey, true);
    this.agents.set(id, { sprite, zone, activity, screenKey });
    this.bubbles.setKey(id, this.key(zone, activity));
    this.bubbles.setActive(id, active);
  }

  private moveTo(id: string, zone: ZoneId, activity: Activity, animate: boolean): void {
    const t = this.agents.get(id);
    if (!t) return;
    const st = this.slots.take(id, zone, activity);
    // The old desk goes dark; the new one lights when the agent arrives.
    if (t.screenKey) this.screens.setOn(t.screenKey, false);
    const newKey = this.stationScreenKey(st);
    if (animate) {
      const path = routeTo(t.zone, zone, { x: t.sprite.x, y: t.sprite.y }, st.seat);
      t.sprite.walkPath(path, st.facing);
    } else {
      t.sprite.placeAt(st.seat.x, st.seat.y);
      t.sprite.face(st.facing);
    }
    this.screens.setOn(newKey, true);
    t.zone = zone;
    t.activity = activity;
    t.screenKey = newKey;
    t.sprite.setActivity(activity);
    this.bubbles.setKey(id, this.key(zone, activity));
  }

  private onActivity(id: string, activity: Activity, active: boolean): void {
    const t = this.agents.get(id);
    if (!t) return;
    t.sprite.setActive(active);
    this.bubbles.setActive(id, active);
    if (t.activity !== activity) this.moveTo(id, t.zone, activity, true);
  }

  private onSay(id: string, text: string): void {
    const t = this.agents.get(id);
    if (!t) return;
    this.bubbles.setText(id, t.sprite, this.key(t.zone, t.activity), text, t.sprite.isActive());
  }

  private despawn(id: string): void {
    const t = this.agents.get(id);
    if (t?.screenKey) this.screens.setOn(t.screenKey, false);
    this.slots.release(id);
    this.bubbles.remove(id);
    t?.sprite.destroy();
    this.agents.delete(id);
  }

  setFilter(match: (id: string) => boolean): void {
    for (const [id, t] of this.agents) t.sprite.setVisible(match(id));
  }

  hasAgent(id: string): boolean {
    return this.agents.has(id);
  }
}
