// Parsers for admin_list_staff() and admin_recent_audit(). Pure. Malformed rows are dropped, nothing is invented.
// The audit "detail" object is shown as short key=value text; it never contains emails (the database writes ids and roles only).
export interface StaffRow { userId: string; role: string; status: string; displayName: string | null; createdAt: string | null }
export interface AuditRow { id: number; action: string; targetType: string | null; targetId: string | null; actorUserId: string | null; createdAt: string | null; detail: string }

const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

export function parseStaff(raw: unknown): StaffRow[] {
  if (!Array.isArray(raw)) return [];
  const out: StaffRow[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const userId = str(o.user_id), role = str(o.role), status = str(o.status);
    if (!userId || !role || !status) continue;
    out.push({ userId, role, status, displayName: str(o.display_name), createdAt: str(o.created_at) });
  }
  return out;
}

export function parseAudit(raw: unknown): AuditRow[] {
  if (!Array.isArray(raw)) return [];
  const out: AuditRow[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === "number" && Number.isFinite(o.id) ? o.id : null;
    const action = str(o.action);
    if (id === null || !action) continue;
    const d = o.detail && typeof o.detail === "object" && !Array.isArray(o.detail) ? (o.detail as Record<string, unknown>) : {};
    const detail = Object.entries(d)
      .filter(([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null)
      .slice(0, 6)
      .map(([k, v]) => `${k}=${v === null ? "none" : String(v).slice(0, 40)}`)
      .join(", ");
    out.push({ id, action, targetType: str(o.target_type), targetId: str(o.target_id), actorUserId: str(o.actor_user_id), createdAt: str(o.created_at), detail });
  }
  return out;
}
