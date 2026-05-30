import { describe, expect, it, vi } from 'vitest';
import sample from './fixtures/snapshot.sample.json';
import { applySnapshot, isRecent } from '../src/store/worldStore';
import type { MonitorSession, Snapshot } from '../src/api/types';
import { MAX_VISIBLE_AGENTS, RECENT_MS } from '../src/config';

const snapshot = sample as unknown as Snapshot;
// Fixture "recent" mtimes hover at 999_000–1_000_000; the stale one is mtime:1.
// Pick a "now" so recent ones fall inside RECENT_MS (1.8M) and stale falls out:
//   2_000_000 - 1_000_000 = 1_000_000 < 1.8M  → recent kept
//   2_000_000 - 1         = 1_999_999 > 1.8M  → stale filtered
const NOW = 2_000_000;

describe('worldStore.applySnapshot', () => {
  it('keeps recent/active agents and drops the stale inactive one', () => {
    const world = applySnapshot(snapshot, NOW);
    expect(world.agents.has('sess-writing-1')).toBe(true);
    expect(world.agents.has('sess-idle-1')).toBe(true); // inactive but recent mtime
    expect(world.agents.has('sess-stale-1')).toBe(false); // mtime:1, inactive → filtered
    expect(world.agents.size).toBe(6);
  });

  it('maps each activity to the correct zone', () => {
    const world = applySnapshot(snapshot, NOW);
    expect(world.agents.get('sess-writing-1')?.zone).toBe('coding');
    expect(world.agents.get('sess-running-1')?.zone).toBe('coding');
    expect(world.agents.get('sess-reading-1')?.zone).toBe('read');
    expect(world.agents.get('sess-thinking-1')?.zone).toBe('meeting');
    expect(world.agents.get('sess-idle-1')?.zone).toBe('kitchen');
    expect(world.agents.get('sess-waiting-1')?.zone).toBe('kitchen');
  });

  it('extracts the recentMessages tail as say (null when none)', () => {
    const world = applySnapshot(snapshot, NOW);
    expect(world.agents.get('sess-writing-1')?.say).toBe('Editing src/auth.ts');
    expect(world.agents.get('sess-idle-1')?.say).toBeNull();
  });

  it('passes through systemStats', () => {
    const world = applySnapshot(snapshot, NOW);
    expect(world.stats?.topModel).toBe('claude-opus-4-8');
  });

  it('caps at MAX_VISIBLE_AGENTS, keeping the most recent, and logs', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const base = snapshot.sessions[0];
    const many: MonitorSession[] = Array.from({ length: MAX_VISIBLE_AGENTS + 10 }, (_, i) => ({
      ...base,
      id: `bulk-${i}`,
      active: true,
      mtime: 1000 + i, // higher i = more recent
    }));
    const world = applySnapshot({ sessions: many, systemStats: snapshot.systemStats }, NOW);
    expect(world.agents.size).toBe(MAX_VISIBLE_AGENTS);
    // The 10 oldest (bulk-0..9) should be dropped; the newest kept.
    expect(world.agents.has(`bulk-${MAX_VISIBLE_AGENTS + 9}`)).toBe(true);
    expect(world.agents.has('bulk-0')).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('isRecent: active always passes; inactive depends on the window', () => {
    const base: MonitorSession = snapshot.sessions[0];
    expect(isRecent({ ...base, active: true, mtime: 0 }, 10 ** 12)).toBe(true);
    expect(isRecent({ ...base, active: false, mtime: 10 ** 12 - 1 }, 10 ** 12)).toBe(true);
    expect(isRecent({ ...base, active: false, mtime: 10 ** 12 - RECENT_MS - 1 }, 10 ** 12)).toBe(
      false,
    );
  });
});
