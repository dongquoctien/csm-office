# Assets & licenses

Records the source + license of every visual asset shipped in this repo, and the
licensing rules for adding new ones.

## Current state

- **Furniture/props:** Kenney **"Roguelike Indoors"** (CC0) — vendored as
  `public/assets/indoor.png` (16px tiles, 1px spacing). Desks, fridge, stove,
  counters, framed wall art, plants, lamps.
- **Avatars:** Kenney **"Roguelike Characters"** (CC0) — vendored as
  `public/assets/chars.png` (16px, 1px spacing, 54-col grid). A curated set of
  dressed character frames is picked deterministically per session id
  (`CHAR_FRAMES` in `src/game/assets.ts`). Falls back to a drawn figure if the
  sheet is missing.
- **Floors:** Kenney **"Roguelike/RPG pack"** (CC0) — vendored as
  `public/assets/rpg.png` (16px, 1px spacing, 57-col grid). Seamless indoor
  floor tiles (wood parquet / tile / stone) extracted per zone via
  `FLOOR_FRAME` in `src/game/assets.ts`. Falls back to procedural floors if
  the sheet is missing.
- **Outdoor street:** Kenney **"Roguelike: Modern City"** (CC0) — vendored as
  `public/assets/city.png` (16px, packed/no-spacing, 37-col grid). Road + car
  frames (`CITY` in `propsData.ts`) for the ambient outdoor street
  (`src/game/outdoor.ts`). Grass + trees are drawn procedurally.

CC0 = no attribution required; we credit Kenney voluntarily. Sources:
https://kenney.nl/assets/roguelike-indoors ,
https://kenney.nl/assets/roguelike-characters ,
https://kenney.nl/assets/roguelike-rpg-pack , and
https://kenney.nl/assets/roguelike-modern-city (all CC0 1.0 Universal).

## Rules for adding assets

Only **CC0** or clearly-permissive assets. Record source + license + obligations
here before committing.

- **Kenney.nl — CC0 (recommended default).** Public domain: no attribution, no
  share-alike, commercial OK, safe to vendor into this public repo.
- **LPC (Liberated Pixel Cup) — CC-BY-SA 3.0/4.0 + GPLv3.** Share-alike: derived
  artwork must stay CC-BY-SA and credit every contributor (per `CREDITS.TXT`).
  Verify each community piece individually. Use only if you accept share-alike.
- **LimeZu "Modern Interiors" — do NOT vendor into the public repo.** Paid
  version is CC-BY but forbids redistributing the assets themselves; committing
  them here would let anyone copy them. Treat as a paid local dependency.

## Clean-room ports from csm (MIT)

The deterministic-avatar logic (`hashId` + color palettes) and the slot /
routing / bubble-rotation behavior in `src/store/look.ts`, `src/game/slots.ts`,
`src/game/routing.ts`, and `src/game/bubble.ts` are re-implemented by hand from
csm's MVP (`packages/ui/public/app.js`). csm is MIT-licensed; this is behavior,
not vendored code.

## Manifest

`src/game/assets.ts` → `MANIFEST` maps logical names → files under
`public/assets/`. A `null` entry falls back to the generated placeholder.
Filling a path is all that's needed to use a real asset.

| Logical name | File | Source | License |
|---|---|---|---|
| `PROPS.*` (furniture) | `public/assets/indoor.png` | Kenney Roguelike Indoors | CC0 |
| `CHAR_FRAMES` (avatars) | `public/assets/chars.png` | Kenney Roguelike Characters | CC0 |
| `FLOOR_FRAME` (floors) | `public/assets/rpg.png` | Kenney Roguelike/RPG pack | CC0 |
