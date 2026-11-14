import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planShareQueue } from "../lib/share-by-text.ts";
import { back, createWalk, currentItem, isDone, markOpened, skip, summarize } from "../lib/share-step-through.ts";
import { STEP_THROUGH_COPY } from "../lib/share-step-through-copy.ts";

const T = (n: number) => `3f2b8c1e-9a4d-4e6b-8f10-2c7d5a9b1e${String(n).padStart(2, "0")}`;
const cand = (n: number, phones: Array<string | null> = ["(555) 123-4567"]) => ({ partyId: `p${n}`, token: T(n), phones });

describe("share step-through walk (web)", () => {
  test("one household at a time, in order, never repeated", () => {
    let w = createWalk(planShareQueue([cand(1), cand(2), cand(2), cand(3)]).queue);
    assert.deepEqual(w.queue.map((q) => q.partyId), ["p1", "p2", "p3"]);
    w = markOpened(w); w = skip(w); w = markOpened(w);
    assert.equal(isDone(w), true); assert.equal(currentItem(w), null);
    assert.deepEqual(summarize(w), { total: 3, opened: 2, skipped: 1, pending: 0, withoutPhone: 0 });
  });
  test("back keeps the previous outcome until acted on; end is a no-op", () => {
    let w = createWalk(planShareQueue([cand(1), cand(2)]).queue);
    w = markOpened(w); w = back(w);
    assert.equal(currentItem(w)!.partyId, "p1"); assert.equal(w.outcomes.p1, "opened");
    w = skip(w); assert.equal(w.outcomes.p1, "skipped");
    let d = createWalk(planShareQueue([cand(1)]).queue); d = markOpened(d);
    assert.equal(markOpened(d), d);
  });
  test("no-phone households stay; no-link households are reported", () => {
    const plan = planShareQueue([cand(1, [null]), { partyId: "p2", token: "bad", phones: ["(555) 123-4567"] }, cand(3)]);
    assert.deepEqual(plan.queue.map((q) => q.partyId), ["p1", "p3"]);
    assert.deepEqual(plan.skipped, [{ partyId: "p2", reason: "no_link" }]);
    assert.equal(summarize(createWalk(plan.queue)).withoutPhone, 1);
  });
});

describe("step-through copy and component are honest and group-free", () => {
  test("never claims sent/delivered/read as fact; discloses what we cannot see (en + es)", () => {
    for (const locale of ["en", "es"] as const) {
      const c = STEP_THROUGH_COPY[locale];
      const text = [c.explainer, c.doneBody(2, 1), c.noLinkNote(1), c.noLinkNote(3), c.desktopHint].join(" ");
      assert.doesNotMatch(text, /\bhas been (sent|delivered)\b|ya se (envió|entregó)/i);
      assert.match(c.doneHonest, locale === "en" ? /cannot see whether/ : /no puede ver si/);
      assert.match(c.progress(2, 5), /2/); assert.match(c.progress(2, 5), /5/);
    }
    assert.match(STEP_THROUGH_COPY.en.noLinkNote(1), /household has/); assert.match(STEP_THROUGH_COPY.en.noLinkNote(2), /households have/);
  });
  test("component opens ONE composer per household with that household's own link; no group or new dependency", () => {
    const src = readFileSync(new URL("../components/host/ShareStepThrough.tsx", import.meta.url), "utf8");
    assert.match(src, /buildSmsUri\(\{ platform, phone: item\.phone, body \}\)/);
    assert.match(src, /markOpened/); assert.doesNotMatch(src, /expo-sms|sendSMS|navigator\.contacts/);
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    assert.equal(pkg.dependencies["expo-sms"], undefined);
  });
  test("people page passes ONE entry per party lead, not per person", () => {
    const page = readFileSync(new URL("../app/(host)/host/g/[id]/people/page.tsx", import.meta.url), "utf8");
    assert.match(page, /leadByParty\.get\(row\.invitation_party_id as string\) === row\.id/);
    assert.match(page, /<ShareStepThrough/);
  });
});
