// Follow-up J: guest / invitation / share / checkout-return / creator-referral / checklist / dispatch links never point at production from QA / preview / dev.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { detectContext, linkRefusalReason, strictBaseUrl } from "../lib/base-url-guard.ts";
import { decideSiteUrl, guestInviteBaseUrl, referralSiteUrl, siteContext, siteUrl, siteUrlRefusal } from "../lib/site-url.ts";
import { referralUrl } from "../lib/creator-portal.ts";
import { buildInvitationUrl } from "../lib/share-by-text.ts";
import { deliverChecklist } from "../lib/checklist-delivery.ts";
import { runHcDispatch } from "../lib/hc/dispatch-runner.ts";
import { createFakeProvider } from "../lib/comms/provider.ts";

const QA = { NEXT_PUBLIC_SUPABASE_URL: "https://gpzlytukyvshrrxrmooo.supabase.co" };
const PREVIEW = { VERCEL_ENV: "preview" };
const UUID = "123e4567-e89b-12d3-a456-426614174000";
// Every way of spelling the production website that must be refused in a non-production context.
const PRODUCTION_DISGUISES = [
  'https://placeandplenty.com',
  'https://placeandplenty.com/',
  'https://placeandplenty.com/invite',
  'https://www.placeandplenty.com',
  'https://WWW.PlaceAndPlenty.COM',
  'https://placeandplenty.com.',
  'https://www.placeandplenty.com.',
  'https://www.www.placeandplenty.com',
  'https://placeandplenty.com:443/invite',
  'https://placeandplenty.com:8443',
  'http://placeandplenty.com',
  'https://user:pw@placeandplenty.com',
  'https://qa.example.com@placeandplenty.com',
  'https://placeandplenty.com.evil.example',
  'https://placeandplenty.com-qa.example',
  'https://evilplaceandplenty.com',
  'https://xn--placeandplenty-9ud.com',
  'https://placeandplenty.com​',
  'https://placeandplenty​.com',
  ' https://placeandplenty.com ',
  'https://placeandplenty.com?x=1',
  'https://placeandplenty.com#h',
  'https://plaсeandplenty.com', // cyrillic es
  'https://ｐlaceandplenty.com', // fullwidth p (NFKC folds it to the production host)
];

test("strictBaseUrl refuses every production disguise, with and without a path", () => {
  for (const v of PRODUCTION_DISGUISES) { assert.equal(strictBaseUrl(v, { allowPath: true }).ok, false, v); assert.equal(strictBaseUrl(v).ok, false, v); }
  for (const v of [undefined, null, "", "  ", "nope", "ftp://qa.example.com", "http://qa.example.com"]) assert.equal(strictBaseUrl(v as any).ok, false);
  assert.equal(strictBaseUrl("https://qa.example.com/invite", { allowPath: true }).ok, true);
});
test("linkRefusalReason: silent in production, refuses production and punycode links otherwise", () => {
  assert.equal(linkRefusalReason("https://placeandplenty.com/x", "production"), null);
  for (const v of PRODUCTION_DISGUISES.filter((d) => /^https?:\/\/\S+$/.test(d))) assert.notEqual(linkRefusalReason(v, "nonproduction"), null, v);
});
test("context detection: QA ref, preview, a flag or a local stack are non-production; no signal or the production ref is production", () => {
  assert.equal(siteContext({}), "production");
  assert.equal(siteContext({ NEXT_PUBLIC_SUPABASE_URL: "https://iyvdxvotthwrerirdzwd.supabase.co" }), "production");
  assert.equal(siteContext(QA), "nonproduction"); assert.equal(siteContext(PREVIEW), "nonproduction");
  assert.equal(siteContext({ PP_APP_ENV: "qa" }), "nonproduction"); assert.equal(siteContext({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }), "nonproduction");
  assert.equal(detectContext({ hostingEnv: "production" }), "production");
});

