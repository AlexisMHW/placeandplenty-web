// A8: reproduces the independent-audit findings on whatever branch this runs on. A FAIL means the finding REPRODUCES.
import test from "node:test";
import assert from "node:assert/strict";
import { read, exists, walk, discardedActionResults } from "./helpers.ts";

test("F-PREVIEW: code-level guard stops a preview build from using the production Supabase project", () => {
  // Accepted forms: a build/start script or middleware that refuses VERCEL_ENV=preview unless the Supabase URL is the QA project.
  const candidates = walk("scripts", [".mjs", ".js", ".ts"]).concat(["middleware.ts", "next.config.js"].filter(exists));
  const guarded = candidates.some((f) => { const s = read(f); return /VERCEL_ENV/.test(s) && /NEXT_PUBLIC_SUPABASE_URL/.test(s) && /preview/.test(s); });
  assert.ok(guarded, "no file combines VERCEL_ENV + preview + NEXT_PUBLIC_SUPABASE_URL: a preview build silently inherits whatever Supabase URL the Vercel Preview target provides (production today)");
});

test("F-HC-EMAIL: approving or declining an application dispatches a creator notification", () => {
  const src = read("app/(command-center)/command-center/hosting-collective/actions.ts");
  const m = /export async function reviewApplication[\s\S]*?\n}\n/.exec(src);
  assert.ok(m, "reviewApplication not found");
  assert.match(m![0], /(applicationApprovedMessage|applicationDeclinedMessage|enqueue|dispatch|notify)/, "reviewApplication writes the decision but never sends or queues any creator message");
});

test("F-FEEDBACK: no server-action result is discarded in staff pages (the founder must see saved/failed)", () => {
  const files = walk("app/(command-center)", [".tsx"]);
  const offenders = files.flatMap((f) => discardedActionResults(read(f)).map((h) => `${f}: ${h}`));
  assert.equal(offenders.length, 0, `${offenders.length} form(s) await an action and throw away {ok,code}:\n${offenders.slice(0, 12).join("\n")}`);
});

test("F-CREATOR: creator portal covers more than a read-only skeleton (status of application, campaigns, notices)", () => {
  const s = read("app/(creator)/creator/page.tsx");
  const hasCampaign = /campaign/i.test(s);
  const hasNotice = /notification|notice|inbox/i.test(s);
  assert.ok(hasCampaign && hasNotice, `creator page: campaigns=${hasCampaign} notifications=${hasNotice}; it is labelled 'SKELETON (restricted)' in source: ${/SKELETON/.test(s)}`);
});

test("F-BUILD: `npm run build` needs Tina cloud env; an offline production-equivalent recipe is shipped and documented", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.match(pkg.scripts.build, /tinacms build/); // generated client is gitignored by design; build regenerates it
  assert.ok(exists("docs/qa/offline_build/run_build.sh") && exists("docs/qa/offline_build/font_mock.cjs"));
});
