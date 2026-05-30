/**
 * Hand-drawn pixel furniture/decor, authored with the pixel-art skill
 * (.claude/skills/pixel-art) via the DSL in src/game/pixel. Replaces the Kenney
 * frames so the whole office shares ONE consistent self-drawn style: limited
 * palette, hue-shifted ramps, light from top-LEFT, material-correct shading,
 * grounded by a contact shadow (added by the scene).
 *
 * Each prop is a pixel grid baked once (PX=2) into a cached texture. Origin is
 * bottom-centre (0.5, 1) so items sit on the floor.
 */
import Phaser from 'phaser';
import { bakeSprite, hueShift, type PixelMap } from './pixel';

const PX = 2;

// Shared shading helper: given a base hex, build a {lit, base, dark} char map.
function ramp3(base: string): { l: string; m: string; d: string } {
  return { l: hueShift(base, 1), m: base, d: hueShift(base, -1) };
}

interface PropDef {
  grid: string[];
  map: PixelMap;
}

// ── Potted plant (leafy bush in a terracotta pot) ────────────────────────────
const POT = '#b5683c';
const plantDef = (): PropDef => {
  const f = ramp3('#3f8a38'); // foliage green
  const p = ramp3(POT);
  return {
    grid: [
      '....LL....',
      '..LfFFfL..',
      '.LfFFFFfL.',
      'LfFFFFFFfL',
      'LFFFFFFddL',
      '.fFFFddd f',
      '..ffdd dd.',
      '...PPPP...',
      '..PpppQP..',
      '..PpppQP..',
      '..PPPPPP..',
      '...dddd...',
    ],
    map: {
      '.': null,
      ' ': null,
      L: f.l, // leaf highlight (lit tips top-left)
      F: f.m,
      f: f.m,
      d: f.d, // leaf core shadow
      P: p.m, // pot body
      p: p.l, // pot lit (left)
      Q: p.d, // pot shade (right)
    },
  };
};

// ── Bookshelf (wall-mounted, colourful spines) ───────────────────────────────
const bookshelfDef = (): PropDef => {
  const w = ramp3('#7a5a36');
  return {
    grid: [
      'wwwwwwwwwwww',
      'wLLLLLLLLLLw',
      'wRgbYRgbYRw',
      'wRgbYRgbYRw',
      'wwwwwwwwwwww',
      'wYRgbYRgbYw',
      'wYRgbYRgbYw',
      'wwwwwwwwwwww',
      'wddddddddddw',
    ],
    map: {
      '.': null,
      w: w.m, // wood frame
      L: w.l, // top lit edge
      d: w.d, // bottom shade
      R: '#b13e53', // red spine
      g: '#38b764', // green spine
      b: '#3b5dc9', // blue spine
      Y: '#ffcd75', // gold spine
    },
  };
};

// ── Fridge (kitchen, tall white/steel with handle) ───────────────────────────
const fridgeDef = (): PropDef => {
  const s = ramp3('#cfd2d6');
  return {
    grid: [
      'LSSSSSSSd',
      'LSSSSSSHd',
      'LSSSSSSHd',
      'LSSSSSSSd',
      'LSSSSSSSd',
      'wwwwwwwww',
      'LSSSSSSHd',
      'LSSSSSSHd',
      'LSSSSSSSd',
      'LSSSSSSSd',
      'dddddddddd',
    ],
    map: {
      '.': null,
      S: s.m,
      L: s.l, // lit left edge
      d: s.d, // shaded right edge
      w: '#9aa0a6', // door seam
      H: '#6b7178', // handle
    },
  };
};

// ── Stove / cooktop (dark range with burners) ────────────────────────────────
const stoveDef = (): PropDef => {
  const m = ramp3('#3a3d44');
  return {
    grid: [
      'LMMMMMMMd',
      'LMbbMbbMd',
      'LMbBMbBMd', // burners (B = lit ring)
      'LMbbMbbMd',
      'LMMMMMMMd',
      'LkkkkkkKd', // control strip
      'LMMMMMMMd',
      'dddddddd',
    ],
    map: {
      '.': null,
      M: m.m,
      L: m.l,
      d: m.d,
      b: '#22242a', // burner well
      B: '#e06a5a', // hot ring (warm specular)
      k: '#566c86',
      K: '#94b0c2',
    },
  };
};

