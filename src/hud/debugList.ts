/**
 * Temporary Phase-1 debug HUD: dump the world's agents as a text list to prove
 * the SSE → store → world pipeline before any game art exists. Removed/retired
 * once OfficeScene renders in Phase 2.
 */
import type { WorldState } from '../store/worldStore';
import { ACTIVITY_LABEL, ZONE_LABEL } from '../store/zoneMap';
import type { ConnectionState } from '../api/types';

export function createDebugList(mount: HTMLElement): {
  render: (world: WorldState) => void;
  setState: (s: ConnectionState) => void;
} {
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:absolute;top:8px;left:8px;max-height:90vh;overflow:auto;' +
    'background:rgba(20,20,24,.92);border:1px solid #333;border-radius:8px;' +
    'padding:10px 12px;font:12px/1.5 ui-monospace,monospace;color:#ddd;min-width:320px';
  const head = document.createElement('div');
  head.style.cssText = 'font-weight:bold;margin-bottom:6px;color:#fff';
  const conn = document.createElement('span');
  const body = document.createElement('div');
  panel.append(head, conn, body);
  mount.appendChild(panel);

  let state: ConnectionState = 'offline';
  const setState = (s: ConnectionState): void => {
    state = s;
    conn.textContent = `● ${s}`;
    conn.style.color = s === 'connected' ? '#7fc8a0' : s === 'connecting' ? '#e0a458' : '#c25d6b';
  };
  setState(state);

  const render = (world: WorldState): void => {
    head.textContent = `csm-office · debug · ${world.agents.size} agents`;
    const rows = [...world.agents.values()]
      .sort((a, b) => b.mtime - a.mtime)
      .map((a) => {
        const dot = a.active ? '🟢' : '⚪';
        const say = a.say ? ` 💬 ${a.say.slice(0, 40)}` : '';
        return `${dot} [${ZONE_LABEL[a.zone]} · ${ACTIVITY_LABEL[a.activity]}] ${a.label}${say}`;
      });
    body.textContent = rows.join('\n');
    body.style.whiteSpace = 'pre';
  };

  return { render, setState };
}
