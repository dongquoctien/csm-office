# csm-office

> A realtime pixel-art operating system that visualizes AI agents working
> collaboratively inside a virtual office.

**Status: placeholder / planning.** Code lives elsewhere for now — see below.

## What this is

`csm-office` is a planned game-like, realtime dashboard that turns AI coding
agent activity (Claude Code sessions, MCP tool calls, terminal/test/deploy work)
into a visual "office": pixel agents that walk between rooms, animations per
action, task flow, and live status — instead of scrolling text logs.

Think *"The Sims for AI agents"* / *"a visual OS for AI."*

## Relationship to claude-session-manager (csm)

This app does **not** read Claude's logs directly. It is a **frontend that
consumes the existing data layer** already built in
[`claude-session-manager`](https://github.com/dongquoctien/claude-session-manager):

- `csm` already scans `~/.claude/projects/*.jsonl`, derives per-session
  **activity states** (`idle / thinking / reading / writing / running /
  searching / browsing / spawning`), tokens, cost, git branch, modified files,
  and recent tools.
- `csm`'s agent already streams this over **Server-Sent Events** at
  `GET /api/stream` (token-gated, localhost only).

`csm-office` will subscribe to that same `/api/stream` and render each session
as a pixel agent in a room chosen by its activity.

### Reality check (important)

Claude Code does **not** emit live events. State is *inferred* from the tail of
each `.jsonl` (via file-watching + debounce), so animation is session-level with
sub-second-to-second latency — not keystroke-level. Room mapping
(Research / Coding / QA / Deploy) is a heuristic over the tool + bash command,
not a guaranteed signal.

## Why a separate repo

`claude-session-manager` is deliberately zero-dependency, no-bundler, plain ESM.
A pixel/game UI wants a heavier stack (Next.js + PixiJS/Phaser + WebSocket), so
it lives here instead of polluting csm.

An MVP "Office view" (no-dep SVG/CSS, inside csm) is being built first to
validate the *activity → position/animation* mapping on real data. If that
proves compelling, the full game frontend will be scaffolded here.

## Planned tech

- **Frontend:** Next.js, PixiJS or Phaser, React Flow, Tailwind
- **Data source:** csm agent `/api/stream` (SSE) — reuse, don't re-parse

## License

MIT