// ── Sofa (2-seat upholstered, top-down) ──────────────────────────────────────
const sofaDef = (): PropDef => {
  const f = ramp3('#c25d6b'); // fabric (matte, soft)
  return {
    grid: [
      // back cushion (top), two arm rests (sides), two seat cushions (front).
      '.BBBBBBBBBB.',
      'ABkkkkkkkkBA',
      'ABkkkkkkkkBA',
      'ASSSSSSSSSSA', // seat cushions
      'ASSSS  SSSSA',
      'ASsssSSsssSA',
      'AdddddddddDA', // front shade
      '.d........d.',
    ],
    map: {
      '.': null, // transparent corners
      ' ': f.d, // seam between the two seat cushions
      B: f.l, // back cushion top (lit)
      A: f.m, // arm rests
      k: f.m, // back cushion face
      S: f.m, // seat cushions
      s: f.l, // seat cushion highlight
      d: f.d, // front shade
      D: f.d,
    },
  };
};

// ── Conference / dining table (wood, top-down) ───────────────────────────────
const tableDef = (): PropDef => {
  const w = ramp3('#8a5a34');
  return {
    grid: [
      'LLLLLLLLLLLLLL',
      'LTTTTTTTTTTTTd',
      'LTTggTTTTggTTd', // faint wood grain
      'LTTTTTTTTTTTTd',
      'LTTTTggTTTTTTd',
      'LTTTTTTTTTTTTd',
      'dddddddddddddd',
      '.l........l..',
    ],
    map: {
      '.': null,
      T: w.m,
      L: w.l,
      d: w.d,
      g: hueShift(w.m, -0.4), // grain streak (subtle)
      l: '#5a3d22', // legs
    },
  };
};

// ── Office chair (top-down, seat + backrest) ─────────────────────────────────
const chairDef = (): PropDef => {
  const m = ramp3('#3a3d44');
  return {
    grid: [
      '.LLLLLL.',
      'LbBBBBbL', // backrest
      'LbBBBBbL',
      '.LssssL.', // seat
      '.LssssL.',
      '..dwwd..', // post
      '.d.dd.d.', // wheels
    ],
    map: {
      '.': null,
      L: m.l,
      b: m.m,
      B: hueShift('#3b5dc9', 0.2), // blue cushion
      s: '#46494f', // seat
      d: m.d,
      w: '#22242a',
    },
  };
};

// ── Filing cabinet (wall storage, drawers) ───────────────────────────────────
const cabinetDef = (): PropDef => {
  const m = ramp3('#7a7e86'); // grey steel cabinet
  return {
    grid: [
      'LSSSSSSd',
      'LSSSSSSd',
      'LShhhhSd', // drawer handle
      'LSSSSSSd',
      'wwwwwwww', // drawer seam
      'LSSSSSSd',
      'LShhhhSd',
      'LSSSSSSd',
      'dddddddd',
    ],
    map: {
      '.': null,
      S: m.m,
      L: m.l,
      d: m.d,
      w: '#4f535a', // seam
      h: '#3a3d44', // handle
    },
  };
};

// ── Side / coffee table (small round, nook) ──────────────────────────────────
const sideTableDef = (): PropDef => {
  const w = ramp3('#9a6a3a');
  return {
    grid: ['.LTTTTL.', 'LTTTTTTTd', 'LTTTTTTTd', '.dTTTTd.', '..l..l..', '..l..l..'],
    map: { '.': null, T: w.m, L: w.l, d: w.d, l: '#5a3d22' },
  };
};

// ── Lamp post / floor lamp (tall, lit head) ──────────────────────────────────
const lampDef = (): PropDef => {
  return {
    grid: [
      '.GGGG.',
      'GHHHHG', // lamp head (warm glow)
      'GHHHHG',
      '.GGGG.',
      '..PP..', // pole
      '..PP..',
      '..PP..',
      '..PP..',
      '.dDDd.', // base
    ],
    map: {
      '.': null,
      G: '#caa84a', // lamp shade rim
      H: '#ffe9a8', // warm light
      P: '#566c86', // pole
      D: '#3a3d44',
      d: '#2a2c33',
    },
  };
};

