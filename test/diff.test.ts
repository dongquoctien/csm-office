import { describe, expect, it } from 'vitest';
import { diffWorlds, type Intent } from '../src/store/diff';
import { applySnapshot, emptyWorld, type WorldState } from '../src/store/worldStore';
import type { MonitorSession, Snapshot } from '../src/api/types';
import sample from './fixtures/snapshot.sample.json';

const snapshot = sample as unknown as Snapshot;
const NOW = 1_000_001;

function kinds(intents: Intent[]): string[] {
  return intents.map((i) => i.kind);
}

function findById(intents: Intent[], id: string): Intent[] {
  return intents.filter((i) => 'id' in i && i.id === id);
}

/** Build a world from a single hand-made session. */
function worldOf(session: Partial<MonitorSession> & Pick<MonitorSession, 'id'>): WorldState {
  const base = snapshot.sessions[0];
  return applySnapshot(
    { sessions: [{ ...base, ...session }], systemStats: snapshot.systemStats },
    NOW,
  );
}

describe('diffWorlds', () => {
  it('emits spawn for every agent on first snapshot', () => {
    const next = applySnapshot(snapshot, NOW);
    const intents = diffWorlds(emptyWorld(), next);
    const spawns = intents.filter((i) => i.kind === 'spawn');
    expect(spawns).toHaveLength(next.agents.size);
  });

  it('a fresh agent with a message also gets a say', () => {
    const next = worldOf({
      id: 'x',
      activity: 'writing',
      active: true,
      mtime: NOW,
      recentMessages: [{ role: 'assistant', text: 'hi', ts: NOW }],
    });
    const intents = diffWorlds(emptyWorld(), next);
    expect(kinds(intents)).toEqual(['spawn', 'say']);
  });

  it('emits despawn when an agent disappears', () => {
    const prev = worldOf({ id: 'gone', activity: 'idle', active: true, mtime: NOW });
    const next = emptyWorld();
    const intents = diffWorlds(prev, next);
    expect(intents).toEqual([{ kind: 'despawn', id: 'gone' }]);
  });

  it('emits moveRoom when the zone changes', () => {
    const prev = worldOf({ id: 'a', activity: 'writing', active: true, mtime: NOW }); // coding
    const next = worldOf({ id: 'a', activity: 'reading', active: true, mtime: NOW }); // meeting
    const intents = findById(diffWorlds(prev, next), 'a');
    expect(intents[0]).toMatchObject({ kind: 'moveRoom', zone: 'meeting' });
  });

  it('emits activity (not moveRoom) when activity changes within the same zone', () => {
    const prev = worldOf({ id: 'a', activity: 'writing', active: true, mtime: NOW }); // coding
    const next = worldOf({ id: 'a', activity: 'running', active: true, mtime: NOW }); // coding
    const intents = findById(diffWorlds(prev, next), 'a').filter((i) => i.kind !== 'say');
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({ kind: 'activity', activity: 'running' });
  });

  it('emits activity when only active flips', () => {
    const prev = worldOf({ id: 'a', activity: 'writing', active: true, mtime: NOW });
    const next = worldOf({ id: 'a', activity: 'writing', active: false, mtime: NOW });
    const intents = findById(diffWorlds(prev, next), 'a').filter((i) => i.kind !== 'say');
    expect(intents[0]).toMatchObject({ kind: 'activity', active: false });
  });

  it('emits say only when the message tail changes', () => {
    const prev = worldOf({
      id: 'a',
      activity: 'writing',
      active: true,
      mtime: NOW,
      recentMessages: [{ role: 'assistant', text: 'one', ts: 1 }],
    });
    const same = worldOf({
      id: 'a',
      activity: 'writing',
      active: true,
      mtime: NOW,
      recentMessages: [{ role: 'assistant', text: 'one', ts: 1 }],
    });
    const changed = worldOf({
      id: 'a',
      activity: 'writing',
      active: true,
      mtime: NOW,
      recentMessages: [{ role: 'assistant', text: 'two', ts: 2 }],
    });

    expect(findById(diffWorlds(prev, same), 'a')).toHaveLength(0);
    expect(findById(diffWorlds(prev, changed), 'a')).toEqual([
      { kind: 'say', id: 'a', text: 'two' },
    ]);
  });

  it('orders despawns before spawns', () => {
    const prev = worldOf({ id: 'old', activity: 'idle', active: true, mtime: NOW });
    const next = worldOf({ id: 'new', activity: 'idle', active: true, mtime: NOW });
    const k = kinds(diffWorlds(prev, next));
    expect(k.indexOf('despawn')).toBeLessThan(k.indexOf('spawn'));
  });
});
