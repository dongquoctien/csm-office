# csm-office — Implementation Plan

> A realtime pixel-art "operating system" that visualizes AI agents (Claude Code
> sessions) working collaboratively inside a virtual office. This is the
> standalone game frontend; it **consumes the existing `/api/stream` from
> [claude-session-manager](https://github.com/dongquoctien/claude-session-manager)
> (csm)** rather than reading Claude logs itself.

This plan is the source of truth for building csm-office. It is written to be
executed incrementally; each phase is independently shippable and verifiable.

---

## 0. Context & goals

### Why this exists
csm already ships an MVP "Office" tab (no-dep SVG/CSS) that proved the core idea:
each session becomes an avatar that moves to a room matching its activity. That
MVP is intentionally lightweight and lives inside csm's zero-dependency web UI.

`csm-office` is the **richer, game-engine version** of that idea, kept in its own
repo because it needs a heavier stack (build tooling + a 2D engine) that would
violate csm's "no bundler, no deps" rule.

### Goals (in priority order)
1. **Faithful realtime mirror** of agent activity from csm's `/api/stream`.
2. **Game-like presentation**: tilemap office, animated sprite agents that walk
   between rooms, idle/work animations, speech bubbles, ambient life.
3. **Readable at a glance**: you can tell who is doing what, where work is
   piling up, and which agents are stuck — faster than reading logs.
4. **Zero setup friction for the viewer**: point it at a running csm agent URL +
   token and it just works; no separate backend to run.

### Explicit non-goals (v1)
- No re-parsing of `~/.claude` logs (csm owns that; we only consume its API).
- No write actions (open/delete/fork) — read-only viewer. (Can come later.)
- No multi-machine aggregation, auth beyond csm's per-run token, or persistence.

### Visual target (the look we are aiming for)
See **`docs/art-target.jpg`** — a top-down pixel-art office (Stardew/RPG style):
warm wood floor for one zone, grey/blue floors for others, real furniture tiles
(double-monitor desks, bookshelves, plants, vending machine, fridge, wall art,
meeting nook), and **sprite characters with a walk-cycle** moving around.

This is the bar for csm-office (it is intentionally *beyond* what csm's no-dep
SVG "Office" tab does — that one stays a light, readable diagram). Concretely the
v1 look should hit:
- **Tilemap** floors/walls per zone with distinct flooring (not flat cards).
- **Furniture tiles** that make each room read as Coding / Reading / Meeting /
  Kitchen / etc. at a glance.
- **Character sprite sheets** with idle + 4-direction walk frames (not a single
  vector face).
- Soft lighting/shadows and props for "a place", not a dashboard.

> Note: `docs/art-target.jpg` appears to be a screenshot of an existing project
> ("Pixel Agents for VS Code"). Use it ONLY as inspiration for layout/feel —
> **do not copy its assets or code**; source our own permissively-licensed tiles
> (see §2 Asset note) and record provenance in `ASSETS.md`.

---

## 1. Hard reality checks (do not skip)

These constraints come from reading csm's actual source. Building against wrong
assumptions here will waste the most time.

> **Verified 2026-05-29** against the local csm checkout at
> `D:\Github\claude-session-manager`. Discrepancies from the original plan are
> flagged inline with **[VERIFIED]** / **[CORRECTED]**. Source-of-truth files:
> - Server/API: `packages/agent/src/server.js`
> - Data shapes + activity/status derivation: `packages/core/src/scanner.js`,
>   `packages/core/src/metrics.js`
> - MVP office to port from: `packages/ui/public/app.js` (`OfficePro` /
>   `OfficeClassic`, ~lines 1187–2015), `index.html`, `styles.css`

### 1.1 Claude Code does not emit events
csm **infers** state by file-watching `*.jsonl` and re-scanning (debounced
~400ms, plus a 5s safety poll). Therefore:
- Updates are **session-level**, latency sub-second to a few seconds — NOT
  keystroke-level. Animations must be smooth *interpolations between snapshots*,
  not driven by a high-frequency event firehose.
- "activity" is a derived label from the **last** tool/turn. **[CORRECTED]**
  There are TWO timeouts, not one (`metrics.js`):
  - `ACTIVITY_TIMEOUT_MS = 30_000` — if no tool used in the last 30s, activity
    falls back toward `idle`.
  - `WAITING_TIMEOUT_MS = 120_000` — a session whose last turn is assistant text
    (awaiting a human) stays `waiting` for up to 2 min before becoming `idle`.
  So `idle` is the common resting state, but `waiting` is a meaningful, longer
  "assistant finished, human hasn't replied" state — render it distinctly (the
  art-target's kitchen/lounge zone is a natural home for it).
- `active` boolean **[VERIFIED]** = `now - lastActivityMs < 60_000`
  (`ACTIVE_WINDOW_MS = 60_000`).

### 1.2 The exact API contract (csm `packages/agent/src/server.js`) **[VERIFIED]**
- **SSE:** `GET /api/stream` — token via `?token=<TOKEN>` **or** header
  `x-csm-token` (constant-time compared, `server.js`). `EventSource` can't set
  headers → we use `?token=`.
  - Response headers: `content-type: text/event-stream; charset=utf-8`,
    `cache-control: no-store`, `connection: keep-alive`,
    **`x-accel-buffering: no`** (already disables nginx buffering upstream — good
    for our proxy; see §1.3).
  - Opens with `retry: 3000\n\n`.
  - Emits `event: snapshot\ndata: <JSON>\n\n` on every change + a **5s** safety
    poll.
  - Emits `event: error\ndata: {"error":"..."}` on scan failure.
  - Sends `: ping\n\n` comment heartbeats **every 15s** — ignore.
- **One-shot fallback:** `GET /api/monitor?token=` → same snapshot JSON once (no
  other params).
- **Single session detail:** `GET /api/session?id=&slug=` → `{ session,
  tokenBuckets }` where `tokenBuckets = { ts: number[], tokens: number[] }`
  (parallel arrays for the tokens-over-time chart). `id` matches by prefix;
  `slug` disambiguates the same UUID across projects.
- **[CORRECTED] Also exists — not in original plan:**
  - `GET /api/sessions?q=&fav=1&orphans=0&branch=&recent=<days>` → `{ sessions,
    count, branches }`. A filtered list endpoint; handy for a search/filter HUD
    without re-deriving from the stream.
  - **POST write endpoints** (token-gated): `/api/open`, `/api/favorite`,
    `/api/delete`, `/api/delete-bulk`, `/api/restore`, `/api/restore-bulk`
    (bulk capped at `MAX_BULK = 500`). v1 stays read-only, but these are the
    exact hooks for the "write actions later" door (§9.4) — design the API layer
    so they can be added without restructuring.
- **Snapshot JSON shape [VERIFIED]** (`scanner.js`):
  ```ts
  {
    sessions: MonitorSession[],
    systemStats: {
      activeSessions, totalSessions, totalMessages, tokensUsed,
      totalCost, avgDurationMs, topModel,           // topModel: string|null
      byModel: { model, tokens, costUSD }[]
    }
  }
  ```
- **MonitorSession** (the unit we render). **[CORRECTED]** Verified against the
  actual object spread in `scanner.js` (the enriched return, *not* the base
  `Session` typedef). Fields present in the stream:
  ```ts
  {
    id: string,            // stable key for an agent sprite
    title: string, titleSource: string,
    cwd: string|null, branch: string|null,
    projectSlug: string, projectLabel: string,   // human label for the agent
    mtime: number,         // last-touched epoch ms (recency)
    favorite: boolean,     // <- present in stream (plan had omitted it)
    cwdExists: boolean,
    activity: string,      // 9 values, see §1.5
    active: boolean,       // now - lastActivityMs < 60_000
    status: string,        // unknown|waiting|thinking|tool|idle
    model: string|null,
    tokens: { input, output, cacheCreation, cacheRead },
    totalTokens, costUSD, cacheHitRate,
    messages: number, durationMs: number,
    modifiedFiles: string[],
    recentMessages: { role, text, ts }[]   // text trimmed to 300 chars (exact)
  }
  ```
  - **NOT in the stream** (exist on the base `Session` but are dropped from the
    enriched snapshot): `lastPrompt`, `size`, `file`. Do **not** type these on
    `MonitorSession`; if you need an absolute file path or the raw last prompt,
    they are unavailable from `/api/stream`.

### 1.5 Activity & status — exact derivation **[VERIFIED]** (`metrics.js`)
- `activity` ∈ exactly these 9 (`Activity` frozen enum): `idle, waiting,
  thinking, reading, writing, running, searching, browsing, spawning`. Derived
  by `resolveActivity()`: a tool used within 30s maps via `toolActivity(tool)`;
  else `Thinking` status → `thinking`; else `waiting` (within 120s) → else
  `idle`.
- `status` ∈ `unknown, waiting, thinking, tool, idle` (`Status` frozen enum),
  from `determineStatus(last)`: assistant+`tool_use` → `tool`; assistant text →
  `waiting`; user `tool_result` or prompt → `thinking`.
- `activity` (9 rooms) drives placement; `status` is finer turn-state — use it
  only for nuance (e.g. a "tool running" indicator) if at all.

### 1.3 CORS / cross-origin is the #1 technical risk **[VERIFIED]**
csm's agent **binds `127.0.0.1` only** (`HOST` is hardcoded, `DEFAULT_PORT =
4777`), requires a **per-run random token** (`crypto.randomBytes(24)`, header
`x-csm-token` OR `?token=`), and enforces a **Host header allowlist**
(`127.0.0.1` / `localhost`, returns 403 otherwise) to defeat DNS-rebinding. It
sends **no CORS headers** at all (confirmed: no `Access-Control-Allow-Origin`
anywhere in `server.js`).
- **[CORRECTED] EventSource IS subject to CORS, same as fetch.** A cross-origin
  EventSource is a simple GET (no preflight), but the browser still blocks the
  page from reading the stream unless the upstream returns
  `Access-Control-Allow-Origin`. Since csm sends none, a browser page on `:5173`
  talking directly to `127.0.0.1:4777` **will be blocked** — both for the SSE
  stream and for `/api/session` (fetch). This makes Proxy mode not just cleaner
  but effectively *required* for v1 (Direct mode needs an upstream csm change).
- `EventSource` can't set custom headers → token must go in `?token=`. With the
  proxy, the token is injected server-side and never reaches client JS.
- **Decision (v1):** run csm-office in one of two modes, pick per environment:
  - **(A) Proxy mode (default, simplest):** csm-office's dev/prod server proxies
    `/api/*` to the csm agent (same-origin to the browser) and injects the token
    server-side. No CORS, token never in client JS. Recommended.
  - **(B) Direct mode:** browser talks straight to the csm agent with `?token=`.
    Requires csm to add an opt-in CORS allow for the office origin — a small
    upstream change to csm (`Access-Control-Allow-Origin` on `/api/*` behind a
    flag). Document as a follow-up PR to csm if chosen.
- Plan builds **Proxy mode** first; it sidesteps every Host/CORS/token-exposure
  issue and keeps the viewer "point-and-run".

### 1.4 Room mapping is a heuristic
Activity → room is a direct map of csm's 9 activity states. Finer rooms
(Research/QA/Deploy) would require guessing from tool + bash command and are
**out of scope for v1** — keep the 9 activity rooms csm already defines so the
mapping is exact.

---

## 2. Tech stack (decided)

> **[CORRECTED 2026-05-29]** Versions/choices below verified against current
> releases. Key changes from the original plan: **Phaser 4** (not 3), **Vite 8**,
> and **Hono** for the prod server (not Express).

| Concern | Choice | Why |
|---|---|---|
| Framework | **Vite 8 + vanilla TS** (no Next.js for v1) | The app is a single full-screen canvas; SSR/routing add nothing. Keep it lean. Vite 8 (stable 2026-03, Rolldown default) — Vite 7 is fine if avoiding the Rolldown migration. |
| 2D engine | **Phaser 4** (stable 2026-04-10, "Beam" WebGL renderer) | Batteries-included tilemap/sprites/tweens/input — exactly the office-with-walking-characters case. v4 is the current major; v3→v4 migration for plain sprites/tilemaps/text is hours, only custom shaders (we have none) need rework. Use the official `phaserjs/template-vite-ts` but **verify it tracks v4** before adopting; else bump deps. Bundle ~250–350 KB gzipped — immaterial for a localhost tool. PixiJS is a defensible lighter alternative (we'd hand-write tilemap/anim glue) but Phaser gets us to a working office faster. |
| Language | **TypeScript** | Type the API contract once (§1.2) → safer rendering code. |
| Styling (HUD overlay) | Plain CSS (+ optional Tailwind) | HUD (top bar, legend, connection pill) is DOM over the canvas. |
| Server (proxy + static) | **Hono on `@hono/node-server`** (or bare `node:http` for zero deps) | First-class `streamSSE`, web-standard, serves static via `@hono/node-server/serve-static`. **Avoid Express** — its `compression` middleware buffers and freezes `text/event-stream`. See §3.3 for SSE-proxy rules. |
| Package manager | npm (match csm) | Consistency. |
| Tests | **Vitest** for pure logic (snapshot→world-state reducers); manual + screenshot for the canvas | Game rendering isn't unit-tested; the *reducer* that turns snapshots into agent intents IS. |

> Asset note **[license terms verified 2026-05-29]**: pixel tileset + character
> sprites are what make it match `docs/art-target.jpg`. Sources, by safety:
> - **Kenney.nl — CC0 (recommended default).** Every pack is public domain: no
>   attribution, no share-alike, commercial OK, vendoring into a public repo OK.
>   Use "Tiny Town", "Roguelike/RPG Indoors", "Furniture Kit". **Zero obligations
>   — standardize on this.**
> - **LPC characters — CC-BY-SA 3.0/4.0 + GPLv3 (copyleft).** 4-direction
>   walk-cycle sheets, but the **share-alike obligation propagates**: any derived
>   *artwork* must be released CC-BY-SA and you must credit every contributor per
>   `CREDITS.TXT`. Many community LPC pieces add *their own* licenses — verify
>   each asset. Use only if you accept share-alike on the art.
> - **LimeZu "Modern Interiors" — closest look, but do NOT vendor into the public
>   repo.** Paid version is CC-BY (attribution, commercial OK) **but you may not
>   redistribute the assets themselves** — committing them to a public repo lets
>   anyone copy them, which conflicts with that clause. Free version is
>   non-commercial only. Treat as a paid local dependency if used at all.
> Rules: prefer **CC0 (Kenney)**; **never** reuse assets from the art-target
> screenshot's project; record every source + license + obligation in
> `ASSETS.md`. Need at minimum: a floor/wall tileset, ~6–8 furniture props per
> room kind (the target shows: double-monitor desks + bookshelves + plants for
> Coding; vending machine/fridge/microwave/wall-clock for the kitchen/waiting
> zone; framed art + meeting table for the meeting/reading zone), and one
> character sheet (idle + N/S/E/W walk) recolorable per agent via the MVP's
> palette tints (§4.4).

---

## 3. Architecture

### 3.0 Dependency boundary — csm-office is source-independent of csm
csm-office must **not** build- or source-depend on the csm repo. The only
coupling is the **runtime HTTP/SSE API** (§1.2), spoken over the network between
two separate processes. Concretely:
- **No** `package.json` dependency on csm, **no** path/`file:` dependency, **no**
  git submodule, **no** `import` from `../claude-session-manager`. (Current repo:
  zero such references — keep it that way.)
- The wire types (§1.2) are **re-declared** in `src/api/types.ts`, owned by this
  repo — they are not imported from csm. They happen to mirror csm's shapes; if
  csm changes its API, we update our copy. (csm doesn't publish a types package,
  and we don't want a build-time coupling even if it did.) **✅ Done:**
  `src/api/types.ts` already scaffolded with the verified contract (9 activities,
  5 statuses, `MonitorSession` minus the dropped `lastPrompt`/`size`/`file`,
  `Snapshot`, `SessionDetail`, SSE envelope).
- Reused MVP logic (`hashId`, palettes, slot/routing/bubble logic — §4.4/§4.5) is
  **manually re-implemented once** into this repo's own files, NOT imported. It's
  a clean-room port of *behavior*, not a linked dependency. Record any
  copied-verbatim snippet's origin + license in this repo if csm's license
  requires it (csm is MIT → attribution-friendly; note it in `ASSETS.md`/NOTICE).
- The local checkout at `D:\Github\claude-session-manager` is a **reference for
  humans/agents only** (to verify the contract and study the MVP). Nothing in the
  build reads from that path.

Net: you can delete the csm *source* checkout and csm-office still builds and
type-checks; it only needs a *running* csm agent to show live data.

```
┌──────────────────────────────────────────────────────────┐
│ Browser (csm-office)                                       │
│                                                            │
│  HUD (DOM/CSS)         Phaser Game (canvas)                │
│  ─ connection pill     ─ OfficeScene: tilemap + rooms      │
│  ─ legend / filters    ─ AgentSprite pool (one per id)     │
│  ─ token/URL setup     ─ bubbles, tweens, pathing          │
│        │                        ▲                          │
│        └──────────┬─────────────┘                          │
│             world-store (framework-agnostic)               │
│        ─ holds current agents + diff vs last snapshot      │
│        ─ emits intents: spawn / move-room / setActivity /  │
│          say / despawn                                     │
│                   ▲                                        │
│             SSE client (EventSource → /api/stream)         │
└───────────────────┼────────────────────────────────────────┘
                    │ same-origin /api/* (proxied)
┌───────────────────┴────────────────────────────────────────┐
│ csm-office server (Vite middleware / prod node)             │
│   proxy /api/* ──► http://127.0.0.1:<csmPort>/api/* (+token) │
└─────────────────────────────────────────────────────────────┘
                    │
              csm agent /api/stream (unchanged)
```

### 3.1 Layered modules (keep boundaries clean)
- `src/api/` — SSE client + types. Knows the wire format (§1.2). Reconnect with
  backoff; surface connection state. **No Phaser imports here.**
- `src/store/` — `worldStore`: pure reducer `applySnapshot(prev, snapshot) →
  { agents: Map<id, AgentState>, stats }` + a **diff** that yields ordered
  intents (`spawn`, `despawn`, `moveRoom`, `activity`, `say`). Pure + unit-tested.
- `src/game/` — Phaser scenes/sprites. **Consumes intents from the store**, never
  the raw SSE. This is the only layer that imports Phaser.
- `src/hud/` — DOM overlay (connection, legend, filters, setup dialog).
- `src/config.ts` — runtime config (csm agent URL/token via proxy; recent-window
  minutes; tunables).

### 3.2 Why a store between SSE and Phaser
The MVP's lesson: snapshots are coarse and bursty, and filter/UI state must
survive refreshes. A pure store that **diffs snapshots into intents** lets the
game layer animate transitions (walk to new room) instead of teleporting, makes
the hard part **unit-testable**, and decouples engine choice from data.

### 3.3 SSE proxy rules **[researched 2026-05-29 — easy to get wrong]**
Both the **dev** proxy (Vite `server.proxy`) and the **prod** proxy (Hono) carry
a long-lived `text/event-stream`. Defaults will break it. Requirements:
- **Dev (Vite `server.proxy`):** per-route entry for `/api` with
  `changeOrigin: true`, **extended `timeout` + `proxyTimeout`** (e.g.
  `3600000`) so idle streams aren't dropped, and a `configure(proxy)` hook on
  the `proxyReq` event to **inject the token server-side** (append `?token=` or
  set `x-csm-token`) so it never appears in client JS. Read the upstream
  URL/token from env (`CSM_AGENT_URL`, `CSM_TOKEN`). csm already sends
  `x-accel-buffering: no` + `cache-control: no-store`, so the dev proxy doesn't
  buffer once timeouts are set. (Known dev-only quirk: Vite doesn't always fire
  the SSE *close* event — cosmetic for cleanup, not a prod issue.)
- **Prod (Hono):** **never** put compression/gzip middleware on the `/api/*`
  route — it buffers and freezes the stream. Forward the upstream's
  `x-accel-buffering: no` / `cache-control` verbatim, don't buffer the response,
  and inject the token server-side. A ~25s heartbeat comment keeps idle
  intermediaries from killing the socket (csm's own 15s ping covers this for the
  upstream leg, but emit one on the proxy leg if you terminate/relay).
- **Why this beats Direct mode:** same-origin via the proxy avoids CORS entirely
  (§1.3) *and* keeps the token off the client. Direct mode would require an
  upstream CORS opt-in in csm — a follow-up PR, not v1.

---

## 4. Data → world mapping (the core logic)

### 4.1 Recent-window filter (reuse MVP lesson)
Only render agents that are `active || (now - mtime < RECENT_MS)` (default 30
min, configurable). Prevents the Idle room from filling with 100+ dead sessions
(this exact bug was fixed in the csm MVP).

### 4.2 Activity → room (exact, 9 rooms)
`idle, waiting, thinking, reading, writing, running, searching, browsing,
spawning`. Friendly labels (Coding=writing, Running=running, etc.) but the key is
the raw activity. Lay rooms out on the tilemap; each room has spawn slots.

### 4.3 Intents emitted by the diff
- `spawn(id, look)` — new agent enters the building (walks in from a door).
- `despawn(id)` — left the snapshot/recent window (walks out / fades).
- `moveRoom(id, room)` — activity changed → pathfind/walk to the new room.
- `activity(id, state, active)` — same room, update idle/work animation.
- `say(id, text)` — new `recentMessages` tail → speech bubble (rotated, 1/room).

### 4.4 Deterministic avatar look — **clean-room port from MVP** **[VERIFIED]**
The MVP (`packages/ui/public/app.js`) already solved this. **Re-implement the
same logic into this repo's own `src/store/look.ts`** (copy the snippet/values by
hand — NOT an import from csm; see §3.0) so the same session is the same
character across reconnects:
- **`hashId(id)` = FNV-1a 32-bit** (`h=2166136261; h^=c; h=Math.imul(h,16777619);
  return h>>>0`). Stable across runtimes — copy as-is.
- **Feature bits** (shift positions into the hash): SKIN ⟵ bit 2 (7 colors),
  HAIR ⟵ bit 5 (11), SHIRT ⟵ bit 21 (10), HAT color ⟵ bit 17 (6), gender lean
  ⟵ bit 28, hair-style ⟵ bit 9 (5 per gender), glasses ⟵ bit 24 (~30%), hat
  presence ⟵ bit 13. **Copy the exact palette arrays from the MVP** (`SKIN`,
  `HAIR`, `SHIRT`, `HAT`) — they're contrast-balanced and tie to the room
  colors. In Phaser, drive sprite tints/frames from these instead of redrawing
  SVG.

### 4.5 Other MVP logic to port **[VERIFIED — saves real time]**
The MVP's `OfficePro` already solved problems we'd otherwise rediscover. Port the
*logic* (re-express in Phaser; the MVP is SVG/DOM):
- **Slot system** — each room has a fixed pool of non-overlapping slots;
  `takeSlot`/`releaseSlot` assign/free on room change, round-robin reuse when
  full. ⚠️ Gotcha: overflow silently stacks — we should cap + `log()` instead
  (§4.1 keeps counts small, but be explicit).
- **Lounge routing** — agents walk *out the old room's door → across the lounge →
  in the target room's door → to the slot*, never cutting through walls. Speed
  `0.18 px/ms`, per-leg duration `clamp(dist/SPEED, 180, 1400)ms`, timer-driven
  (not `transitionend`), and **respect `prefers-reduced-motion`** (no tween).
- **Speech bubbles** — 1 per room, rotated every **3000ms**; rotation prefers
  `active` agents, falls back to all-with-text; source is the `recentMessages`
  tail (MVP truncates to 80 chars — prefer word-boundary truncation). Maps onto
  §4.3's `say` intent.
- **Lounge TV feed** — a shared panel showing the 8 most recent messages across
  visible agents (sorted by `ts`), refreshed per snapshot. Nice ambient detail
  and a natural fit for the kitchen/lounge zone in the art target.
- **Active-flip redraw only** — MVP only re-renders a face when `active` flips;
  the Phaser analog is to swap idle↔work anim only on the `activity`/`active`
  intent, not every snapshot.
- ⚠️ **Perf note:** `OfficePro` (routing math + per-agent timers) is heavier than
  the classic grid; validate the §4.1 recent-window keeps it smooth at 30+ and
  cap+log beyond (§ Phase 4 perf pass).

---

## 5. Phased delivery (each phase = a shippable increment)

### Phase 0 — Scaffold (½ day)
- `npm create vite@latest` (vanilla-ts), add Phaser, Vitest, ESLint/Prettier.
- `src/config.ts`, empty layered folders, a black Phaser canvas that boots.
- **Verify:** `npm run dev` shows an empty scene; `npm run build` succeeds.

### Phase 1 — Data spine (1 day) — *prove the contract before any art*
- `src/api/sse.ts`: EventSource to `/api/stream`, parse `snapshot`/`error`,
  reconnect w/ backoff, expose `onSnapshot`/`onState`.
- `src/api/types.ts`: the §1.2 types.
- Dev proxy: Vite `server.proxy` for `/api/*` → csm agent, token injected from an
  env var (`CSM_AGENT_URL`, `CSM_TOKEN`). (§1.3 mode A.)
- `src/store/worldStore.ts` + `diff.ts`: pure reducer + intent diff. **Vitest**
  for: spawn/despawn/moveRoom/activity/say, recent-window filter, stable look.
- Temporary debug HUD: dump agents as a text list to confirm live data.
- **Verify:** run a csm agent on throwaway data; the text list updates live as
  files change. Unit tests green. *No game art yet — contract proven first.*

### Phase 2 — Static office (1–2 days)
- Tilemap office with the 9 rooms (Tiled JSON or hand-built grid), walls, floor,
  doors, room labels. Camera fits/zoom-to-fit; responsive.
- Render one **static** avatar per agent placed in its room's slot (no walking
  yet) from the store snapshot.
- HUD overlay: connection pill (connecting/connected/offline mirroring SSE),
  agent count, room legend, theme.
- **Verify:** agents appear in correct rooms; matches csm Monitor tab for the
  same data; resizing works.

### Phase 3 — Life & motion (2–3 days)
- AgentSprite: idle/walk/work animations; **walk between rooms** on `moveRoom`
  (simple grid pathfinding or straight-line tween via doorways).
- Speech bubbles from `say` intents — rotated 1-per-room (MVP lesson) so they
  never overlap; content = `recentMessages` tail.
- Active vs idle visual distinction (bob, glow, posture).
- Smooth interpolation so coarse snapshots look continuous.
- **Verify:** change a session's activity → its character walks to the new room;
  bubbles rotate; busy room doesn't break layout; 30+ agents stay readable.

### Phase 4 — Depth & polish (2–3 days)
- Click an agent → side panel with detail (fetch `/api/session` for tokenBuckets,
  cost, model, modified files) — small, optional.
- Ambient touches: desks/props per room, day/night tint, subtle SFX (toggle).
- Filters (by model/active) and search mirroring csm; persist in URL.
- Setup dialog for csm agent URL + token (for hosted/non-proxy users; remember
  csm's token is per-run random, so it must be re-entered each csm launch).
- Performance pass: object pooling, cap visible sprites, requestAnimationFrame
  hygiene; verify with 100+ recent agents (degrade gracefully — log if capped).
- **Verify:** Lighthouse/Perf trace acceptable; works in Chromium + the csm
  Electron build if embedded.

### Phase 5 — Ship (½ day)
- README: how to run against a csm agent (proxy env vars), screenshots/gif.
- `ASSETS.md` with sprite licenses. CI: build + vitest on push.
- Tag v0.1.0; (optional) static deploy that asks for a csm URL/token at runtime.

---

## 6. Repo layout (target)

```
csm-office/
  PLAN.md                ← this file
  README.md
  ASSETS.md              ← sprite/tileset licenses
  package.json
  vite.config.ts         ← dev proxy /api/* → csm agent
  server/                ← prod static + /api proxy (node)
  public/assets/         ← tilesets, sprite sheets
  src/
    config.ts
    main.ts              ← boot Phaser + HUD + wire store↔game
    api/{sse.ts,types.ts}
    store/{worldStore.ts,diff.ts,look.ts}   ← pure, tested
    game/{OfficeScene.ts,AgentSprite.ts,rooms.ts,bubble.ts}
    hud/{connection.ts,legend.ts,setup.ts}
  test/{diff.test.ts,worldStore.test.ts,look.test.ts}
```

---

## 7. Risks & mitigations (summary)

| Risk | Severity | Mitigation |
|---|---|---|
| CORS blocks browser→agent (csm sends no CORS, **verified**) | High | Proxy mode is the only v1 path (§1.3); token server-side. Direct needs an upstream csm CORS PR. |
| SSE proxy misconfig buffers/drops the stream | High | §3.3 rules: no compression on `/api/*`, long timeouts, pass `x-accel-buffering: no`, server-side token inject. |
| Coarse/bursty snapshots → jittery animation | Med | Store diffs → intents; tween/interpolate in game layer. |
| Idle room floods with old sessions | Med | Recent-window filter (§4.1), proven in MVP. |
| Asset licensing (LPC share-alike, LimeZu no-redistribute) | Med | Default to CC0 Kenney; record obligations in ASSETS.md; don't vendor LimeZu paid art. |
| Engine glue creep | Med | Strict layer boundaries (§3.1); Phaser only in `src/game`. |
| Scope explosion (replay, graphs, terminal) | Med | v1 is read-only viewer; defer extras to a v2 list. |
| Perf with many agents (`OfficePro` routing is heavy) | Low–Med | Pool sprites, cap + log, recent-window keeps counts small. |
| csm token is per-run random | Low | Re-paste per csm launch; document in setup UX (§9.2). |

---

## 8. Definition of done (v1)
- Point csm-office at a running csm agent (proxy env or setup dialog) → a pixel
  office renders live; agents appear in the right rooms and **walk** as their
  activity changes; speech bubbles show recent messages; connection state is
  visible; it stays readable with 30+ agents and degrades gracefully beyond.
- Pure store/diff/look logic covered by Vitest; build + lint green in CI.
- README + ASSETS.md complete; v0.1.0 tagged.

---

## 9. Open questions (resolve before/early in Phase 1)
1. **Proxy vs Direct** — **RESOLVED by §1.3 verification: Proxy mode is the only
   viable v1 default.** csm sends no CORS headers, so a browser can't read its
   stream cross-origin; Direct mode is blocked until/unless an upstream CORS
   opt-in PR lands in csm. Build Proxy only for v1.
2. **csm agent URL/token delivery**: env vars (`CSM_AGENT_URL`, `CSM_TOKEN`) for
   dev; for a hosted build, a runtime setup dialog — acceptable? (Note: csm's
   token is **per-run random**, regenerated each launch — the setup dialog/env
   must be re-pasted per csm session. Confirm UX.)
3. **Asset style/source** — leaning **CC0 Kenney** (zero obligations, §2). Custom
   sprites only if the Kenney look is insufficient vs the art target. Pick before
   Phase 2 (drives the whole look).
4. **Write actions later?** — out for v1, but the exact endpoints exist
   (§1.2: `POST /api/open|favorite|delete|delete-bulk|restore|restore-bulk`,
   bulk ≤ 500). Shape the API layer so these slot in without restructuring.
5. **[NEW] Phaser 3 vs 4** — target v4 (§2). Resolve early: confirm the official
   `template-vite-ts` tracks v4, else scaffold manually with v4 deps.
