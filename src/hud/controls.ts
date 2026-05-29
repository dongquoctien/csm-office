/**
 * Filter/search controls + setup dialog (PLAN.md Phase 4). Search text + the
 * active-only toggle persist in the URL (?q=&active=1). The setup dialog lets a
 * non-proxy/hosted user point at a csm agent URL + token (stored in
 * localStorage); the proxy path remains the default.
 */
export interface FilterState {
  query: string;
  activeOnly: boolean;
}

export interface Controls {
  state: FilterState;
  onChange: (cb: (s: FilterState) => void) => void;
}

function readUrl(): FilterState {
  const p = new URLSearchParams(window.location.search);
  return { query: p.get('q') ?? '', activeOnly: p.get('active') === '1' };
}

function writeUrl(s: FilterState): void {
  const p = new URLSearchParams(window.location.search);
  if (s.query) p.set('q', s.query);
  else p.delete('q');
  if (s.activeOnly) p.set('active', '1');
  else p.delete('active');
  const qs = p.toString();
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}

export function createControls(mount: HTMLElement): Controls {
  const state = readUrl();
  const listeners: ((s: FilterState) => void)[] = [];
  const emit = (): void => {
    writeUrl(state);
    listeners.forEach((cb) => cb(state));
  };

  const bar = document.createElement('div');
  bar.style.cssText =
    'position:absolute;bottom:10px;left:10px;display:flex;gap:8px;align-items:center;' +
    'background:rgba(16,16,20,.82);border:1px solid #2a2a30;border-radius:10px;' +
    'padding:7px 10px;font:12px ui-monospace,monospace;color:#ddd';

  const search = document.createElement('input');
  search.placeholder = 'search agents…';
  search.value = state.query;
  search.style.cssText =
    'background:#0e0e12;border:1px solid #333;border-radius:6px;color:#ddd;padding:4px 7px;width:150px';
  search.oninput = () => {
    state.query = search.value.trim().toLowerCase();
    emit();
  };

  const toggle = document.createElement('label');
  toggle.style.cssText = 'display:inline-flex;align-items:center;gap:5px;cursor:pointer';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = state.activeOnly;
  cb.onchange = () => {
    state.activeOnly = cb.checked;
    emit();
  };
  toggle.append(cb, document.createTextNode('active only'));

  const setup = document.createElement('button');
  setup.textContent = '⚙ setup';
  setup.style.cssText =
    'background:#0e0e12;border:1px solid #333;border-radius:6px;color:#aaa;cursor:pointer;padding:4px 8px';
  setup.onclick = () => openSetupDialog(mount);

  bar.append(search, toggle, setup);
  mount.appendChild(bar);

  return {
    state,
    onChange: (cb2) => listeners.push(cb2),
  };
}

const LS_URL = 'csm.agentUrl';
const LS_TOKEN = 'csm.token';

function openSetupDialog(mount: HTMLElement): void {
  const dim = document.createElement('div');
  dim.style.cssText =
    'position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;' +
    'align-items:center;justify-content:center;z-index:50';
  const box = document.createElement('div');
  box.style.cssText =
    'background:#16161a;border:1px solid #2a2a30;border-radius:12px;padding:18px 20px;' +
    'width:380px;font:12px ui-monospace,monospace;color:#ddd';
  box.innerHTML =
    '<div style="font-weight:bold;color:#fff;margin-bottom:4px">Connect to a csm agent</div>' +
    '<div style="color:#999;margin-bottom:10px">Proxy mode is the default. These override it for hosted/direct use. ' +
    'The token is per-run random — re-paste it each time you restart csm.</div>';

  const mk = (label: string, val: string, ph: string): HTMLInputElement => {
    const wrap = document.createElement('label');
    wrap.style.cssText = 'display:block;margin-bottom:8px';
    wrap.textContent = label;
    const inp = document.createElement('input');
    inp.value = val;
    inp.placeholder = ph;
    inp.style.cssText =
      'display:block;width:100%;margin-top:3px;background:#0e0e12;border:1px solid #333;' +
      'border-radius:6px;color:#ddd;padding:5px 7px';
    wrap.appendChild(inp);
    box.appendChild(wrap);
    return inp;
  };

  const urlInp = mk('Agent URL', localStorage.getItem(LS_URL) ?? '', 'http://127.0.0.1:4777');
  const tokInp = mk('Token', localStorage.getItem(LS_TOKEN) ?? '', 'paste csm token');

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:8px';
  const cancel = document.createElement('button');
  cancel.textContent = 'Cancel';
  cancel.style.cssText =
    'background:none;border:1px solid #333;border-radius:6px;color:#aaa;padding:5px 10px;cursor:pointer';
  cancel.onclick = () => dim.remove();
  const save = document.createElement('button');
  save.textContent = 'Save & reload';
  save.style.cssText =
    'background:#2f5d7c;border:none;border-radius:6px;color:#fff;padding:5px 10px;cursor:pointer';
  save.onclick = () => {
    localStorage.setItem(LS_URL, urlInp.value.trim());
    localStorage.setItem(LS_TOKEN, tokInp.value.trim());
    window.location.reload();
  };
  actions.append(cancel, save);
  box.appendChild(actions);

  dim.appendChild(box);
  dim.onclick = (e) => {
    if (e.target === dim) dim.remove();
  };
  mount.appendChild(dim);
}
