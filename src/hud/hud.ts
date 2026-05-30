/**
 * DOM HUD overlay (PLAN.md Phase 2): connection pill + agent count + zone legend
 * over the canvas. Pure DOM; mirrors store/SSE state pushed in from main.ts.
 */
import type { ConnectionState } from '../api/types';
import { ZONE_LABEL, type ZoneId } from '../store/zoneMap';

const ZONE_COLOR: Record<ZoneId, string> = {
  coding: '#9b6a3f',
  read: '#c2885a',
  kitchen: '#cdbb8e',
  meeting: '#5b8def',
};

export interface Hud {
  setState: (s: ConnectionState) => void;
  setCount: (n: number) => void;
}

export function createHud(mount: HTMLElement): Hud {
  const bar = document.createElement('div');
  bar.style.cssText =
    'position:absolute;top:10px;left:10px;display:flex;gap:14px;align-items:center;' +
    'background:rgba(16,16,20,.82);border:1px solid #2a2a30;border-radius:10px;' +
    'padding:8px 12px;font:12px ui-monospace,monospace;color:#ddd';

  const pill = document.createElement('span');
  const count = document.createElement('span');
  count.style.color = '#9a9a9a';

  const legend = document.createElement('span');
  legend.style.cssText = 'display:flex;gap:12px;margin-left:6px';
  (Object.keys(ZONE_LABEL) as ZoneId[]).forEach((z) => {
    const item = document.createElement('span');
    item.style.cssText = 'display:inline-flex;align-items:center;gap:5px';
    const dot = document.createElement('span');
    dot.style.cssText = `width:9px;height:9px;border-radius:2px;background:${ZONE_COLOR[z]}`;
    const txt = document.createElement('span');
    txt.textContent = ZONE_LABEL[z];
    item.append(dot, txt);
    legend.appendChild(item);
  });

  bar.append(pill, count, legend);
  mount.appendChild(bar);

  const setState = (s: ConnectionState): void => {
    pill.textContent = `● ${s}`;
    pill.style.color = s === 'connected' ? '#7fc8a0' : s === 'connecting' ? '#e0a458' : '#c25d6b';
  };
  setState('offline');

  return {
    setState,
    setCount: (n) => {
      count.textContent = `${n} agents`;
    },
  };
}
