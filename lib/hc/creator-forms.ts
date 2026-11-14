// Creator-side form parsing. Pure. Mirrors the database checks so the member gets a clear message before a round trip; the database enforces them again.
type FormLike = { get(name: string): unknown };
const t = (f: FormLike, k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string).trim() : "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PLATFORMS = ["instagram", "tiktok", "youtube", "pinterest", "blog", "facebook", "newsletter", "other"] as const;
type R<T> = { ok: true; value: T } | { ok: false; error: string };

export function parseAssignmentResponse(f: FormLike): R<{ id: string; accept: boolean }> {
  const id = t(f, "assignment_id"); if (!UUID.test(id)) return { ok: false, error: "invalid_id" };
  const d = t(f, "decision"); if (d !== "accept" && d !== "decline") return { ok: false, error: "invalid_form" };
  return { ok: true, value: { id, accept: d === "accept" } };
}

export function parseSubmissionForm(f: FormLike): R<{ assignmentId: string; url: string; platform: string; description: string | null; disclosureConfirmed: boolean }> {
  const id = t(f, "assignment_id"); if (!UUID.test(id)) return { ok: false, error: "invalid_id" };
  const url = t(f, "url");
  if (url.length < 12 || url.length > 508 || !/^https:\/\/\S+$/i.test(url)) return { ok: false, error: "invalid_url" };
  const platform = t(f, "platform"); if (!(PLATFORMS as readonly string[]).includes(platform)) return { ok: false, error: "invalid_form" };
  const description = t(f, "description"); if (description.length > 1000) return { ok: false, error: "invalid_form" };
  if (f.get("disclosure") !== "on" && f.get("disclosure") !== "true") return { ok: false, error: "disclosure_required" };
  return { ok: true, value: { assignmentId: id, url, platform, description: description || null, disclosureConfirmed: true } };
}

export function parseOnboardingStep(f: FormLike): R<string> {
  const s = t(f, "step"); return /^[a-z0-9_-]{1,64}$/.test(s) ? { ok: true, value: s } : { ok: false, error: "invalid_form" };
}
