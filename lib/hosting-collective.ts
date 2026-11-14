// HOSTING COLLECTIVE: public application intake. Pure functions, no I/O except the injected transport.
//
// Status: PROPOSED, behind the database kill switch (hc_intake_settings.applications_open = false by default).
// The page never promises compensation, never states income, and never says approval is likely.
// Server-side validation here mirrors, and is repeated by, submit_creator_application() in the database (migration 214001).

export const HC_TERMS_VERSION = "draft-1"; // must equal hc_intake_settings.terms_version, which the owner sets when terms are approved

export const NICHES = [
  ["budget_hosting", "Budget-friendly hosting"],
  ["tablescapes_decor", "Tablescapes and decor"],
  ["bachelorette", "Bachelorette weekends"],
  ["bridesmaids_wedding", "Bridesmaids and weddings"],
  ["group_getaways", "Group getaways"],
  ["dinner_brunch", "Dinner parties and brunch"],
  ["family_celebrations", "Family celebrations"],
  ["hosting_organization", "Hosting organization and planning"],
  ["seasonal_entertaining", "Seasonal entertaining"],
] as const;
export const PLATFORMS = ["instagram", "tiktok", "youtube", "pinterest", "blog", "facebook", "newsletter", "other"] as const;
export const COLLABORATIONS = [
  ["referral_program", "A personal referral link"],
  ["campaign_briefs", "Occasional content briefs"],
  ["product_feedback", "Product feedback"],
  ["guest_content", "Guest content for Place & Plenty"],
] as const;

const NICHE_SET = new Set<string>(NICHES.map((n) => n[0]));
const PLATFORM_SET = new Set<string>(PLATFORMS);
const COLLAB_SET = new Set<string>(COLLABORATIONS.map((c) => c[0]));

export interface ApplicationPayload {
  terms_version: string;
  full_name: string;
  email: string;
  platforms: { platform: string; handle?: string; url?: string }[];
  niches: string[];
  audience_summary: string;
  prior_work_urls: string[];
  collaboration_interest: string[];
  disclosure_ack: true;
  consent_to_contact: true;
}

export type ValidationResult =
  | { ok: true; payload: ApplicationPayload }
  | { ok: false; errors: Record<string, string> };

const asStr = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isHttps = (u: string) => u.length >= 12 && u.length <= 508 && /^https:\/\/[^\s]+$/i.test(u);

export function validateApplication(input: unknown): ValidationResult {
  const errors: Record<string, string> = {};
  if (!input || typeof input !== "object") return { ok: false, errors: { form: "Please check the form and try again." } };
  const d = input as Record<string, unknown>;

  const fullName = asStr(d.fullName);
  if (fullName.length < 2 || fullName.length > 120) errors.fullName = "Please add your name.";
  const email = asStr(d.email).toLowerCase();
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "Please add a valid email address.";

  const platforms: ApplicationPayload["platforms"] = [];
  const rawPlatforms = Array.isArray(d.platforms) ? d.platforms : [];
  for (const p of rawPlatforms.slice(0, 8)) {
    if (!p || typeof p !== "object") continue;
    const platform = asStr((p as any).platform).toLowerCase();
    const handleOrUrl = asStr((p as any).handle);
    if (!PLATFORM_SET.has(platform) || !handleOrUrl) continue;
    if (handleOrUrl.length > 200) { errors.platforms = "One of your handles is too long."; continue; }
    platforms.push(/^https?:\/\//i.test(handleOrUrl) ? { platform, url: handleOrUrl } : { platform, handle: handleOrUrl });
  }
  if (platforms.length === 0 && !errors.platforms) errors.platforms = "Please add at least one place where you share your hosting.";

  const niches = Array.isArray(d.niches) ? [...new Set(d.niches.filter((n): n is string => typeof n === "string" && NICHE_SET.has(n)))] : [];
  if (niches.length === 0) errors.niches = "Please choose at least one topic.";

  const audience = asStr(d.audienceSummary);
  if (audience.length < 10 || audience.length > 1000) errors.audienceSummary = "Please tell us a little about your audience (10 to 1000 characters).";

  const rawPrior = Array.isArray(d.priorWorkUrls) ? d.priorWorkUrls : [];
  const prior = rawPrior.map(asStr).filter(Boolean).slice(0, 5);
  if (prior.some((u) => !isHttps(u))) errors.priorWorkUrls = "Links must start with https://";

  const collab = Array.isArray(d.collaborationInterest)
    ? [...new Set(d.collaborationInterest.filter((c): c is string => typeof c === "string" && COLLAB_SET.has(c)))]
    : [];

  if (d.disclosureAck !== true) errors.disclosureAck = "Please confirm you understand the disclosure requirement.";
  if (d.consentToContact !== true) errors.consentToContact = "Please confirm we may contact you about your application.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      terms_version: HC_TERMS_VERSION, full_name: fullName, email, platforms, niches, audience_summary: audience,
      prior_work_urls: prior, collaboration_interest: collab, disclosure_ack: true, consent_to_contact: true,
    },
  };
}

// ---- server-side intake ----
type Config = { supabaseUrl?: string; anonKey?: string };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

// Small in-memory limiter. It is a speed bump per server instance, NOT the control: the database enforces a global hourly cap,
// one live application per email, a payload cap and the kill switch.
const hits = new Map<string, number[]>();
export function allowed(ip: string, now = Date.now(), limit = 5, windowMs = 3_600_000): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) { hits.set(ip, recent); return false; }
  recent.push(now); hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return true;
}
export const _resetLimiter = () => hits.clear();

/** Neutral copy: the same success message whether or not the email was already on file. Database error text is never shown. */
export async function submitCreatorApplication(body: unknown, ip: string, config: Config, transport: typeof fetch = fetch): Promise<Response> {
  if (!body || typeof body !== "object") return reply({ message: "Please check the form and try again." }, 400);
  // Honeypot: bots fill the hidden field. Pretend success, store nothing.
  if (asStr((body as any).website)) return reply({ status: "received", message: "Thank you. We review every application by hand." });
  const v = validateApplication(body);
  if (!v.ok) return reply({ message: "Please check the highlighted fields.", errors: v.errors }, 400);
  if (!allowed(ip)) return reply({ message: "You have sent several applications. Please try again later." }, 429);
  if (!config.supabaseUrl || !config.anonKey) return reply({ message: "Applications are temporarily unavailable. Please try again shortly." }, 503);
  try {
    const res = await transport(`${config.supabaseUrl}/rest/v1/rpc/submit_creator_application`, {
      method: "POST", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json", apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}` },
      body: JSON.stringify({ p_payload: v.payload }),
    });
    if (!res.ok) return reply({ message: "We couldn't save your application. Please try again." }, 502);
    const out = await res.json().catch(() => null);
    if (out?.status === "closed") return reply({ status: "closed", message: "Applications are not open yet." }, 200);
    if (out?.status === "busy") return reply({ message: "We are receiving a lot of applications right now. Please try again later." }, 503);
    if (out?.status === "received") return reply({ status: "received", message: "Thank you. We review every application by hand." });
    return reply({ message: "We couldn't confirm your application. Please try again." }, 502);
  } catch { return reply({ message: "We couldn't save your application. Please try again." }, 502); }
}
