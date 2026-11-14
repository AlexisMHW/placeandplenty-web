// Co-host permission levels (backend migrations 202000-202004, not yet applied anywhere).
// Pure module: no React, no Supabase, no "use server" — importable from server actions, components and node tests.
//
// Backward compatibility: every helper treats "unknown" (backend not migrated, or call failed) as the legacy behaviour
// so this client works before AND after the migration.

export type AssignableLevel = "planner" | "manager";
export type CoHostPermissionLevel = AssignableLevel | "legacy_full";
export type Capability =
  | "edit_planning" | "edit_core_details" | "manage_guests" | "manage_invitations"
  | "manage_rsvp" | "manage_budget" | "start_purchase";

export const DEFAULT_INVITE_LEVEL: AssignableLevel = "planner";
export const ASSIGNABLE_LEVELS: readonly AssignableLevel[] = ["planner", "manager"];

export const LEVEL_LABEL: Record<CoHostPermissionLevel, string> = {
  planner: "Planner",
  manager: "Manager",
  legacy_full: "Full access (existing co-host)",
};
export const LEVEL_DESCRIPTION: Record<CoHostPermissionLevel, string> = {
  planner: "Helps plan the menu, shopping, tasks, music and HostMode. Cannot change guests, invitations, RSVP settings, budget or purchases.",
  manager: "Planner plus guest list, invitations and guest page, RSVP settings, budget and core details. Cannot buy, change the gathering status, or manage other co-hosts.",
  legacy_full: "Keeps the access this co-host had before permission levels existed. You can move them to Planner or Manager.",
};

export function normalizeLevel(value: unknown): CoHostPermissionLevel | null {
  return value === "planner" || value === "manager" || value === "legacy_full" ? value : null;
}

export interface MyCapabilities {
  isOwner: boolean;
  level: CoHostPermissionLevel | "owner" | null;
  capabilities: ReadonlySet<Capability>;
  /** false when the backend predates permission levels: behave exactly as before. */
  known: boolean;
}

export const LEGACY_ALL_CAPABILITIES: MyCapabilities = {
  isOwner: false,
  level: null,
  capabilities: new Set<Capability>(["edit_planning", "edit_core_details", "manage_guests", "manage_invitations", "manage_rsvp", "manage_budget", "start_purchase"]),
  known: false,
};

export function parseMyCapabilities(data: unknown): MyCapabilities {
  if (!data || typeof data !== "object") return LEGACY_ALL_CAPABILITIES;
  const d = data as { isOwner?: unknown; permissionLevel?: unknown; capabilities?: unknown };
  if (!Array.isArray(d.capabilities)) return LEGACY_ALL_CAPABILITIES;
  const caps = new Set<Capability>(d.capabilities.filter((c): c is Capability => typeof c === "string"));
  const level = d.permissionLevel === "owner" ? "owner" : normalizeLevel(d.permissionLevel);
  return { isOwner: d.isOwner === true, level, capabilities: caps, known: true };
}

export function can(caps: MyCapabilities, capability: Capability): boolean {
  return caps.isOwner || caps.capabilities.has(capability);
}

/** The RPC does not exist yet (PostgREST PGRST202 / Postgres 42883): degrade silently to legacy behaviour. */
export function isMissingRpc(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const m = (error.message ?? "").toLowerCase();
  return error.code === "PGRST202" || error.code === "42883" || m.includes("could not find the function") || (m.includes("function") && m.includes("does not exist"));
}

/** 'not authorized' (older RPCs) and 'not_authorized' + P0001 (newer) are the same refusal; RLS gives 42501. */
export function isNotAuthorized(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42501") return true;
  const m = (error.message ?? "").toLowerCase();
  return m.includes("not authorized") || m.includes("not_authorized") || m.includes("row-level security") || m.includes("permission denied");
}

export const NOT_ALLOWED_MESSAGE =
  "Your co-host access doesn't include this. Ask the host to change your permissions if you need to do it.";

export const LEVEL_ERROR_MESSAGES: Record<string, string> = {
  invalid_permission_level: "That permission level can't be assigned.",
  permission_level_not_assignable: "That permission level can't be assigned.",
  member_removed: "That person no longer has access to this gathering.",
};
