/**
 * Agent detail panel (PLAN.md Phase 4). Opens on agent click; shows store-known
 * fields immediately (model, branch, tokens, cost, modified files) and lazily
 * fetches /api/session for a tokens-over-time sparkline (live only — falls back
 * gracefully when offline/mock). Pure DOM.
 */
import { fetchSessionDetail } from '../api/session';
import type { AgentState } from '../store/worldStore';

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function sparkline(values: number[]): string {
  if (!values.length) return '';
  const bars = '▁▂▃▄▅▆▇█';
  const max = Math.max(...values, 1);
  return values.map((v) => bars[Math.min(7, Math.floor((v / max) * 7))]).join('');
}

export interface Panel {
  open: (agent: AgentState) => void;
  close: () => void;
}

export function createPanel(mount: HTMLElement): Panel {
  const el = document.createElement('div');
  el.style.cssText =
    'position:absolute;top:10px;right:10px;width:280px;display:none;' +
    'background:rgba(16,16,20,.94);border:1px solid #2a2a30;border-radius:10px;' +
    'padding:12px 14px;font:12px/1.55 ui-monospace,monospace;color:#ddd';
  mount.appendChild(el);

  const close = (): void => {
    el.style.display = 'none';
    el.replaceChildren();
  };

  const open = (a: AgentState): void => {
    el.replaceChildren();
    el.style.display = 'block';

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:bold;color:#fff;margin-bottom:6px';
    title.textContent = a.label;

    const x = document.createElement('button');
    x.textContent = '✕';
    x.style.cssText =
      'float:right;background:none;border:none;color:#888;cursor:pointer;font:12px monospace';
    x.onclick = close;
    title.appendChild(x);

    const s = a.session;
    const rows = document.createElement('div');
    rows.style.color = '#bbb';
    rows.innerText = [
      `activity   ${a.activity}${a.active ? ' (active)' : ''}`,
      `model      ${s.model ?? '—'}`,
      `branch     ${s.branch ?? '—'}`,
      `messages   ${s.messages}`,
      `tokens     ${fmt(s.totalTokens)}  (cache ${Math.round(s.cacheHitRate * 100)}%)`,
      `cost       $${s.costUSD.toFixed(2)}`,
      `files      ${s.modifiedFiles.length}`,
    ].join('\n');
    rows.style.whiteSpace = 'pre';

    const spark = document.createElement('div');
    spark.style.cssText = 'margin-top:8px;color:#7fc8a0';
    spark.textContent = 'tokens/time  loading…';

    el.append(title, rows, spark);

    // Lazy: tokens-over-time (live only).
    fetchSessionDetail(a.id, s.projectSlug).then((detail) => {
      if (el.style.display === 'none') return;
      if (detail?.tokenBuckets?.tokens?.length) {
        spark.textContent = `tokens/time  ${sparkline(detail.tokenBuckets.tokens)}`;
      } else {
        spark.textContent = 'tokens/time  (live only)';
        spark.style.color = '#777';
      }
    });
  };

  return { open, close };
}
