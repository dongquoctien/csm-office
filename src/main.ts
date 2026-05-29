import Phaser from 'phaser';
import { OfficeScene } from './game/OfficeScene';
import { createHud } from './hud/hud';
import { createPanel } from './hud/panel';
import { createControls, type FilterState } from './hud/controls';
import { createSseClient } from './api/sse';
import { applySnapshot, emptyWorld, type WorldState } from './store/worldStore';
import { diffWorlds } from './store/diff';
import type { Snapshot } from './api/types';

/**
 * Phase 2 boot: the OfficeScene renders the 3-zone office and places agents from
 * the store. Data flows snapshot → worldStore → diff → scene.applyIntents. Mock
 * fixture drives it in dev until a live csm token is proxied.
 */
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0b0e',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  pixelArt: true,
  scene: [OfficeScene],
});

// Dev-only: expose for debugging/verification in the browser console.
if (import.meta.env.DEV) {
  (window as unknown as { game: Phaser.Game }).game = game;
}

const hudEl = document.getElementById('hud') as HTMLElement;
const hud = createHud(hudEl);
const panel = createPanel(hudEl);
const controls = createControls(hudEl);

let world = emptyWorld();

// --- Filter / search --------------------------------------------------------
function matches(id: string, f: FilterState): boolean {
  const a = world.agents.get(id);
  if (!a) return false;
  if (f.activeOnly && !a.active) return false;
  if (f.query) {
    const hay = `${a.label} ${a.activity} ${a.session.branch ?? ''}`.toLowerCase();
    if (!hay.includes(f.query)) return false;
  }
  return true;
}

function applyFilter(): void {
  const s = scene();
  if (s) s.setFilter((id) => matches(id, controls.state));
}
controls.onChange(applyFilter);

function names(w: WorldState): Map<string, string> {
  const m = new Map<string, string>();
  for (const [id, a] of w.agents) m.set(id, a.label);
  return m;
}

function scene(): OfficeScene | null {
  const s = game.scene.getScene('Office') as OfficeScene | null;
  return s && s.scene.isActive() ? s : null;
}

function ingest(snapshot: Snapshot): void {
  const next = applySnapshot(snapshot);
  const intents = diffWorlds(world, next);
  world = next;
  scene()?.applyIntents(intents, names(world));
  hud.setCount(world.agents.size);
  applyFilter();
}

let live = false;
const sse = createSseClient({
  onSnapshot: (snap) => {
    live = true;
    ingest(snap);
  },
  onState: (s) => hud.setState(s),
});
sse.start();

// Dev-only mock stream: animates agents so motion/bubbles are visible without a
// live csm token. Stands down automatically once a real snapshot arrives.
if (import.meta.env.DEV) {
  import('./dev/mockStream').then(({ startMockStream }) => {
    startMockStream(ingest, () => live);
  });
}

// Re-apply once the scene finishes booting (in case data arrived first).
game.events.once(Phaser.Core.Events.READY, () => {
  const s = scene();
  if (!s) return;
  // Click an agent → open its detail panel.
  s.events.on('agent-click', (id: string) => {
    const a = world.agents.get(id);
    if (a) panel.open(a);
  });
  if (world.agents.size > 0) {
    const intents = diffWorlds(emptyWorld(), world);
    s.applyIntents(intents, names(world));
    hud.setCount(world.agents.size);
    applyFilter();
  }
});
