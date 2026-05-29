import { describe, expect, it } from 'vitest';
import { RECENT_MS } from '../src/config';
import { ACTIVITIES, STATUSES } from '../src/api/types';

describe('scaffold smoke', () => {
  it('config is sane', () => {
    expect(RECENT_MS).toBe(30 * 60 * 1000);
  });

  it('verified enums match csm', () => {
    expect(ACTIVITIES).toHaveLength(9);
    expect(STATUSES).toHaveLength(5);
    expect(ACTIVITIES).toContain('writing');
    expect(STATUSES).toContain('tool');
  });
});