// ── Framed wall art (landscape in a frame) ───────────────────────────────────
const framedArtDef = (sky: string, ground: string) => (): PropDef => {
  const fr = ramp3('#8a5a34');
  return {
    grid: [
      'FFFFFFFF',
      'FssssssF', // sky
      'FsSssssF', // sun dab
      'FsggggsF', // hills
      'FgggGgsF',
      'FFFFFFFF',
    ],
    map: {
      '.': null,
      F: fr.m,
      s: sky,
      S: '#ffe9a8', // sun dab
      g: ground,
      G: hueShift(ground, 0.5),
    },
  };
};

// ── Plant bush (leafy shrub, no pot — outdoor/corner) ─────────────────────────
const bushDef = (): PropDef => {
  const f = ramp3('#3f8a38');
  return {
    grid: [
      '...LL...',
      '..LFFL..',
      '.LFFFFL.',
      'LFFFFddL',
      'LFFddddL',
      '.fFdddd.',
      '..ffdd..',
      '...dd...',
    ],
    map: { '.': null, L: f.l, F: f.m, f: f.m, d: f.d },
  };
};

// ── Rug (soft rectangle, defines a sub-zone) ──────────────────────────────────
const rugDef = (base: string) => (): PropDef => {
  const r = ramp3(base);
  return {
    grid: [
      'EEEEEEEEEEEE',
      'EmmmmmmmmmmE',
      'EmIIIIIIIImE', // inner border
      'EmIRRRRRRImE',
      'EmIRRRRRRImE',
      'EmIIIIIIIImE',
      'EmmmmmmmmmmE',
      'EEEEEEEEEEEE',
    ],
    map: {
      '.': null,
      E: r.d, // outer edge
      m: r.m,
      I: r.l, // inner border (light)
      R: r.m, // field
    },
  };
};

// ── Overhead status icons (above an agent) ───────────────────────────────────
// Magnifier (searching a shelf): a glass lens + handle, top-left light.
const iconSearchDef = (): PropDef => {
  const m = ramp3('#cfd2d6'); // metal rim
  return {
    grid: [
      '.LLLL..',
      'LSSSSL.',
      'LSssSL.', // glass with a specular dab
      'LSSSSL.',
      '.LLLLh.',
      '....hh.',
      '.....hh',
    ],
    map: {
      '.': null,
      L: m.m, // rim
      S: '#73eff7', // glass (cyan)
      s: '#cdf6fb', // specular
      h: '#8a5a34', // wooden handle
    },
  };
};

// Open book (reading): two cream pages, dark spine, a couple text lines.
const iconBookDef = (): PropDef => {
  return {
    grid: [
      '.CCC.CCC.',
      'CcccKcccC',
      'CtccKcctC', // faint text lines
      'CcccKcccC',
      'CttcKcttC',
      'CcccKcccC',
      '.DDD.DDD.', // bottom shade
    ],
    map: {
      '.': null,
      C: '#f4f1e8', // page edge (light)
      c: '#e8e2d2', // page
      t: '#9a8c6a', // text line
      K: '#5a3d22', // spine
      D: '#cfc7b2', // page bottom shade
    },
  };
};

// ── NPC characters ───────────────────────────────────────────────────────────
// Matched to the existing Kenney `chars.png` avatars so the NPCs share ONE style
// (verified by inspecting the sheet): a BIG head fused to the shoulders (no neck),
// NO black outline (forms separated by colour), wide rounded shoulders with the
// two arms read as rounded side blocks (not 1px sticks), eyes = two small dark
// dots, hair/cap = a colour band over the head, body cut at the hips (no legs),
// flat shading with only a soft 1px shade down the right side, warm muted palette.
// Distinctiveness is purely costume/colour: peaked cap + navy uniform + badge
// (guard); side-parted hair + dark suit + red tie (boss).
//
// Grid 16 wide × 16 tall (origin bottom-centre). '.' = transparent (no outline).
const npcGuardDef = (): PropDef => {
  return {
    grid: [
      '................',
      '.....PPPPPP.....', // cap crown
      '....PPPPPPPP....',
      '...CPPPPPPPPD...', // cap (lit left C, shade right D)
      '...dddddddddd...', // cap brim band (dark)
      '...ssssssssSS...', // forehead (skin), right edge shade
      '...ssssssssSS...',
      '...ssesssesSS...', // eyes: two small dots (Kenney style), not long bars
      '...ssssssssSS...', // cheeks
      '....sssssss.....', // jaw
      '..UUUUUUUUUUUU..', // shoulders (wide, navy)
      '.UUUUUUUUUUUUUU.', // arms as rounded side blocks
      '.UUUUUbBgUUUUuu.', // badge (B) + button (g), right shade
      '.UUUUUUUUUUUUuu.',
      '.EEEEEEEEEEEEuu.', // duty belt
      '..UUUUUUUUUUuu..', // hips (cut here, no legs — Kenney style)
    ],
    map: {
      '.': null,
      P: '#2f4a82', // cap (navy)
      C: '#3a5896', // cap lit left
      D: '#22335c', // cap right shade
      d: '#1a2740', // cap brim (dark band)
      s: '#e8b088', // skin
      S: '#c1855a', // skin right shade
      e: '#3a2e2a', // eyes (soft dark, not pure black)
      E: '#1a2740', // belt / dark navy
      U: '#2f4a82', // navy uniform
      u: '#22335c', // uniform right shade
      b: '#274076', // badge backing
      B: '#ffcd75', // gold badge
      g: '#cdbb8e', // button
    },
  };
};

