import { describe, expect, it } from 'vitest';
import { hashId, lookFor, SKIN, HAIR, SHIRT, HAT } from '../src/store/look';

describe('look', () => {
  it('hashId is deterministic and unsigned 32-bit', () => {
    const a = hashId('sess-abc');
    expect(hashId('sess-abc')).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(a)).toBe(true);
  });

  it('different ids generally hash differently', () => {
    expect(hashId('a')).not.toBe(hashId('b'));
  });

  it('lookFor is stable for the same id (survives reconnect)', () => {
    const l1 = lookFor('sess-writing-1');
    const l2 = lookFor('sess-writing-1');
    expect(l1).toEqual(l2);
  });

  it('picks colors from the declared palettes', () => {
    const l = lookFor('sess-reading-1');
    expect(SKIN).toContain(l.skin);
    expect(HAIR).toContain(l.hair);
    expect(SHIRT).toContain(l.shirt);
    expect(HAT).toContain(l.hat);
  });

  it('hat never appears with long/ponytail hair', () => {
    for (let i = 0; i < 500; i++) {
      const l = lookFor(`agent-${i}`);
      if (l.hairStyle === 'long' || l.hairStyle === 'ponytail') {
        expect(l.hasHat).toBe(false);
      }
    }
  });

  it('produces a spread of looks across many ids (not all identical)', () => {
    const skins = new Set<string>();
    const shirts = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const l = lookFor(`id-${i}`);
      skins.add(l.skin);
      shirts.add(l.shirt);
    }
    expect(skins.size).toBeGreaterThan(1);
    expect(shirts.size).toBeGreaterThan(1);
  });
});
