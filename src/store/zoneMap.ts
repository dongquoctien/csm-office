/**
 * Activity → zone mapping (PLAN.md "Mapping 9→3 zones"). Pure: no Phaser/DOM.
 *
 * The 3 art-target zones group the 9 csm activities by *what the work is*. Each
 * zone keeps per-activity sub-spots, so the raw activity is still exact — we
 * group spatially, not semantically.
 *
 *   A — Coding (wood):          writing, running, searching
 *   C — Meeting/Reading (blue): reading, browsing, thinking, spawning
 *   B — Kitchen/Break (tile):   idle, waiting
 */
import type { Activity } from '../api/types';

export type ZoneId = 'coding' | 'meeting' | 'kitchen';

export const ZONE_LABEL: Record<ZoneId, string> = {
  coding: 'Coding',
  meeting: 'Meeting / Reading',
  kitchen: 'Kitchen / Break',
};

const ACTIVITY_ZONE: Record<Activity, ZoneId> = {
  writing: 'coding',
  running: 'coding',
  searching: 'coding',
  reading: 'meeting',
  browsing: 'meeting',
  thinking: 'meeting',
  spawning: 'meeting',
  idle: 'kitchen',
  waiting: 'kitchen',
};

/** Friendly per-activity sub-spot label shown under an avatar. */
export const ACTIVITY_LABEL: Record<Activity, string> = {
  writing: 'Writing',
  running: 'Running',
  searching: 'Searching',
  reading: 'Reading',
  browsing: 'Browsing',
  thinking: 'Thinking',
  spawning: 'Spawning',
  idle: 'Idle',
  waiting: 'Waiting',
};

export function zoneFor(activity: Activity): ZoneId {
  return ACTIVITY_ZONE[activity];
}

/** Activities that share a zone, in display order — used to lay out sub-spots. */
export const ZONE_ACTIVITIES: Record<ZoneId, Activity[]> = {
  coding: ['writing', 'running', 'searching'],
  meeting: ['reading', 'browsing', 'thinking', 'spawning'],
  kitchen: ['idle', 'waiting'],
};
