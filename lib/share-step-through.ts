import type { ShareQueueItem } from "./share-by-text.ts";

/**
 * Step-through state for "Text every household, one at a time". Pure (no React, no network).
 *
 * One composer per HOUSEHOLD, in order. There is no group thread: each household has its own private link.
 * 'opened' means the operating system accepted the hand-off to the host's messaging app. It is NEVER "sent",
 * "delivered" or "read": this app cannot observe any of those, and no label in this feature may claim them.
 */
export type StepOutcome = 'pending' | 'opened' | 'skipped';

export interface WalkState {
  queue: ShareQueueItem[];
  index: number;
  outcomes: Record<string, StepOutcome>;
}

export function createWalk(queue: ShareQueueItem[]): WalkState {
  const seen = new Set<string>();
  const unique = queue.filter((q) => (seen.has(q.partyId) ? false : (seen.add(q.partyId), true)));
  return { queue: unique, index: 0, outcomes: Object.fromEntries(unique.map((q) => [q.partyId, 'pending' as StepOutcome])) };
}

export const isDone = (s: WalkState): boolean => s.index >= s.queue.length;
export const currentItem = (s: WalkState): ShareQueueItem | null => (isDone(s) ? null : s.queue[s.index]);

function advance(s: WalkState, outcome: StepOutcome): WalkState {
  const item = currentItem(s);
  if (!item) return s;
  return { ...s, index: s.index + 1, outcomes: { ...s.outcomes, [item.partyId]: outcome } };
}

/** Call after the OS accepted the hand-off for the current household. */
export const markOpened = (s: WalkState): WalkState => advance(s, 'opened');
/** Host chose to skip this household; it stays 'skipped' unless the host steps back and opens it. */
export const skip = (s: WalkState): WalkState => advance(s, 'skipped');
/** Step back one household (e.g. the messaging app was closed too early). Previous outcome is kept until acted on. */
export function back(s: WalkState): WalkState { return s.index === 0 ? s : { ...s, index: Math.min(s.index, s.queue.length) - 1 }; }

export interface WalkSummary { total: number; opened: number; skipped: number; pending: number; withoutPhone: number }
export function summarize(s: WalkState): WalkSummary {
  const vals = s.queue.map((q) => s.outcomes[q.partyId]);
  return {
    total: s.queue.length,
    opened: vals.filter((v) => v === 'opened').length,
    skipped: vals.filter((v) => v === 'skipped').length,
    pending: vals.filter((v) => v === 'pending').length,
    withoutPhone: s.queue.filter((q) => !q.phone).length,
  };
}
