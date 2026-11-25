import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { COMMUNITY_GROUP_URL, HC_APPLY_PATH, HC_FEATURED_ARTICLE_PATH, getApplicationsOpen } from "../lib/hc/community.ts";
import { ANALYTICS_EVENT_NAMES, SAFE_EVENT_PROPERTY_KEYS, scrubEventProperties, sanitizeUrlForAnalytics } from "../lib/analytics-privacy.ts";
import { APP_STORE_URL, PLAY_STORE_URL } from "../lib/app-links.ts";

const root = join(import.meta.dirname, "..");
const page = readFileSync(join(root, "app/(marketing)/hosting-collective/page.tsx"), "utf8");

// ---------- the hidden partner group never ships ----------
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === ".next" || n.startsWith(".")) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?|mdx?|json|css)$/.test(n)) out.push(p);
  }
  return out;
}
test("the hidden Hosting Partners Facebook group id appears nowhere in shipped code, content or public files", () => {
  const files = ["app", "components", "lib", "content", "public"].flatMap((d) => { try { return walk(join(root, d)); } catch { return []; } });
  assert.ok(files.length > 50);
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    assert.equal(text.includes("1471379654953632"), false, `${f} exposes the hidden partner group`);
  }
});

// ---------- approved copy, verbatim ----------
test("metadata and hero use the approved Community Launch Kit wording", () => {
  assert.match(page, /The Hosting Collective & Community \| Place & Plenty/);
  assert.match(page, /Join a free community for practical hosting ideas, discover the Place & Plenty app and explore Hosting Partner opportunities\. Real homes\. More gathering\./);
  for (const s of [
    "PLACE &amp; PLENTY COMMUNITY",
    "Good company for the way you gather.",
    "Real homes. Helpful ideas. A place to ask, share and make hosting feel a little lighter.",
    "Free Facebook community. No app download required.",
    "Download the App",
    "Explore Hosting Partner Opportunities",
    "Join The Hosting Collective",
    "Bring the planning together",
    "Explore Hosting Partner opportunities",
    "A useful idea for your next gathering",
    "There is room for your kind of gathering.",
    "Start with an idea, ask a question or bring the planning together. Choose the path that helps you today.",
    "AR Squared Inc.",
  ]) assert.ok(page.includes(s), `missing approved text: ${s}`);
  assert.ok(page.includes("Join the Community"));
});

test("the page keeps the earlier approved safeguards (no earnings claims, no guaranteed approval)", () => {
  assert.match(page, /Approval is not automatic and not guaranteed/);
  assert.match(page, /We do not pay for content unless a separate written agreement says so/);
  const rendered = page.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(rendered, /\$\d|\bearn\b|per month|commission rate/i);
});

// ---------- verified destinations ----------
test("destinations are the verified ones", () => {
  assert.equal(COMMUNITY_GROUP_URL, "https://www.facebook.com/groups/1613918510052135/");
  assert.equal(APP_STORE_URL, "https://apps.apple.com/us/app/place-and-plenty/id6806853614");
  assert.equal(PLAY_STORE_URL, "https://play.google.com/store/apps/details?id=com.placeandplenty.app");
  assert.equal(HC_APPLY_PATH, "/hosting-collective/apply");
  assert.ok(readdirSync(join(root, "app/(marketing)/hosting-collective")).includes("apply"));
  assert.equal(HC_FEATURED_ARTICLE_PATH, "/coordinated-host/how-to-organise-a-potluck");
  const mdx = readFileSync(join(root, "content/coordinated-host/how-to-organise-a-potluck.mdx"), "utf8");
  assert.match(mdx, /status: "published"/);
  const img = /featuredImage: "(.+)"/.exec(mdx)![1];
  assert.ok(statSync(join(root, "public", img)).isFile(), "approved article image exists");
});

test("external links open safely and are tracked through the shared wrapper", () => {
  const tracked = readFileSync(join(root, "components/hc-landing/TrackedLink.tsx"), "utf8");
  assert.match(tracked, /rel="noopener noreferrer"/);
  assert.match(tracked, /import \{ track/);
  assert.equal((page.match(/external event="community_join_click"/g) ?? []).length, 3);
});

// ---------- applications-open: fails closed, shows nothing it cannot verify ----------
const res = (ok: boolean, body: unknown) => ({ ok, json: async () => body }) as unknown as Response;
test("apply CTA is gated on the live open state and fails closed", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://qa.example.test"; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  assert.equal(await getApplicationsOpen((async () => res(true, true)) as typeof fetch), true);
  assert.equal(await getApplicationsOpen((async () => res(true, false)) as typeof fetch), false);
  assert.equal(await getApplicationsOpen((async () => res(false, true)) as typeof fetch), false, "RPC error is closed");
  assert.equal(await getApplicationsOpen((async () => { throw new Error("net"); }) as typeof fetch), false, "network failure is closed");
  assert.equal(await getApplicationsOpen((async () => res(true, "true")) as typeof fetch), false, "only a real boolean true opens it");
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert.equal(await getApplicationsOpen((async () => res(true, true)) as typeof fetch), false, "unconfigured is closed");
  assert.match(page, /applicationsOpen \? \(/);
  assert.match(page, /applications are not open right now/);
});

// ---------- analytics: allowlisted, non-personal ----------
test("the four launch events exist and carry only allowlisted non-personal properties", () => {
  for (const e of ["community_join_click", "app_store_click", "partner_application_click", "partner_application_submit"]) assert.ok((ANALYTICS_EVENT_NAMES as readonly string[]).includes(e), e);
  assert.ok(SAFE_EVENT_PROPERTY_KEYS.has("store") && SAFE_EVENT_PROPERTY_KEYS.has("entry_point"));
  assert.deepEqual(scrubEventProperties({ store: "apple", entry_point: "landing", email: "a@b.co", name: "Ada", facebook_id: "123" }), { store: "apple", entry_point: "landing" });
  const form = readFileSync(join(root, "components/CreatorApplicationForm.tsx"), "utf8");
  assert.match(form, /track\("partner_application_submit", \{ entry_point: "application_form" \}\)/);
  assert.match(form, /setStatus\("done"\); track\(/, "submit event fires only on a verified received response");
});

test("hosting_collective_launch campaign value passes the existing marketing-parameter rules", () => {
  const out = sanitizeUrlForAnalytics("https://placeandplenty.com/hosting-collective?utm_source=facebook&utm_medium=community&utm_campaign=hosting_collective_launch&email=a@b.co");
  assert.match(out, /utm_campaign=hosting_collective_launch/);
  assert.doesNotMatch(out, /email|a@b/);
});

// ---------- accessibility basics encoded in the markup ----------
test("tap targets, focus and reduced motion", () => {
  assert.ok((page.match(/min-h-\[44px\]/g) ?? []).length >= 4);
  assert.match(page, /focus-visible:outline/);
  assert.doesNotMatch(page, /autoplay|animate-|transition/i);
  assert.match(page, /<h1 /);
  assert.doesNotMatch(page, /1471379654953632/);
});
