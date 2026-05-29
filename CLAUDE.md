# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

This repo is **pre-code**. It contains only `PLAN.md`, `README.md`, and `docs/art-target.jpg` — there is no `package.json`, build, lint, or test setup yet. `PLAN.md` is the **source of truth** for what to build; read it in full before starting any implementation work. When scaffolding begins (Phase 0 in the plan), update this file with the real build/test/run commands.

## What csm-office is

A standalone game-engine frontend that renders Claude Code agent sessions as walking pixel-art characters in a virtual office. It is a **read-only viewer** (v1: no open/delete/fork write actions) that **consumes** data from an existing upstream service — it does **not** parse `~/.claude` logs itself.

The upstream is **claude-session-manager (csm)**, a separate repo. csm scans `~/.claude/projects/*.jsonl`, derives per-session state, and streams it over SSE. This repo is split out because csm is deliberately zero-dependency / no-bundler, while this app needs a heavier stack (bundler + 2D engine).

A local csm checkout exists at `D:\Github\claude-session-manager` — it is the authority for the API contract and the MVP office logic to port. The plan's claims were verified against it on 2026-05-29 (see the `[VERIFIED]`/`[CORRECTED]` flags in `PLAN.md §1`). Key source files: API in `packages/agent/src/server.js`; data shapes + activity/status derivation in `packages/core/src/scanner.js` and `metrics.js`; the MVP office to port from in `packages/ui/public/app.js` (`OfficePro`/`OfficeClassic`). If reasoning about the contract, read these rather than trusting any transcription.

**Dependency boundary (`PLAN.md §3.0`):** this checkout is a *reference for humans/agents only* — the build never reads from it. csm-office must stay source-independent of csm: no npm/path/submodule dependency, no `import` from `../claude-session-manager`. Wire types are re-declared in `src/api/types.ts` (owned here, not imported), and reused MVP logic (`hashId`, palettes, slot/routing/bubble) is hand-ported into this repo's own files, not linked. The only real coupling is the runtime HTTP/SSE call to a *running* csm agent.

## The data contract (this drives everything)

The entire app is a renderer for csm's API. Get this right before writing rendering code:

- **`GET /api/stream?token=<TOKEN>`** — SSE. Emits `event: snapshot\ndata:<JSON>` on every change plus a ~5s safety poll; `event: error` on scan failure; `: ping` heartbeats (~15s, ignore). Token must go in the query string because `EventSource` cannot set headers.
- **`GET /api/monitor?token=`** — one-shot snapshot (fallback).
- **`GET /api/session?id=&slug=`** — single-session detail incl. `tokenBuckets`.
- Snapshot shape and the `MonitorSession` fields are specified in `PLAN.md §1.2` (verified). The renderable unit is `MonitorSession`; `id` is the stable sprite key, `activity` (exactly 9 states) drives room placement, `mtime` drives the recent-window filter. **Do not type `lastPrompt`/`size`/`file` on `MonitorSession`** — they exist on the base Session but are dropped from the stream. `favorite` IS in the stream.

**Hard realities** (`PLAN.md §1.1`, `§1.3`, `§3.3`) that must shape the design:
- Claude Code emits no live events — state is *inferred* from file-watching, so updates are session-level (sub-second to seconds), not keystroke-level. Animate as **interpolations between coarse snapshots**, never as a high-frequency event firehose. Two timeouts matter: activity→idle at 30s, but `waiting` persists up to 120s; `active` is `<60s`.
- csm binds `127.0.0.1` only, uses a **per-run random** token, enforces a Host allowlist, and sends **no CORS headers** — so a browser **cannot** read the stream cross-origin. **Proxy mode is therefore the only viable v1 path** (not merely preferred): this app's own server proxies `/api/*` and injects the token server-side. SSE proxying has sharp edges — see `PLAN.md §3.3` (no compression on `/api/*`, long timeouts, pass through `x-accel-buffering: no`).

## Decided architecture (keep layer boundaries strict)

Data flows: SSE → world-store (pure reducer + diff) → intents → Phaser game. See `PLAN.md §3`.

- `src/api/` — SSE client + wire types. Reconnect with backoff. **No Phaser imports.**
- `src/store/` — `worldStore` pure reducer `applySnapshot(prev, snapshot)` plus a `diff` that emits ordered intents (`spawn`, `despawn`, `moveRoom`, `activity`, `say`). **Pure and unit-tested** — this is the hard logic and the only thing that gets Vitest coverage.
- `src/game/` — Phaser scenes/sprites. Consumes **intents**, never raw SSE. The **only** layer allowed to import Phaser.
- `src/hud/` — DOM overlay (connection pill, legend, filters, setup dialog) layered over the canvas.

Why the store sits between SSE and Phaser: snapshots are coarse and bursty, so the store diffs them into intents the game layer can animate smoothly, makes the core logic testable, and decouples the engine choice from the data.

## Decided tech stack (`PLAN.md §2`, versions verified 2026-05-29)

Vite 8 + vanilla TS (no Next.js for v1), **Phaser 4** as the 2D engine (v4 shipped stable 2026-04 — not Phaser 3), plain CSS for the HUD overlay, **Hono** (`@hono/node-server`) for prod static + `/api/*` proxy (**not Express** — its compression middleware buffers and freezes SSE; bare `node:http` is the zero-dep fallback), npm, and **Vitest** for the pure store/diff/look logic only (canvas rendering is verified manually/by screenshot, not unit-tested).

## Core mapping logic (`PLAN.md §4`)

- **Recent-window filter:** only render agents where `active || (now - mtime < RECENT_MS)` (default 30 min). This prevents the idle room flooding with dead sessions — a bug already hit and fixed in csm's MVP.
- **Activity → room:** exact 1:1 map of csm's 9 activity states (`idle, waiting, thinking, reading, writing, running, searching, browsing, spawning`). Do not invent finer rooms in v1.
- **Deterministic look:** `hashId(id)` → stable skin/hair/shirt/etc. indices so the same session is the same character across reconnects. Port the MVP's exact FNV-1a hash, feature-bit positions, and palette arrays from `app.js` verbatim (`PLAN.md §4.4`); drive Phaser tints/frames from them.
- **Other MVP logic to port** (`PLAN.md §4.5`, all verified in csm `app.js`): the slot system (non-overlapping room positions), lounge-routing walk (out-door → lounge → in-door, never through walls; respect `prefers-reduced-motion`), 3s-rotated 1-per-room speech bubbles, and the lounge TV feed. Re-express the *logic* in Phaser — the MVP is SVG/DOM.

## Assets

Pixel tiles/sprites must be CC0 or clearly permissive (Kenney.nl is the safe default). **Never** reuse assets or code from the `docs/art-target.jpg` screenshot's project — it is inspiration for layout/feel only. Record every asset source and license in `ASSETS.md`.

## Delivery is phased

`PLAN.md §5` defines Phases 0–5, each an independently shippable increment with its own "Verify" step. Notably, **Phase 1 proves the data contract with a temporary text-dump HUD before any game art is built** — follow that ordering rather than starting with visuals.
