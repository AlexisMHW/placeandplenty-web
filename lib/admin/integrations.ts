// INTEGRATION ADAPTERS (Stripe, RevenueCat, GA4, MailerLite). READ-ONLY status probes, every one OFF unless its flag is exactly "true".
// Keys are read from the server environment by NAME only, are never returned, logged or put in an error. A probe never writes to the provider.
// Stripe/RevenueCat/MailerLite need a READ-ONLY credential that only the owner can create (listed in the report); GA4 needs a service account and
// is reported as "not_implemented" rather than pretending. fetch is injected so tests make no network call.
export type ProbeStatus = "off" | "not_configured" | "not_implemented" | "ok" | "failed";
export interface ProbeResult { id: string; label: string; status: ProbeStatus; note: string }
type Env = Record<string, string | undefined>;
type Fetch = (url: string, init: { method: "GET"; headers: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number }>;
interface Spec { id: string; label: string; flag: string; keyName: string; url?: string }

export const ADAPTERS: Spec[] = [
  { id: "stripe", label: "Stripe (read-only key)", flag: "CC_INTEGRATION_STRIPE", keyName: "CC_STRIPE_READONLY_KEY", url: "https://api.stripe.com/v1/balance" },
  { id: "revenuecat", label: "RevenueCat (read-only key)", flag: "CC_INTEGRATION_REVENUECAT", keyName: "CC_REVENUECAT_READONLY_KEY", url: "https://api.revenuecat.com/v2/projects" },
  { id: "mailerlite", label: "MailerLite (read-only key)", flag: "CC_INTEGRATION_MAILERLITE", keyName: "CC_MAILERLITE_READONLY_KEY", url: "https://connect.mailerlite.com/api/subscribers?limit=1" },
  { id: "ga4", label: "Google Analytics 4", flag: "CC_INTEGRATION_GA4", keyName: "CC_GA4_SERVICE_ACCOUNT" },
];

export async function probeIntegration(spec: Spec, env: Env, doFetch: Fetch): Promise<ProbeResult> {
  const base = { id: spec.id, label: spec.label };
  if (env[spec.flag] !== "true") return { ...base, status: "off", note: "Switched off (no calls are made)." };
  const key = env[spec.keyName];
  if (!key) return { ...base, status: "not_configured", note: `Needs ${spec.keyName} (owner creates a read-only credential).` };
  if (!spec.url) return { ...base, status: "not_implemented", note: "Adapter not implemented yet; needs a service account and a property id." };
  try {
    const res = await doFetch(spec.url, { method: "GET", headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) });
    return res.ok ? { ...base, status: "ok", note: "Reachable with the read-only credential." } : { ...base, status: "failed", note: `Provider answered ${res.status}.` };
  } catch {
    return { ...base, status: "failed", note: "Could not reach the provider." };
  }
}
export const probeAll = (env: Env, doFetch: Fetch) => Promise.all(ADAPTERS.map((a) => probeIntegration(a, env, doFetch)));
