import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  GUEST_COUNT_COPY,
  formatGuestCount,
  isGuestCountUnknown,
  resolveGuestCountState,
} from "../lib/guest-count-state.ts";
import { planGuestCountWrite } from "../lib/guest-counts.ts";
import {
  EMPTY_GATHERING_INPUT,
  validateGatheringInput,
} from "../lib/gathering-creation.ts";

describe("isGuestCountUnknown mirrors native", () => {
  test("flag true is unknown", () => assert.equal(isGuestCountUnknown({ guest_count_unknown: true, expected_guest_count: 0 }), true));
  test("explicit NULL expected count is unknown", () => assert.equal(isGuestCountUnknown({ expected_guest_count: null }), true));
  test("zero is a known zero, not unknown", () => assert.equal(isGuestCountUnknown({ guest_count_unknown: false, expected_guest_count: 0 }), false));
  test("a schema without the column (field undefined) is known", () => assert.equal(isGuestCountUnknown({ expected_guest_count: 12 }), false));
  test("null/undefined rows are known", () => {
    assert.equal(isGuestCountUnknown(null), false);
    assert.equal(isGuestCountUnknown(undefined), false);
  });
});

describe("unknown -> estimated -> confirmed", () => {
  test("unknown", () => assert.equal(resolveGuestCountState({ guest_count_unknown: true, expected_guest_count: null }), "unknown"));
  test("estimated once numbers exist", () => assert.equal(resolveGuestCountState({ guest_count_unknown: false, expected_guest_count: 14 }), "estimated"));
  test("confirmed only on explicit attendance confirmation", () => {
    assert.equal(resolveGuestCountState({ expected_guest_count: 14 }, { attendanceConfirmed: true }), "confirmed");
    assert.equal(resolveGuestCountState({ expected_guest_count: null }, { attendanceConfirmed: true }), "unknown");
  });
});

describe("display never prints zero for unknown", () => {
  test("en", () => assert.equal(formatGuestCount({ expected_guest_count: null }), "Guest count not set yet"));
  test("es", () => assert.equal(formatGuestCount({ guest_count_unknown: true, expected_guest_count: 0 }, "es"), "Cantidad de invitados aún sin definir"));
  test("known count prints the number", () => assert.equal(formatGuestCount({ expected_guest_count: 26 }), "26"));
  test("a real zero still prints 0", () => assert.equal(formatGuestCount({ guest_count_unknown: false, expected_guest_count: 0 }), "0"));
  test("en and es copy have the same keys, none empty", () => {
    assert.deepEqual(Object.keys(GUEST_COUNT_COPY.en).sort(), Object.keys(GUEST_COUNT_COPY.es).sort());
    for (const lang of ["en", "es"] as const) for (const v of Object.values(GUEST_COUNT_COPY[lang])) assert.ok(v.length > 10 || v.length > 0);
  });
});

