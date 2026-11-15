// FOUNDER DECISION B: completed gatherings stay read-only for planning and management EXCEPT authorized photo actions inside the existing
// guest photo-sharing window after completion. Cancelled: no exception. Archived: no exception. After the window: no exception.
//
// The window is NOT defined here and no length is invented. It is the database's own definition: public.gathering_lifecycle_ends_at()
// (event end + the retention period, migration 20260921150000) and public.gathering_photos_are_editable() (not archived or cancelled AND
// now() < gathering_lifecycle_ends_at). The photo workspace RPC (gathering_photo_workspace) hands that end moment to clients as
// `expiresAt` and the verdict as `editable`. This helper only compares "now" with that server-provided end, with the same strict `<`
// as the database, so the boundary instant itself is already closed. The server verdict can only RESTRICT, never re-open.
import { isReadOnlyStatus } from "./gathering-readonly.ts";

export interface PhotoWindowFacts {
  /** Effective (time-derived) status, never the stored status. */
  effectiveStatus: string;
  /** End of the photo window as reported by gathering_photo_workspace (ISO timestamp). */
  expiresAt: string | null | undefined;
}

/** True when the window end is a valid timestamp that is still in the future (strict, like the database's `now() < ends_at`). */
export function isBeforeWindowEnd(expiresAt: string | null | undefined, now: Date = new Date()): boolean {
  if (typeof expiresAt !== "string" || expiresAt === "") return false;
  const end = Date.parse(expiresAt);
  return Number.isFinite(end) && now.getTime() < end;
}

/**
 * Whether photo controls (upload, hide, delete) may be offered. Live gatherings: yes (the server flag still decides).
 * Completed: only inside the window. Cancelled, archived and unknown statuses: never.
 */
export function photoControlsOpen(f: PhotoWindowFacts, now: Date = new Date()): boolean {
  if (!isReadOnlyStatus(f.effectiveStatus)) return typeof f.effectiveStatus === "string" && f.effectiveStatus !== "";
  if (f.effectiveStatus !== "completed") return false;
  return isBeforeWindowEnd(f.expiresAt, now);
}