// Boss — modelled pixel-for-pixel on the Kenney avatar structure (frame 270 read
// from chars.png): round head rows 1–5 with a lit-left rim, two 1px brown eyes,
// shoulders flaring at row 6, hands showing at the sides, and tiny feet at the
// bottom. Costume = dark business suit + red tie. Skin uses the EXACT Kenney
// ramp so it sits beside the agents seamlessly.
const npcBossDef = (): PropDef => {
  return {
    grid: [
      '................',
      '.....hhhhhh.....', // hair top
      '....hHHHHHHh....', // hair (lit on top)
      '....hLFFFFRh....', // brow: lit-left rim L, face F, right rim R
      '...hLFFFFFFRh...', // face widens
      '...hLFeFFeFRh...', // two 1px eyes (e), nose hint omitted
      '...KKLFFFFRKK...', // jaw + suit shoulders start (K) at the sides
      '..KKKKkFFkKKKK..', // shoulders flare; chin (F) centre
      '..KKKKWWWWKKKK..', // white shirt collar (W)
      '.FKKKKWttWKKKKF.', // hands (F) at sides + red tie (t)
      '.FKKKKKttKKKKKF.',
      '.FKKKKKKKKKKKKF.',
      '..KKKKKKKKKKKK..',
      '..KKKKKKKKKKKK..',
      '...KK......KK...', // legs (trousers)
      '...DD......DD...', // shoes
    ],
    map: {
      '.': null,
      h: '#2b2733', // hair (dark)
      H: '#3a3548', // hair lit top
      L: '#e2d4a8', // face lit-left rim (Kenney)
      F: '#e5c49d', // face skin (Kenney mid)
      R: '#bfb183', // face right rim (Kenney)
      k: '#caa888', // chin/cheek shadow
      e: '#a17d52', // eyes (Kenney brown, NOT black)
      K: '#2f2d3a', // dark business suit
      W: '#e8e2d2', // shirt
      t: '#b13e53', // red tie
      D: '#1a1820', // shoes
    },
  };
};

// Chef — tall white toque, white kitchen jacket, neckerchief. Same Kenney style
// Chef — same Kenney avatar structure (round head, lit-left rim, 1px brown eyes,
// flaring shoulders, side hands, tiny feet) but the head-top is a white TOQUE and
// the body is a white kitchen jacket with a red neckerchief. Exact Kenney skin
// ramp so it matches the agents.
const npcChefDef = (): PropDef => {
  return {
    grid: [
      '....TTTTTT......', // toque puff (white hat)
      '...TTTTTTTT.....',
      '...ttttttttt....', // hat band (faint shade)
      '...hLFFFFRh.....', // brow: lit-left rim L, face F, right rim R
      '...hLFFFFFRh....',
      '...hLFeFFeFRh...', // two 1px brown eyes
      '...JJLFmmFRJJ...', // moustache (m) + jacket shoulders start (J)
      '..JJJJkFFkJJJJ..', // shoulders flare; chin centre
      '..JJJJNNNNJJJJ..', // red neckerchief collar (N)
      '.FJJJrJJJJrJJJF.', // hands (F) at sides + buttons (r)
      '.FJJJrJJJJrJJJF.',
      '.FJJJJJJJJJJJJF.',
      '..JJJJJJJJJJJJ..',
      '..JJJJJJJJJJJJ..',
      '...JJ......JJ...', // legs (white trousers)
      '...DD......DD...', // shoes
    ],
    map: {
      '.': null,
      T: '#f4f1e8', // toque white
      t: '#dcd6c8', // hat band shade
      h: '#dcd6c8', // hat side edge
      L: '#e2d4a8', // face lit-left rim (Kenney)
      F: '#e5c49d', // face skin (Kenney mid)
      R: '#bfb183', // face right rim (Kenney)
      k: '#caa888', // chin/cheek shadow
      e: '#a17d52', // eyes (Kenney brown)
      m: '#8a6a44', // moustache
      J: '#eceae0', // white kitchen jacket
      N: '#b13e53', // red neckerchief
      r: '#c7c2b4', // jacket buttons (soft)
      D: '#9a948a', // shoes (grey)
    },
  };
};