describe("planGuestCountWrite", () => {
  const known = { adults: 20, children: 5, unknown: false };
  const unknownNow = { adults: 0, children: 0, unknown: true };

  test("choosing unknown writes the same four columns as native", () => {
    const plan = planGuestCountWrite({ unknown: true, adults: 9, children: 9 }, known, true);
    assert.deepEqual(plan, { ok: true, columns: { adult_count: 0, child_count: 0, expected_guest_count: null, guest_count_unknown: true } });
  });
  test("unknown is refused (never written as zero) on a schema without the column", () => {
    assert.deepEqual(planGuestCountWrite({ unknown: true, adults: null, children: null }, known, false), { ok: false, reason: "unsupported" });
  });
  test("unknown -> estimated: entering numbers clears the flag and derives the total", () => {
    const plan = planGuestCountWrite({ unknown: false, adults: 10, children: 2 }, unknownNow, true);
    assert.deepEqual(plan, { ok: true, columns: { adult_count: 10, child_count: 2, expected_guest_count: 12, guest_count_unknown: false } });
  });
  test("leaving unknown with only adults does not inherit the stored zeros as a headcount of 0 children incorrectly", () => {
    const plan = planGuestCountWrite({ unknown: null, adults: 8, children: null }, unknownNow, true);
    assert.deepEqual(plan, { ok: true, columns: { adult_count: 8, child_count: 0, expected_guest_count: 8, guest_count_unknown: false } });
  });
  test("leaving unknown with nobody entered is refused, not stored as 0", () => {
    assert.deepEqual(planGuestCountWrite({ unknown: false, adults: 0, children: 0 }, unknownNow, true), { ok: false, reason: "headcount_required" });
    assert.deepEqual(planGuestCountWrite({ unknown: false, adults: null, children: null }, unknownNow, true), { ok: false, reason: "headcount_required" });
  });
  test("saving other settings while unknown leaves the count columns alone", () => {
    assert.deepEqual(planGuestCountWrite({ unknown: null, adults: null, children: null }, unknownNow, true), { ok: true, columns: {} });
  });
  test("partial edit on a known count still keeps the other field (existing rule)", () => {
    const plan = planGuestCountWrite({ unknown: false, adults: null, children: 6 }, known, true);
    assert.deepEqual(plan, { ok: true, columns: { adult_count: 20, child_count: 6, expected_guest_count: 26, guest_count_unknown: false } });
  });
  test("old schema: known edit writes no unknown column", () => {
    const plan = planGuestCountWrite({ unknown: false, adults: 12, children: 3 }, known, false);
    assert.deepEqual(plan, { ok: true, columns: { adult_count: 12, child_count: 3, expected_guest_count: 15 } });
  });
  test("old schema: a stored known zero can still save unrelated settings", () => {
    const plan = planGuestCountWrite({ unknown: false, adults: 0, children: 0 }, { adults: 0, children: 0, unknown: false }, false);
    assert.equal(plan.ok, true);
  });
});

describe("wizard validation", () => {
  const complete = { ...EMPTY_GATHERING_INPUT, name: "Brunch", gatheringType: "brunch" as const, gatheringDate: "2030-01-05", arrivalTime: "11:00" };
  test("zero headcount without unknown is still refused", () => {
    assert.ok(validateGatheringInput({ ...complete }).some((e) => e.code === "headcount_required"));
  });
  test("unknown count satisfies the headcount rule", () => {
    assert.ok(!validateGatheringInput({ ...complete, guestCountUnknown: true }).some((e) => e.code === "headcount_required"));
  });
});

describe("wiring (static)", () => {
  const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
  test("host detail and list pages go through formatGuestCount", () => {
    assert.match(read("app/(host)/host/g/[id]/page.tsx"), /formatGuestCount\(gathering\)/);
    assert.match(read("app/(host)/host/(account)/page.tsx"), /formatGuestCount\(gathering\)/);
  });
  test("no host page prints raw expected_guest_count", () => {
    assert.doesNotMatch(read("app/(host)/host/g/[id]/page.tsx"), /\{gathering\.expected_guest_count\}/);
    assert.doesNotMatch(read("app/(host)/host/(account)/page.tsx"), /\{gathering\.expected_guest_count\}/);
  });
  test("unknown chip is offered only when the schema supports it", () => {
    const w = read("components/host/CreateGatheringWizard.tsx");
    assert.match(w, /allowUnknownGuestCount \|\| input\.guestCountUnknown === true/);
    assert.match(read("app/(host)/host/(account)/create/page.tsx"), /supportsGuestCountUnknown\(\)/);
  });
  test("Figure It Out sends unknown as unknown with null counts", () => {
    const f = read("lib/figure-it-out-actions.ts");
    assert.match(f, /countState/);
    assert.match(f, /\? null : gathering\.adult_count/);
  });
  test("feature detection treats only 42703 as definitely unsupported", () => {
    assert.match(read("lib/guest-count-support.ts"), /42703/);
  });
});