// ---- call sites: checkout, billing portal, paper-suite checkout / quote / print-file return URLs -------------------------------------------------------------------
test("site URL (checkout / billing portal / paper-suite routes): every disguise is refused in QA and preview, unset is refused, production keeps the default", () => {
  for (const env of [QA, PREVIEW]) {
    for (const v of PRODUCTION_DISGUISES) {
      assert.equal(siteUrlRefusal({ ...env, NEXT_PUBLIC_SITE_URL: v }) !== null, true, v);
      assert.throws(() => siteUrl({ ...env, NEXT_PUBLIC_SITE_URL: v }), /./, v);
    }
    assert.notEqual(siteUrlRefusal({ ...env }), null);
    assert.equal(siteUrl({ ...env, NEXT_PUBLIC_SITE_URL: "https://qa.example.com/" }), "https://qa.example.com");
  }
  assert.equal(siteUrl({}), "https://placeandplenty.com");
  assert.equal(siteUrl({ NEXT_PUBLIC_SITE_URL: "https://placeandplenty.com/" }), "https://placeandplenty.com");
  assert.equal(decideSiteUrl(undefined, "production").url, "https://placeandplenty.com");
  assert.equal(decideSiteUrl(undefined, "nonproduction").url, null);
});
test("the five API routes answer 503 site_url_not_configured before doing any work, and no route keeps a hard-coded production fallback", () => {
  for (const f of ["checkout", "billing-portal", "paper-suite/checkout", "paper-suite/gelato/quote", "paper-suite/print-file"]) {
    const src = readFileSync(`app/api/${f}/route.ts`, "utf8");
    assert.match(src, /siteUrlRefusal\(/, f); assert.match(src, /site_url_not_configured/, f); assert.match(src, /status: 503/, f);
    assert.doesNotMatch(src, /\|\|\s*"https:\/\/placeandplenty\.com"/, f);
  }
});

// ---- call site: guest invitation share-by-text (host people page) -------------------------------------------------------------------------------------------------
test("guest invite base: every disguise is refused in QA / preview, unset is null, production default unchanged", () => {
  for (const env of [QA, PREVIEW]) {
    for (const v of PRODUCTION_DISGUISES) assert.equal(guestInviteBaseUrl({ ...env, GUEST_PAGE_BASE_URL: v }), null, v);
    assert.equal(guestInviteBaseUrl({ ...env }), null);
    assert.equal(guestInviteBaseUrl({ ...env, GUEST_PAGE_BASE_URL: "https://qa.example.com/invite/" }), "https://qa.example.com/invite");
  }
  assert.equal(guestInviteBaseUrl({}), "https://placeandplenty.com/invite");
});
test("a null base never builds a link (no fallback to production)", () => {
  assert.equal(buildInvitationUrl(UUID, null), null);
  assert.equal(buildInvitationUrl(UUID, "https://qa.example.com/invite"), `https://qa.example.com/invite/${UUID}`);
  assert.equal(buildInvitationUrl(UUID), `https://placeandplenty.com/invite/${UUID}`);
});

// ---- call site: creator referral link ------------------------------------------------------------------------------------------------------------------------
test("creator referral link: production unchanged; non-production needs an explicit non-production site URL, else no link", () => {
  assert.equal(referralUrl("creator-one"), "https://placeandplenty.com/r/creator-one");
  assert.equal(referralUrl("creator-one", null), null);
  assert.equal(referralSiteUrl({}), "https://placeandplenty.com");
  for (const env of [QA, PREVIEW]) {
    assert.equal(referralSiteUrl({ ...env }), null);
    for (const v of PRODUCTION_DISGUISES) assert.equal(referralUrl("creator-one", referralSiteUrl({ ...env, NEXT_PUBLIC_SITE_URL: v })), null, v);
    assert.equal(referralUrl("creator-one", referralSiteUrl({ ...env, NEXT_PUBLIC_SITE_URL: "https://qa.example.com" })), "https://qa.example.com/r/creator-one");
  }
});

// ---- call site: checklist email links -----------------------------------------------------------------------------------------------------------------------
test("checklist email: with no safe site URL (null) no email is sent and no request mentions production; production default still sends", async () => {
  const seen: { url: string; body: string }[] = [];
  const transport = (async (url: any, init: any) => { seen.push({ url: String(url), body: String(init?.body ?? "") }); return Response.json({ success: true }); }) as typeof fetch;
  const base = { supabaseUrl: "https://example.supabase.co", anonKey: "anon", brevoKey: "k", sender: "s@example.test" };
  const body = { edition: "halloween", firstName: "Ann", email: "ann@example.test", consent: true, website: "" };
  const r = await deliverChecklist(body, "unknown", { ...base, siteUrl: null }, transport);
  assert.equal(r.status, 200);
  assert.equal(seen.some((s) => s.url.includes("api.brevo.com/v3/smtp/email")), false);
  assert.equal(seen.some((s) => /placeandplenty\.com/i.test(s.body)), false);
  seen.length = 0;
  await deliverChecklist(body, "unknown", { ...base, siteUrl: "https://qa.example.com" }, transport);
  const mail = seen.find((s) => s.url.includes("api.brevo.com/v3/smtp/email"));
  assert.ok(mail); assert.match(mail!.body, /https:\/\/qa\.example\.com\//); assert.doesNotMatch(mail!.body, /https:\/\/placeandplenty\.com\/(checklists|api)/);
  seen.length = 0;
  await deliverChecklist(body, "unknown", base, transport);
  assert.match(seen.find((s) => s.url.includes("api.brevo.com/v3/smtp/email"))!.body, /https:\/\/placeandplenty\.com\//);
});
test("checklist route passes the environment-aware site URL", () => {
  const src = readFileSync("app/api/checklists/route.ts", "utf8");
  assert.match(src, /decideSiteUrl\(/); assert.match(src, /siteUrl: siteEnv\.url/);
});

// ---- call site: HC notification dispatch (founder / applicant email links) ----------------------------------------------------------------------------------------
test("HC dispatch: a production SITE_URL in any disguise is refused in non-production, before any client is built; production unchanged", async () => {
  const provider = createFakeProvider(); let built = 0;
  const run = (env: Record<string, string>) => runHcDispatch({ env: { HC_NOTIFY_DISPATCH_ENABLED: "true", COMMS_SEND_ENABLED: "true", ...env }, provider, serviceClient: () => { built++; return null as any; } });
  for (const v of PRODUCTION_DISGUISES) {
    for (const ctx of [{ PP_APP_ENV: "qa" }, { VERCEL_ENV: "preview" }, QA]) {
      const s = await run({ ...ctx, SITE_URL: v });
      assert.equal(s.reason, "site_url_refused", v);
    }
  }
  assert.equal(built, 0); assert.equal(provider.calls, 0);
  const ok = await run({ PP_APP_ENV: "qa", SITE_URL: "https://qa.example.com" });
  assert.equal(ok.reason, "service_client_unavailable"); // got past the URL check
  const prod = await run({ SITE_URL: "https://placeandplenty.com" });
  assert.equal(prod.reason, "service_client_unavailable");
});

// ---- identity of the shared files ----------------------------------------------------------------------------------------------------------------------------
const sha12 = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 20);
test("guard and share-by-text are byte-identical to the native copies (recorded hashes; native tests compare its own two copies)", () => {
  assert.equal(sha12("lib/base-url-guard.ts"), "93653b541144ed1eaa8b");
  assert.equal(sha12("lib/share-by-text.ts"), "84bf733a888c3fa24b86");
});
