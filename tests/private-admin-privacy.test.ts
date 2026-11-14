import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { decideAnalytics, isAnalyticsExcludedPath, sanitizePathForAnalytics } from "../lib/analytics-privacy.ts";

const none = { gpc: false, dnt: false, stored: null } as const;
const granted = { gpc: false, dnt: false, stored: "granted" } as const;
const read = (p: string) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

const PRIVATE_PATHS = [
  "/command-center", "/command-center/", "/command-center/overview", "/command-center/hosting-collective/applications",
  "/command-center/hosting-collective/payouts", "/command-center/ops/staff", "/command-center/finance", "/command-center/purchases?email=a@b.test",
  "/creator", "/creator/", "/creator/dashboard", "/creator/referrals", "/creator/campaigns/abc",
  "/admin", "/admin/index.html",
  // casing / encoding / duplicate-slash variants must not slip past the exclusion
  "/Command-Center/overview", "/COMMAND-CENTER", "/%63ommand-center/overview", "/command%2Dcenter/finance", "//command-center/overview", "/Creator/Dashboard",
];

describe("private administrative and creator areas never load analytics", () => {
  for (const mode of ["off", "consent", "legacy"] as const) {
    for (const p of PRIVATE_PATHS) {
      test(`${mode}: ${p}`, () => {
        assert.equal(isAnalyticsExcludedPath(p), true);
        const d = decideAnalytics({ mode, pathname: p, signals: mode === "consent" ? { ...none, stored: granted } as any : none as any });
        assert.equal(d.load, false);
      });
    }
  }
  test("no consent banner is ever shown on private areas", () => {
    // banner logic delegates to decideAnalytics; excluded path => no banner
    const src = read("lib/analytics-privacy.ts");
    assert.match(src, /shouldShowBanner[\s\S]*isAnalyticsExcludedPath|shouldShowBanner[\s\S]*decideAnalytics/);
  });
  test("sanitized paths never expose private segments' dynamic ids", () => {
    for (const p of ["/creator/campaigns/abc-123", "/command-center/hosting-collective/applications/9f1c"]) {
      assert.ok(!sanitizePathForAnalytics(p).includes("abc-123") && !sanitizePathForAnalytics(p).includes("9f1c"), p);
    }
  });
});

describe("private areas are protected at the edge, in metadata and in robots", () => {
  test("middleware: no-store and login redirect for /command-center and /creator", () => {
    const m = read("middleware.ts");
    assert.match(m, /command-center[\s\S]{0,200}Cache-Control[\s\S]{0,40}no-store|Cache-Control[\s\S]{0,60}no-store/);
    assert.match(m, /pathname\.startsWith\("\/command-center"\)[\s\S]{0,200}!user|startsWith\("\/command-center"\)[\s\S]{0,260}\/login/);
    assert.match(m, /\/creator/);
  });
  test("both layouts are noindex,nofollow", () => {
    assert.match(read("app/(command-center)/command-center/layout.tsx"), /index:\s*false/);
    assert.match(read("app/(creator)/creator/layout.tsx"), /index:\s*false/);
  });
  test("robots.txt disallows crawling of private areas and keeps public SEO (sitemap, allow /)", () => {
    const r = read("app/robots.ts");
    for (const p of ["/command-center/", "/creator/", "/invite/", "/gallery/"]) assert.ok(r.includes(`"${p}"`), p);
    assert.match(r, /allow:\s*"\/"/);
    assert.match(r, /sitemap\.xml/);
  });
  test("sitemap never lists private areas", () => {
    const s = read("app/sitemap.ts").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const p of ["command-center", "creator", "/admin", "/invite", "/gallery"]) assert.ok(!s.includes(p), p);
  });
  test("private route groups do not import or mount analytics/tracker code", () => {
    const walk = (dir: string): string[] => readdirSync(new URL("../" + dir, import.meta.url), { withFileTypes: true })
      .flatMap((e) => e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.(tsx?|jsx?)$/.test(e.name) ? [`${dir}/${e.name}`] : []);
    const offenders = [...walk("app/(command-center)"), ...walk("app/(creator)")]
      .filter((f) => /AnalyticsConsent|posthog|gtag|googletagmanager|track\(/i.test(read(f)));
    assert.deepEqual(offenders, []);
  });
  test("no identify/person-property calls anywhere in app or components", () => {
    const walk = (dir: string): string[] => readdirSync(new URL("../" + dir, import.meta.url), { withFileTypes: true })
      .flatMap((e) => e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.(tsx?|jsx?)$/.test(e.name) ? [`${dir}/${e.name}`] : []);
    const offenders = [...walk("app"), ...walk("components")].filter((f) => /posthog\.identify\(|\.setPersonProperties\(|gtag\(\s*["']set["']\s*,\s*["']user_id/.test(read(f)));
    assert.deepEqual(offenders, []);
  });
});
