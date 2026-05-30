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
  CORRIDOR,
  CORRIDOR_CX,
  DOOR_W,
  MEETING_TABLE,
  WALL_FACE,
  WORLD_H,
  WORLD_W,
  type FloorProp,
  type Point,
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
import { INDOOR_COLS, TALL_PROPS, type PropName } from './propsData';
import { ensureWorkstation, SCREEN } from './Workstation';
import { ensurePixelProp, hasPixelProp } from './pixelProps';
import { AgentSprite } from './AgentSprite';
import { SlotManager } from './slots';
import { BubbleRotator } from './bubble';
import { ScreenLayer } from './Screen';
import { createOutdoor } from './outdoor';
import { createNpcs } from './npc';
import { createDayNight } from './dayNight';
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
// Plaque label colours — all BRIGHT, since they sit on the dark title plaque.
// (Tile was '#3a3630' = dark-on-dark, which made the Kitchen title unreadable.)
const TITLE_HEX: Record<'wood' | 'tile' | 'blue', string> = {
  wood: '#f0e0c0',
  tile: '#ffe6b0',
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
    this.drawCorridor(); // vertical hallway linking the rooms
    this.screens = new ScreenLayer(this);
    for (const zone of ALL_ZONES) this.drawZone(zone);
    createNpcs(this); // ambient Boss (meeting) + Guard (coding patrol)
    createDayNight(this); // ambient day↔night tint + night light blobs
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

  /**
   * A vertical wall band running (x,y)→(x,y+h). If `doorY` is set, leave a
   * DOOR_W-tall gap centred on it (the doorway) by drawing two segments. A short
   * baseboard caps each side of the opening so it reads as a framed doorway.
   */
  private drawSideWall(x: number, y: number, w: number, h: number, doorY: number | null): void {
    if (doorY == null) {
      this.add.rectangle(x, y, w, h, WALL_FACE_HEX, 1).setOrigin(0, 0).setDepth(0.3);
      return;
    }
    const gapTop = Math.max(y, doorY - DOOR_W / 2);
    const gapBot = Math.min(y + h, doorY + DOOR_W / 2);
    if (gapTop > y) {
      this.add
        .rectangle(x, y, w, gapTop - y, WALL_FACE_HEX, 1)
        .setOrigin(0, 0)
        .setDepth(0.3);
    }
    if (gapBot < y + h) {
      this.add
        .rectangle(x, gapBot, w, y + h - gapBot, WALL_FACE_HEX, 1)
        .setOrigin(0, 0)
        .setDepth(0.3);
    }
    // door jambs (short caps) framing the opening, lit on top.
    for (const jy of [gapTop, gapBot]) {
      this.add
        .rectangle(x, jy - 2, w, 4, WALL_CAP, 1)
        .setOrigin(0, 0)
        .setDepth(0.33);
    }
  }

  /**
   * Draw the vertical hallway (research §1): a calm 2-tone floor with seams
   * running ALONG the corridor axis (vertical), framed by baseboards, lit by
   * evenly-spaced soft light pools. No hard centre stripe (that read as a stain).
   */
  private drawCorridor(): void {
    const c = CORRIDOR;
    const CX = CORRIDOR_CX;
    // 1) base floor — a calm mid tone, the quietest surface on screen.
    this.add.rectangle(c.x, c.y, c.w, c.h, 0x44434c, 1).setOrigin(0, 0).setDepth(0.02);
    // 2) subtle vertical seam lines (along the axis → reinforces direction).
    for (let sx = c.x + 12; sx < c.x + c.w; sx += 14) {
      this.add.rectangle(sx, c.y, 1, c.h, 0x3c3b44, 0.6).setOrigin(0, 0).setDepth(0.021);
    }
    // 3) baseboards: a darker contact band hugging each wall + a 1px top light.
    for (const bx of [c.x, c.x + c.w - 5]) {
      this.add.rectangle(bx, c.y, 5, c.h, 0x2a2932, 1).setOrigin(0, 0).setDepth(0.024);
      this.add.rectangle(bx, c.y, 5, 1, 0x5a5866, 0.5).setOrigin(0, 0).setDepth(0.025);
    }
    // 4) evenly-spaced ceiling light pools down the hall (soft, even rhythm).
    const pools = 5;
    for (let i = 0; i < pools; i++) {
      const py = c.y + (c.h * (i + 0.5)) / pools;
      this.add.ellipse(CX, py, c.w * 0.7, 92, 0xfff2cc, 0.07).setDepth(0.022);
      this.add.ellipse(CX, py, c.w * 0.4, 54, 0xfff2cc, 0.06).setDepth(0.023);
    }
  }

  /**
   * Doorway threshold at a room's door (research §1): a warm wood lip spanning
   * the opening, bridging room ↔ hallway and punctuating the long strip.
   */
  private drawDoorMat(door: Point, onLeft: boolean): void {
    const mx = onLeft ? door.x - 4 : door.x + 4;
    // threshold board (warm wood) + a lit top edge so it reads as a step.
    this.add
      .rectangle(mx, door.y, 12, DOOR_W - 8, 0x6f4a2a, 0.85)
      .setOrigin(0.5, 0.5)
      .setDepth(0.026);
    this.add
      .rectangle(mx, door.y - (DOOR_W - 8) / 2, 12, 2, 0x8a5a34, 0.9)
      .setOrigin(0.5, 0.5)
      .setDepth(0.027);
  }

  /**
   * Zone-name plaque pinned to the wall band's top-left. Opaque dark panel +
   * border + bright label, at a very high depth so no decor/furniture covers it.
   */
  private drawZoneTitle(zone: Zone, x: number, y: number, floor: 'wood' | 'tile' | 'blue'): void {
    const label = ZONE_LABEL[zone.id].toUpperCase();
    const px = x + 8;
    const py = y + 3;
    const txt = this.add
      .text(px + 5, py + 3, label, {
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: 'bold',
        color: TITLE_HEX[floor],
      })
      .setDepth(50.2);
    const pad = 5;
    const pw = txt.width + pad * 2;
    const ph = txt.height + pad * 2;
    // opaque plaque background + a 1px lit border for separation.
    this.add.rectangle(px, py, pw, ph, 0x14131a, 0.96).setOrigin(0, 0).setDepth(50);
    this.add
      .rectangle(px, py, pw, ph)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x6f6a78, 0.9)
      .setDepth(50.1);
  }

  private placeProp(d: WallDecor): void {
    // Prefer a hand-drawn pixel prop (e.g. bookshelf) for a consistent style.
    if (hasPixelProp(d.prop)) {
      const key = ensurePixelProp(this, d.prop);
      if (key) {
        this.add.image(d.x, d.y, key).setOrigin(0.5, 0.5).setDepth(0.4);
        return;
      }
    }
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
    if (zone.rug) this.drawRug(zone.rug.prop, zone.rug.x, zone.rug.y, zone.rug.scale);

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
    // side + bottom walls: thinner caps (we see them edge-on). The wall that
    // faces the hallway has a doorway GAP cut at the zone's door height so the
    // room visibly opens onto the corridor (agents walk through it).
    const sw = WALL_FACE * 0.5;
    const doorOnLeft = zone.door.x <= x + 1; // door cut into the left wall?
    const doorOnRight = zone.door.x >= x + w - 1; // …or the right wall?
    this.drawSideWall(x, y, sw, h, doorOnLeft ? zone.door.y : null); // left wall
    this.drawSideWall(x + w - sw, y, sw, h, doorOnRight ? zone.door.y : null); // right wall
    if (doorOnLeft || doorOnRight) this.drawDoorMat(zone.door, doorOnLeft);
    // bottom wall (no doors here)
    this.add
      .rectangle(x, y + h - sw, w, sw, WALL_FACE_HEX, 1)
      .setOrigin(0, 0)
      .setDepth(0.3);

    // 5) Wall-mounted decor (bookshelves, art, plants).
    if (hasIndoor(this)) for (const d of zone.decor) this.placeProp(d);

    // 4) Zone title — a solid plaque pinned to the top-left of the wall band,
    //    drawn ABOVE all in-room decor (very high depth) with an opaque dark
    //    background + border so furniture never obscures it.
    this.drawZoneTitle(zone, x, y, floor);

    // 6) Meeting conference table (central focal point — drawn beneath chairs).
    if (zone.id === 'meeting') {
      this.contactShadow(MEETING_TABLE.x, MEETING_TABLE.y + 14, 96, 0.5);
      const tableKey = ensurePixelProp(this, 'tableLong');
      if (tableKey) {
        this.add
          .image(MEETING_TABLE.x, MEETING_TABLE.y, tableKey)
          .setOrigin(0.5, 0.5)
          .setScale(1.4)
          .setDepth(0.5);
      } else if (hasIndoor(this)) {
        this.add
          .image(MEETING_TABLE.x, MEETING_TABLE.y, INDOOR_KEY, PROPS.tableLong)
          .setOrigin(0.5, 0.5)
          .setScale(3)
          .setDepth(0.5);
      }
    }

    // 7) Floor props — static furniture clusters (nook/dining/reading) that fill
    //    the empty mid/lower floor. Each may carry its own rug; y-sorted + shadow.
    if (hasIndoor(this)) {
      for (const fp of zone.floorProps) this.drawFloorProp(fp);
    }

    // 8) Station furniture (desks/counters/chairs), each with a contact shadow.
    if (hasIndoor(this)) {
      for (const st of zone.stations) this.drawStationFurniture(st);
    }
  }

  /**
   * Draw an indoor-sheet prop at (x,y) with origin 0.5,0.8. Tall props (2-tile
   * desk monitors) also draw their upper tile (`frame - 27`) one tile above so
   * the monitor renders in full instead of looking cut off.
   */
  private drawIndoorProp(name: PropName, x: number, y: number, scale: number, depth: number): void {
    // Prefer a hand-drawn pixel prop (consistent self-drawn style) when one
    // exists; fall back to the Kenney sheet otherwise.
    if (hasPixelProp(name)) {
      const key = ensurePixelProp(this, name);
      if (key) {
        this.add.image(x, y, key).setOrigin(0.5, 1).setDepth(depth);
        return;
      }
    }
    this.add
      .image(x, y, INDOOR_KEY, PROPS[name])
      .setOrigin(0.5, 0.8)
      .setScale(scale)
      .setDepth(depth);
    if (TALL_PROPS.has(name)) {
      this.add
        .image(x, y - 16 * scale, INDOOR_KEY, PROPS[name] - INDOOR_COLS)
        .setOrigin(0.5, 0.8)
        .setScale(scale)
        .setDepth(depth);
    }
  }

  /** Rug, centred at (x,y), under everything. Prefers a hand-drawn pixel rug. */
  private drawRug(prop: PropName, x: number, y: number, scale: number): void {
    if (hasPixelProp(prop)) {
      const key = ensurePixelProp(this, prop);
      if (key) {
        this.add.image(x, y, key).setOrigin(0.5, 0.5).setScale(scale).setDepth(0.05);
        return;
      }
    }
    if (hasIndoor(this)) {
      this.add
        .image(x, y, INDOOR_KEY, PROPS[prop])
        .setOrigin(0.5, 0.5)
        .setScale(scale)
        .setDepth(0.05);
    }
  }

  private drawFloorProp(fp: FloorProp): void {
    const depth = FURNITURE_DEPTH_BASE + fp.y / WORLD_H;
    if (fp.rug) this.drawRug(fp.rug.prop, fp.x, fp.y, fp.rug.scale);
    this.contactShadow(fp.x, fp.y + 10, 26 * (fp.scale ?? 2), depth);
    this.drawIndoorProp(fp.prop, fp.x, fp.y, fp.scale ?? 2, depth);
  }

  private drawStationFurniture(st: Station): void {
    const depth = FURNITURE_DEPTH_BASE + st.fy / WORLD_H;
    const isDesk =
      st.activity === 'writing' || st.activity === 'running' || st.activity === 'searching';

    if (isDesk) {
      // Coding desk = a procedurally-drawn pixel desk + computer monitor (the
      // RPG sheet has no real monitors). Texture already baked at PX=2; draw at
      // scale 1. The binary FX sits inside the screen glass (SCREEN offsets).
      const baseY = st.fy + 8;
      this.contactShadow(st.fx, st.fy + 2, 30, depth);
      this.add.image(st.fx, baseY, ensureWorkstation(this)).setOrigin(0.5, 1).setDepth(depth);
      this.screens.add(
        this.stationScreenKey(st),
        st.fx + SCREEN.cx,
        baseY + SCREEN.cy,
        depth + 0.005,
      );
      return;
    }

    // Reading stations draw no furniture — the agent browses at the wall-mounted
    // shelves (already drawn as decor); the search/read FX plays at the seat.
    if (st.activity === 'reading') return;

    // Other stations (kitchen counters, meeting chairs) use the indoor sheet.
    this.contactShadow(st.fx, st.fy + 12, 30, depth);
    this.drawIndoorProp(st.furniture, st.fx, st.fy, 2, depth);
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
    sprite.setActivity(activity); // trigger the overhead status icon if any
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
