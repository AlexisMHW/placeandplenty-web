// Hosting Collective community landing page: verified destinations and the one live status it needs.
// Source of every value: the founder's November 24 Community Launch Kit addendum and existing site code. Nothing here is invented.
//
// THE HIDDEN PARTNER GROUP IS DELIBERATELY ABSENT. Hosting Partners has a private, hidden Facebook group for founder-approved partners.
// Its address must never appear in shipped public code, markup or analytics (tests/hc-landing.test.ts scans for it).

/** The Hosting Collective: free, private, publicly discoverable Facebook group. Membership approval required; no app purchase needed. */
export const COMMUNITY_GROUP_URL = "https://www.facebook.com/groups/1613918510052135/";

/** Canonical Hosting Partner application route. Already exists; not a placeholder. */
export const HC_APPLY_PATH = "/hosting-collective/apply";

/** The one genuine Coordinated Host article featured on the landing page (published, with an approved image in /public/images). */
export const HC_FEATURED_ARTICLE_SLUG = "how-to-organise-a-potluck";
export const HC_FEATURED_ARTICLE_PATH = `/coordinated-host/${HC_FEATURED_ARTICLE_SLUG}`;

export const HC_CAMPAIGN = "hosting_collective_launch";

/**
 * Are Hosting Partner applications open? Read from the one public boolean function (hc_applications_open), which exposes nothing else.
 * Fails CLOSED: if the database, the function or the network is unavailable, the page shows the "not open right now" state, never a guess.
 */
export async function getApplicationsOpen(transport: typeof fetch = fetch): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const res = await transport(`${url}/rest/v1/rpc/hc_applications_open`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: "{}",
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 60 },
    } as RequestInit);
    if (!res.ok) return false;
    return (await res.json().catch(() => false)) === true;
  } catch {
    return false;
  }
}
