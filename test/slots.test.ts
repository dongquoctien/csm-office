import { describe, expect, it, vi } from 'vitest';
import { SlotManager } from '../src/game/slots';

describe('SlotManager', () => {
  it('gives distinct slots to distinct agents in the same sub-spot', () => {
    const m = new SlotManager();
    const a = m.take('a', 'coding', 'writing');
    const b = m.take('b', 'coding', 'writing');
    expect(a).not.toEqual(b);
  });

  it('keeps the same slot when an agent re-takes the same sub-spot', () => {
    const m = new SlotManager();
    const first = m.take('a', 'coding', 'writing');
    const again = m.take('a', 'coding', 'writing');
    expect(again).toEqual(first);
  });

  it('frees the old slot when an agent moves sub-spot', () => {
    const m = new SlotManager();
    const slot1 = m.take('a', 'coding', 'writing');
    m.take('a', 'meeting', 'reading');
    // A new agent can now reclaim the freed writing slot.
    const reclaimed = m.take('b', 'coding', 'writing');
    expect(reclaimed).toEqual(slot1);
  });

  it('warns once and reuses slots on overflow instead of erroring', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = new SlotManager();
    // coding/writing has 8 slots; place 12 → 4 overflow, one warning.
    for (let i = 0; i < 12; i++) m.take(`agent-${i}`, 'coding', 'writing');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
