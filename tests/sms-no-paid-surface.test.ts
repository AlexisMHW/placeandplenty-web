import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Entitlement model v2: the web app has NO paid Place & Plenty SMS surface. Share-by-text (host's own phone) is the only
// text path, and no page may call the paid-SMS RPCs or promise SMS in upgrade copy until the owner approves launch.
const SKIP = new Set(["node_modules", ".next", ".git", "tests", "docs", "content"]);
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(n)) out.push(p);
  }
  return out;
}
const files = ["app", "components", "lib"].flatMap((d) => { try { return walk(join(process.cwd(), d)); } catch { return []; } });

test("no web code calls the paid SMS RPCs", () => {
  const bad = files.filter((f) => /get_sms_usage_summary|sms_queue_prepared|sms_allowance_snapshot/.test(readFileSync(f, "utf8")));
  assert.deepEqual(bad, []);
});
test("no pricing or upgrade page promises Place & Plenty-sent texts", () => {
  const bad = files.filter((f) => /(pricing|upgrade|plus|purchase|paywall)/i.test(f) && /(we|place & plenty)\s+(will\s+)?(send|text)[^.]{0,40}(guests?|invitations?)|includes?\s+(text|sms)/i.test(readFileSync(f, "utf8")));
  assert.deepEqual(bad, []);
});
