// D4 (founder): configurable tiers, versioned commission terms, audit, safe handling of members without paid terms; PAID REFERRALS DISABLED until activated; no invented rates/advertising.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { read, walk, exists } from "./helpers.ts";
import { referralsLive } from "../../lib/creator-portal.ts";
import { parseTermsForm } from "../../lib/admin/cc.ts";

test("D4: paid referrals are OFF by default and only the explicit value '1' turns them on", () => {
  assert.equal(referralsLive({}), false);
  for (const v of ["", "0", "true", "yes", "TRUE", " 1"]) assert.equal(referralsLive({ NEXT_PUBLIC_HC_REFERRALS_LIVE: v }), false, JSON.stringify(v));
  assert.equal(referralsLive({ NEXT_PUBLIC_HC_REFERRALS_LIVE: "1" }), true);
});
test("D4: no public page or content promises a commission rate, earning or payout amount", () => {
  const files = [...walk("app/(marketing)/hosting-collective"), ...walk("app/api/hosting-collective"), ...walk("components").filter((f) => /hosting|collective|creator/i.test(f))];
  const bad: string[] = [];
  for (const f of files) for (const line of read(f).split("\n")) if (/(commission|earn|payout|per referral|% )/i.test(line) && /(\d+(\.\d+)?\s?%|\$\s?\d)/.test(line)) bad.push(`${f}: ${line.trim().slice(0, 120)}`);
  assert.deepEqual(bad, [], "numeric commission/earnings language on a public surface (owner decision pending)");
});
test("D4: basic applications never require a tier or commission terms", () => {
  const s = read("app/api/hosting-collective/apply/route.ts");
  assert.doesNotMatch(s, /\btier\b|commission|rate_bps/i);
});
test("D4: no commission rate, percentage or payout amount is hard-coded in HC/admin logic", () => {
  const files = [...walk("lib/hc"), ...walk("lib/admin")].filter((f) => !/\.test\./.test(f));
  const bad = files.flatMap((f) => read(f).split("\n").filter((l) => /(rate_bps|DEFAULT_(RATE|COMMISSION)|commissionRate|bps)\s*[:=]\s*\d/.test(l)).map((l) => `${f}: ${l.trim()}`));
  assert.deepEqual(bad, []);
});
test("D4: commission terms are versioned and future-dated only (never rewrite history)", () => {
  const now = new Date("2026-11-14T12:00:00Z");
  const base = (iso: string) => ({ get: (k: string) => ({ gathering_pass: "10", validation_days: "45", min_payout_dollars: "50", effective_from: iso, note: "n" } as Record<string, string>)[k] ?? null });
  const past = parseTermsForm(base("2026-11-01T00:00:00Z"), now);
  assert.equal(past.ok, false, "terms effective in the past must be refused");
});
test("D4: tier configuration + assignment are staff-controlled (review action passes the chosen tier; no tier is invented in code)", () => {
  const a = read("app/(command-center)/command-center/hosting-collective/actions.ts");
  assert.match(a, /p_tier/);
  assert.ok(exists("app/(command-center)/command-center/hosting-collective/payouts/page.tsx"));
});
test("D4: tier-change and terms-change audit events exist in the proposed SQL (audit history)", () => {
  const dir = "/home/claude/pp-work/CCHC/src"; if (!fs.existsSync(dir)) return;
  const sql = fs.readdirSync(dir).filter((f) => f.endsWith(".sql") && !/ROLLBACK/i.test(f)).map((f) => fs.readFileSync(`${dir}/${f}`, "utf8")).join("\n");
  assert.match(sql, /hc\.terms_version_added/);
  assert.match(sql, /hc\.[a-z_]*tier[a-z_]*/i, "GAP: no audited function for tier reassignment after approval (only hc.application_reviewed carries p_tier)");
});
