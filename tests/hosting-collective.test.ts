import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { HC_TERMS_VERSION, _resetLimiter, allowed, submitCreatorApplication, validateApplication } from "../lib/hosting-collective.ts";
import { dollars, parsePortal, referralUrl, referralsLive } from "../lib/creator-portal.ts";

const valid = () => ({
  fullName: "Test Creator", email: "Test.Creator@Example.test",
  platforms: [{ platform: "instagram", handle: "@testcreator" }, { platform: "blog", handle: "https://example.test/blog" }, { platform: "", handle: "" }],
  niches: ["budget_hosting", "dinner_brunch", "not_a_niche"], audienceSummary: "A small audience of home hosts.",
  priorWorkUrls: ["https://example.test/a", ""], collaborationInterest: ["referral_program", "bogus"],
  disclosureAck: true, consentToContact: true, website: "",
});
const CONFIG = { supabaseUrl: "https://example.test", anonKey: "anon-test-key" };
const fakeTransport = (response: unknown, ok = true, calls: any[] = []) =>
  (async (url: any, init: any) => { calls.push({ url, init }); return { ok, status: ok ? 200 : 500, json: async () => response } as any; }) as unknown as typeof fetch;

test("validation: accepts a good application, lowercases email, drops unknown niches/collaboration, keeps terms version", () => {
  const v = validateApplication(valid());
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.payload.email, "test.creator@example.test");
    assert.deepEqual(v.payload.niches, ["budget_hosting", "dinner_brunch"]);
    assert.deepEqual(v.payload.collaboration_interest, ["referral_program"]);
    assert.equal(v.payload.platforms.length, 2);
    assert.deepEqual(v.payload.platforms[1], { platform: "blog", url: "https://example.test/blog" });
    assert.equal(v.payload.terms_version, HC_TERMS_VERSION);
  }
});

test("validation: every required rule fails with a field message", () => {
  const bad = (patch: Record<string, unknown>) => { const r = validateApplication({ ...valid(), ...patch }); return r.ok ? {} : r.errors; };
  assert.ok(bad({ fullName: "A" }).fullName);
  assert.ok(bad({ email: "nope" }).email);
  assert.ok(bad({ email: "a@b.c" + "x".repeat(260) }).email);
  assert.ok(bad({ platforms: [] }).platforms);
  assert.ok(bad({ platforms: [{ platform: "myspace", handle: "x" }] }).platforms);
  assert.ok(bad({ niches: ["x"] }).niches);
  assert.ok(bad({ audienceSummary: "short" }).audienceSummary);
  assert.ok(bad({ priorWorkUrls: ["http://insecure.test/x"] }).priorWorkUrls);
  assert.ok(bad({ disclosureAck: false }).disclosureAck);
  assert.ok(bad({ consentToContact: "yes" }).consentToContact);
  assert.ok(validateApplication(null).ok === false);
});

test("intake: honeypot filled -> fake success, NO network call", async () => {
  _resetLimiter(); const calls: any[] = [];
  const res = await submitCreatorApplication({ ...valid(), website: "http://spam.test" }, "1.1.1.1", CONFIG, fakeTransport({}, true, calls));
  assert.equal(res.status, 200); assert.equal(calls.length, 0);
});

test("intake: invalid input -> 400 and no network call; unconfigured -> 503", async () => {
  _resetLimiter(); const calls: any[] = [];
  assert.equal((await submitCreatorApplication({ ...valid(), email: "x" }, "2.2.2.2", CONFIG, fakeTransport({}, true, calls))).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await submitCreatorApplication(valid(), "2.2.2.2", {}, fakeTransport({}))).status, 503);
});

test("intake: sends only the validated payload with the public anon key to the intake function", async () => {
  _resetLimiter(); const calls: any[] = [];
  const res = await submitCreatorApplication(valid(), "3.3.3.3", CONFIG, fakeTransport({ status: "received", duplicate: false }, true, calls));
  assert.equal(res.status, 200);
  assert.equal(calls[0].url, "https://example.test/rest/v1/rpc/submit_creator_application");
  const sent = JSON.parse(calls[0].init.body);
  assert.deepEqual(Object.keys(sent), ["p_payload"]);
  assert.equal(sent.p_payload.disclosure_ack, true);
  assert.ok(!("website" in sent.p_payload));
  assert.equal(calls[0].init.headers.apikey, "anon-test-key");
});

test("intake: a duplicate looks exactly like a new application to the applicant", async () => {
  _resetLimiter();
  const a = await (await submitCreatorApplication(valid(), "4.4.4.4", CONFIG, fakeTransport({ status: "received", duplicate: false }))).json();
  const b = await (await submitCreatorApplication(valid(), "4.4.4.5", CONFIG, fakeTransport({ status: "received", duplicate: true }))).json();
  assert.deepEqual(a, b);
});

