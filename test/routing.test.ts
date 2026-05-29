import { describe, expect, it } from 'vitest';
import { routeTo } from '../src/game/routing';
import { ZONES } from '../src/game/zones';

describe('routeTo', () => {
  it('same zone → straight line to the target', () => {
    const target = { x: 100, y: 100 };
    expect(routeTo('coding', 'coding', { x: 0, y: 0 }, target)).toEqual([target]);
  });

  it('cross zone → routes via both doors and the corridor', () => {
    const from = { x: 40, y: 120 };
    const target = { x: 900, y: 450 };
    const path = routeTo('coding', 'meeting', from, target);
    // Starts at the coding door, ends at the target, with corridor waypoints.
    expect(path[0]).toEqual({ x: ZONES.coding.door.x, y: ZONES.coding.door.y });
    expect(path[path.length - 1]).toEqual(target);
    expect(path.length).toBeGreaterThanOrEqual(5);
  });

  it('never proposes a diagonal wall-cut as the first move out of a room', () => {
    const path = routeTo('kitchen', 'coding', { x: 900, y: 100 }, { x: 50, y: 600 });
    // First waypoint is the kitchen's own door (leaves through the opening).
    expect(path[0]).toEqual({ x: ZONES.kitchen.door.x, y: ZONES.kitchen.door.y });
  });
});