// Waiter — black waistcoat + white shirt + bow tie, carrying a round tray on the
// left hand. Distinct silhouette via the tray bump.
const npcWaiterDef = (): PropDef => {
  return {
    grid: [
      '....hhhhhhhh....', // hair
      '...HhhhhhhhhG...',
      '...hssssssshG...', // hairline
      '...ssssssssSS...', // forehead
      '...ssesssessS...', // eyes: two small dots, not long bars
      '...ssssssssSS...',
      '....ssssssss....', // jaw
      '...dVVVVVVVVd...', // shirt collar (V white) over waistcoat (d)
      'RRRdVVbbVVdddjj.', // tray (R) on the left + bow tie (b)
      'rrRdVVVVVVdddjj.', // tray rim r + body
      '..ddVVVVVVddjjj.', // waistcoat body
      '.dddVVVVVVdddjj.',
      '.ddddddddddddjj.',
      '.ddddddddddddjj.',
      '..ddddddddddjj..', // cut at hips
      '................',
    ],
    map: {
      '.': null,
      h: '#3a3346', // hair
      H: '#4a4258', // hair lit
      G: '#2c2638', // hair shade
      s: '#e8b088', // skin
      S: '#c1855a', // skin right shade
      e: '#3a2e2a', // eyes
      d: '#2b2933', // black waistcoat
      j: '#1f1d26', // waistcoat right shade
      V: '#e8e2d2', // white shirt
      b: '#b13e53', // bow tie (red)
      R: '#cfcabb', // round tray (top)
      r: '#a8a294', // tray rim/shade
    },
  };
};

// Registry: logical name → builder. Keyed to match Station/FloorProp prop names.
const DEFS: Record<string, () => PropDef> = {
  iconSearch: iconSearchDef,
  iconBook: iconBookDef,
  npcGuard: npcGuardDef,
  npcBoss: npcBossDef,
  npcChef: npcChefDef,
  npcWaiter: npcWaiterDef,
  cabinet: cabinetDef,
  sideTable: sideTableDef,
  lamp: lampDef,
  plantBush: bushDef,
  plantBush2: bushDef,
  armchair: chairDef,
  framedPic: framedArtDef('#6ba3da', '#3f8a38'),
  framedPic2: framedArtDef('#e0a458', '#8a5a34'),
  bookshelf2: bookshelfDef,
  bookshelf3: bookshelfDef,
  rugOrange: rugDef('#c25d6b'),
  rugOrangeRound: rugDef('#c25d6b'),
  rugGreen: rugDef('#3f8a38'),
  plant: plantDef,
  plant2: plantDef,
  bookshelf: bookshelfDef,
  fridge: fridgeDef,
  stove: stoveDef,
  sofa: sofaDef,
  tableLong: tableDef,
  chairUp: chairDef,
  chairDown: chairDef,
};

/** Whether a hand-drawn pixel version exists for this prop name. */
export function hasPixelProp(name: string): boolean {
  return name in DEFS;
}

/** Bake (once) and return the texture key for a hand-drawn pixel prop. */
export function ensurePixelProp(scene: Phaser.Scene, name: string): string | null {
  const def = DEFS[name];
  if (!def) return null;
  const key = `gen:prop:${name}`;
  if (scene.textures.exists(key)) return key;
  const d = def();
  return bakeSprite(scene, key, d.grid, d.map, { px: PX });
}
