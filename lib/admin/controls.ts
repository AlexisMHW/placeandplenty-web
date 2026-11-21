// OPERATIONAL CONTROLS (Hosting Collective program + applications switches). Pure parsing, no I/O.
// Switch state comes only from hc_admin_get_program_switches(); a missing or malformed field is null ("not available"), never guessed as on or off.
export interface ProgramSwitches {
  programEnabled: boolean | null; applicationsOpen: boolean | null; paidReferralsEnabled: boolean | null; termsVersion: string | null;
}
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
export function parseSwitches(raw: unknown): ProgramSwitches | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    programEnabled: bool(r.program_enabled), applicationsOpen: bool(r.applications_open), paidReferralsEnabled: bool(r.paid_referrals_enabled),
    termsVersion: typeof r.terms_version === "string" ? r.terms_version : null,
  };
}
export type SwitchForm =
  | { ok: true; kind: "program"; on: boolean; reason: string }
  | { ok: true; kind: "applications"; on: boolean; reason: string; termsVersion: string | null }
  | { ok: false; error: string };
export function parseSwitchForm(form: { get(name: string): unknown }): SwitchForm {
  const get = (k: string) => (typeof form.get(k) === "string" ? (form.get(k) as string).trim() : "");
  const kind = get("kind");
  const state = get("state");
  if (state !== "on" && state !== "off") return { ok: false, error: "invalid_state" };
  const reason = get("reason");
  if (reason.length < 3 || reason.length > 200) return { ok: false, error: "invalid_reason" };
  if (kind === "program") return { ok: true, kind, on: state === "on", reason };
  if (kind === "applications") {
    const termsVersion = get("terms_version");
    if (termsVersion.length > 40 || /[<>]/.test(termsVersion)) return { ok: false, error: "invalid_terms_version" };
    return { ok: true, kind, on: state === "on", reason, termsVersion: termsVersion || null };
  }
  return { ok: false, error: "invalid_kind" };
}
export const SWITCH_GOOD = ["on", "off", "open", "closed", "already_on", "already_off", "already_open", "already_closed"];
