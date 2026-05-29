/**
 * One-shot fetch for GET /api/session?id=&slug= (PLAN.md §1.2). Returns the
 * session detail incl. tokenBuckets for the agent panel. Proxied same-origin so
 * the token is injected server-side. No Phaser imports.
 */
import { API_BASE } from '../config';
import type { SessionDetail } from './types';

export async function fetchSessionDetail(id: string, slug?: string): Promise<SessionDetail | null> {
  const params = new URLSearchParams({ id });
  if (slug) params.set('slug', slug);
  try {
    const res = await fetch(`${API_BASE}/session?${params.toString()}`);
    if (!res.ok) return null;
    return (await res.json()) as SessionDetail;
  } catch {
    return null;
  }
}
