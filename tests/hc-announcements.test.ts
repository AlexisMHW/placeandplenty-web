import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAnnouncementForm, parseAnnouncements } from "../lib/admin/hc.ts";
import { navFor } from "../lib/admin/nav.ts";

const D = "app/(command-center)/command-center/hosting-collective/announcements";
const form = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });

test("announcement form: trims, bounds title/body, validates tier key", () => {
  assert.deepEqual(parseAnnouncementForm(form({ title: " Hi ", body: " Hello ", tier: "" })), { ok: true, value: { title: "Hi", body: "Hello", tierSlug: null } });
  assert.deepEqual(parseAnnouncementForm(form({ title: "t", body: "b", tier: "starter" })), { ok: true, value: { title: "t", body: "b", tierSlug: "starter" } });
  assert.equal((parseAnnouncementForm(form({ title: "", body: "b" })) as any).error, "invalid_title");
  assert.equal((parseAnnouncementForm(form({ title: "x".repeat(121), body: "b" })) as any).error, "invalid_title");
  assert.equal((parseAnnouncementForm(form({ title: "t", body: "" })) as any).error, "invalid_body");
  assert.equal((parseAnnouncementForm(form({ title: "t", body: "x".repeat(2001) })) as any).error, "invalid_body");
  assert.equal((parseAnnouncementForm(form({ title: "t", body: "b", tier: "Bad Tier!" })) as any).error, "invalid_slug");
});

test("announcement list parser: retracted rows flagged, junk dropped, non-array is null", () => {
  assert.equal(parseAnnouncements(null), null);
  const rows = parseAnnouncements([{ id: "a", title: "T", body: "B", tier_slug: null, published_at: "2026-11-21T00:00:00Z", created_at: "c" }, { id: "b", title: "R", published_at: null }, { nope: 1 }])!;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].published, true);
  assert.equal(rows[1].published, false);
});

test("announcements actions: server permission re-check, no table writes, no database text forwarded, creator page revalidated", () => {
  const a = readFileSync(`${D}/actions.ts`, "utf8");
  assert.match(a, /requireStaff\("hc\.manage"/g);
  assert.doesNotMatch(a, /\.from\(/);
  assert.match(a, /hc_admin_publish_announcement/);
  assert.match(a, /hc_admin_retract_announcement/);
  assert.match(a, /revalidatePath\("\/creator"\)/);
  assert.doesNotMatch(a, /error\.message\s*[,}]/); // only a matched known code leaves the server
});

test("announcements page: gated on hc.read, publish/retract forms only for hc.manage, says nothing is sent", () => {
  const p = readFileSync(`${D}/page.tsx`, "utf8");
  assert.match(p, /requireStaff\("hc\.read"/);
  assert.match(p, /caps\.canManage/);
  assert.match(p, /Nothing is emailed or texted/);
});

test("nav: Member announcements link needs hc.read", () => {
  const ctx = (perms: string[]) => ({ permissions: perms } as any);
  assert.ok(navFor(ctx(["hc.read"])).some((l) => l.href.endsWith("/announcements")));
  assert.ok(!navFor(ctx(["ops.read"])).some((l) => l.href.endsWith("/announcements")));
});
