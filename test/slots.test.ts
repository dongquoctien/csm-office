import { describe, expect, it, vi } from 'vitest';
import { SlotManager } from '../src/game/slots';
import { stationsFor } from '../src/game/zones';

describe('SlotManager (station allocator)', () => {
  it('gives distinct stations to distinct agents in the same cluster', () => {
    const m = new SlotManager();
    const a = m.take('a', 'coding', 'writing');
    const b = m.take('b', 'coding', 'writing');
    expect(a.seat).not.toEqual(b.seat);
  });

  it('keeps the same station when an agent re-takes the same cluster', () => {
    const m = new SlotManager();
    const first = m.take('a', 'coding', 'writing');
    const again = m.take('a', 'coding', 'writing');
    expect(again).toEqual(first);
  });

  it('frees the old station when an agent moves cluster', () => {
    const m = new SlotManager();
    const s1 = m.take('a', 'coding', 'writing');
    m.take('a', 'read', 'reading');
    // A new agent can now reclaim the freed writing station.
    const reclaimed = m.take('b', 'coding', 'writing');
    expect(reclaimed).toEqual(s1);
  });

  it('returns a station whose furniture/seat/facing are defined', () => {
    const m = new SlotManager();
    const st = m.take('a', 'kitchen', 'idle');
    expect(st.furniture).toBeTruthy();
    expect(st.seat).toHaveProperty('x');
    expect(['up', 'down', 'left', 'right']).toContain(st.facing);
  });

  it('warns once and reuses stations on overflow instead of erroring', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = new SlotManager();
    const n = stationsFor('coding', 'writing').length;
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n + 3; i++) m.take(`agent-${i}`, 'coding', 'writing');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('fans out overflowing agents so seats never coincide exactly', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = new SlotManager();
    const n = stationsFor('coding', 'writing').length;
    const seats: string[] = [];
    for (let i = 0; i < n * 3; i++) {
      const st = m.take(`agent-${i}`, 'coding', 'writing');
      seats.push(`${st.seat.x},${st.seat.y}`);
    }
    // every placed agent ends up at a distinct seat coordinate (no exact stacking)
    expect(new Set(seats).size).toBe(seats.length);
    vi.restoreAllMocks();
  });
});