test("intake: closed, busy, server failure and garbage responses never leak database text", async () => {
  _resetLimiter();
  const closed = await submitCreatorApplication(valid(), "5.5.5.1", CONFIG, fakeTransport({ status: "closed" }));
  assert.equal((await closed.json()).status, "closed");
  assert.equal((await submitCreatorApplication(valid(), "5.5.5.2", CONFIG, fakeTransport({ status: "busy" }))).status, 503);
  const fail = await submitCreatorApplication(valid(), "5.5.5.3", CONFIG, fakeTransport({ message: "relation creator_applications violates constraint" }, false));
  assert.equal(fail.status, 502); assert.doesNotMatch(JSON.stringify(await fail.json()), /relation|constraint|creator_applications/);
  assert.equal((await submitCreatorApplication(valid(), "5.5.5.4", CONFIG, fakeTransport({ weird: true }))).status, 502);
  const boom = (async () => { throw new Error("secret detail"); }) as unknown as typeof fetch;
  const r = await submitCreatorApplication(valid(), "5.5.5.5", CONFIG, boom);
  assert.equal(r.status, 502); assert.doesNotMatch(JSON.stringify(await r.json()), /secret/);
});

test("limiter: sixth request from one address in an hour is refused; window expires", () => {
  _resetLimiter(); const t0 = 1_000_000;
  for (let i = 0; i < 5; i++) assert.equal(allowed("ip", t0 + i), true);
  assert.equal(allowed("ip", t0 + 10), false);
  assert.equal(allowed("other", t0 + 10), true);
  assert.equal(allowed("ip", t0 + 3_700_000), true);
});

const portal = (over: Record<string, unknown> = {}) => ({
  member: true, status: "approved", display_name: "Test Creator", tier: { slug: "t", label: "Test tier" },
  onboarding: [{ slug: "read_brand_kit", title: "Read the kit", required: true, done: false }],
  referral: { partner: { status: "approved" }, codes: ["creator-one", "BAD CODE"], signups: 2, commission_cents: { pending: 188 }, conversions: { pending: 1 }, min_payout_cents: 5000 },
  assignments: [], submissions: [{ id: "s1", url: "https://example.test/p", platform: "blog", status: "submitted", permissions: [{ scope: "organic_repost" }] }], announcements: [], ...over,
});

test("portal parsing: non-member, inactive (suspended) and member states; only valid codes survive; no extra data for suspended", () => {
  assert.deepEqual(parsePortal({ member: false }), { kind: "not_member" });
  assert.deepEqual(parsePortal(null), { kind: "not_member" });
  assert.deepEqual(parsePortal({ member: true, status: "suspended" }), { kind: "inactive", status: "suspended" });
  const m = parsePortal(portal());
  assert.equal(m.kind, "member");
  if (m.kind === "member") {
    assert.deepEqual(m.data.codes, ["creator-one"]);
    assert.equal(m.data.commissionCents.pending, 188);
    assert.deepEqual(m.data.submissions[0].activePermissions, ["organic_repost"]);
  }
});

test("portal parsing: missing figures are null / n/a, never zero or estimated", () => {
  const m = parsePortal(portal({ referral: {} }));
  assert.equal(m.kind === "member" && m.data.signups, null);
  assert.equal(dollars(undefined), "n/a"); assert.equal(dollars(null), "n/a"); assert.equal(dollars(188), "$1.88");
});

test("referral link: only a well-formed code makes a link; referrals are not 'live' unless the flag is exactly 1", () => {
  assert.equal(referralUrl("creator-one"), "https://placeandplenty.com/r/creator-one");
  for (const bad of ["", "a", "UPPER", "has space", "a/../b", "x".repeat(33), "javascript:alert(1)"]) assert.equal(referralUrl(bad), null);
  assert.equal(referralsLive({}), false); assert.equal(referralsLive({ NEXT_PUBLIC_HC_REFERRALS_LIVE: "true" }), false); assert.equal(referralsLive({ NEXT_PUBLIC_HC_REFERRALS_LIVE: "1" }), true);
});

// ---- source guards ----
const read = (p: string) => readFileSync(p, "utf8");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

test("public pages make no income claims, no promised compensation and no commission rate", () => {
  const text = [...walk("app/(marketing)/hosting-collective"), "components/CreatorApplicationForm.tsx"].map(read).join("\n").toLowerCase();
  for (const banned of ["earn up to", "per month", "passive income", "guaranteed income", "guaranteed earnings", "you will earn", "make money", "% commission", "free product", "get paid to"])
    assert.ok(!text.includes(banned), banned);
  assert.ok(text.includes("not automatic and not guaranteed"));
  assert.ok(text.includes("noindex") || text.includes("index: false"));
});

test("portal is gated in middleware, never cached, and uses no service-role key anywhere in the new files", () => {
  const mw = read("middleware.ts");
  assert.match(mw, /\/creator/); assert.match(mw, /no-store/);
  for (const f of ["lib/hosting-collective.ts", "lib/creator-portal.ts", "app/api/hosting-collective/apply/route.ts", "app/(creator)/creator/page.tsx", "components/CreatorApplicationForm.tsx"])
    assert.doesNotMatch(read(f), /service_role|SERVICE_ROLE/i, f);
  assert.match(read("app/(creator)/creator/page.tsx"), /creator_portal_summary/);
  assert.doesNotMatch(read("app/(creator)/creator/page.tsx"), /\.from\(["'`]/);
});

test("intake route enforces same origin, JSON and a body cap before parsing", () => {
  const r = read("app/api/hosting-collective/apply/route.ts");
  assert.match(r, /origin !== new URL\(request\.url\)\.origin/); assert.match(r, /application\/json/); assert.match(r, /text\.length > 12000/);
});
