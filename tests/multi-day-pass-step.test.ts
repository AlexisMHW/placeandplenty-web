import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MULTI_DAY_PASS_REQUIRED_CODE,
  PASS_STEP_COPY,
  classifyMultiDayPass,
  isMultiDayPassRequired,
  multiDayCheckoutReturnPath,
  multiDayPassPriceLine,
  multiDayPassStepPath,
  planMultiDayLockIn,
  parseMultiDayGateMode,
} from "../lib/multi-day-pass.ts";
import { MULTI_DAY_PRICING } from "../lib/pricing.ts";
import { WEB_CHECKOUT_LIVE, type Entitlement } from "../lib/entitlements.ts";

const G = "11111111-1111-1111-1111-111111111111";
const NOW = new Date("2026-11-13T12:00:00Z");

function row(over: Partial<Entitlement> = {}): Entitlement {
  return {
    id: "e1",
    entitlement_type: "multi_day_pass",
    canonical_product_id: "multi_day_pass",
    scope: "gathering",
    gathering_id: G,
    active: true,
    purchased_at: "2026-11-01T00:00:00Z",
    expires_at: null,
    consumed_at: null,
    refunded_at: null,
    revoked_at: null,
    provider: "web",
    source: null,
    provider_customer_id: null,
    ...over,
  };
}

describe("203001 error string", () => {
  test("literal matches the migration", () => {
    const sql = readFileSync(
      "/home/claude/pp-recovery-ws/docs/recovery/proposed/20261111203001_qa_OPTIONAL_require_multi_day_pass_at_lock_in.sql",
      "utf8"
    );
    assert.ok(sql.includes(`'${MULTI_DAY_PASS_REQUIRED_CODE}'`));
  });
  test("detects in message forms", () => {
    assert.equal(isMultiDayPassRequired("multi_day_pass_required"), true);
    assert.equal(isMultiDayPassRequired({ message: "ERROR: multi_day_pass_required" }), true);
    assert.equal(isMultiDayPassRequired({ message: "not_authorized" }), false);
    assert.equal(isMultiDayPassRequired(null), false);
  });
});

describe("classifyMultiDayPass", () => {
  test("none", () => assert.equal(classifyMultiDayPass([], G, NOW), "none"));
  test("valid", () => assert.equal(classifyMultiDayPass([row()], G, NOW), "valid"));
  test("refunded", () =>
    assert.equal(classifyMultiDayPass([row({ refunded_at: "2026-11-05T00:00:00Z", active: false })], G, NOW), "refunded"));
  test("revoked", () =>
    assert.equal(classifyMultiDayPass([row({ revoked_at: "2026-11-05T00:00:00Z" })], G, NOW), "revoked"));
  test("expired", () =>
    assert.equal(classifyMultiDayPass([row({ expires_at: "2026-11-10T00:00:00Z" })], G, NOW), "expired"));
  test("inactive", () => assert.equal(classifyMultiDayPass([row({ active: false })], G, NOW), "inactive"));
  test("extension and other gatherings never count", () => {
    assert.equal(classifyMultiDayPass([row({ canonical_product_id: "multi_day_extension" })], G, NOW), "none");
    assert.equal(classifyMultiDayPass([row({ gathering_id: "other" })], G, NOW), "none");
    assert.equal(classifyMultiDayPass([row({ scope: "account", gathering_id: null })], G, NOW), "none");
  });
  test("a live pass wins over an older refunded one", () =>
    assert.equal(
      classifyMultiDayPass([row({ id: "a", refunded_at: "2026-10-01T00:00:00Z" }), row({ id: "b" })], G, NOW),
      "valid"
    ));
  test("every status has copy that promises the draft is safe or asks nothing false", () => {
    for (const k of Object.keys(PASS_STEP_COPY) as (keyof typeof PASS_STEP_COPY)[]) {
      assert.ok(PASS_STEP_COPY[k].title.length > 0);
    }
    assert.match(PASS_STEP_COPY.none.body, /draft is saved/);
  });
});

describe("planMultiDayLockIn", () => {
  test("single-day always finalises", () =>
    assert.deepEqual(planMultiDayLockIn({ durationType: "single_day", access: { ok: false } }), { action: "finalise" }));
  test("multi-day without pass goes to the pass step", () =>
    assert.deepEqual(planMultiDayLockIn({ durationType: "multi_day", access: { ok: true, hasPass: false } }), { action: "pass_step" }));
  test("multi-day with pass finalises", () =>
    assert.deepEqual(planMultiDayLockIn({ durationType: "multi_day", access: { ok: true, hasPass: true } }), { action: "finalise" }));
  test("unreadable access stops, never guesses", () =>
    assert.equal(planMultiDayLockIn({ durationType: "multi_day", access: { ok: false } }).action, "stop"));
});

describe("price and routes", () => {
  test("price comes from canonical constants", () => {
    assert.equal(multiDayPassPriceLine("plus"), MULTI_DAY_PRICING.plus.priceLine);
    assert.equal(multiDayPassPriceLine("gathering_pass"), MULTI_DAY_PRICING.gathering_pass.priceLine);
    assert.equal(multiDayPassPriceLine("standard"), MULTI_DAY_PRICING.standard.priceLine);
  });
  test("unknown tier falls back to standard, never a discount", () => {
    assert.equal(multiDayPassPriceLine(null), MULTI_DAY_PRICING.standard.priceLine);
    assert.equal(multiDayPassPriceLine("bogus"), MULTI_DAY_PRICING.standard.priceLine);
  });
  test("paths", () => {
    assert.equal(multiDayPassStepPath(G), `/host/create/pass?gatheringId=${G}`);
    assert.equal(multiDayCheckoutReturnPath(G), `/host/create/pass?gatheringId=${G}&purchase=success`);
  });
  test("web checkout still not live (no payment change)", () => assert.equal(WEB_CHECKOUT_LIVE, false));
});

describe("wiring (source contracts)", () => {
  const wizard = readFileSync("components/host/CreateGatheringWizard.tsx", "utf8");
  test("wizard checks the pass before finalising", () => {
    const check = wizard.indexOf("planMultiDayLockIn(");
    const fin = wizard.indexOf("await finaliseGatheringCreation(");
    assert.ok(check > 0 && fin > check);
    assert.ok(wizard.includes("finalised.passRequired"));
  });
  test("host-actions maps the 203001 error and marks passRequired", () => {
    const src = readFileSync("lib/host-actions.ts", "utf8");
    assert.ok(src.includes('raw.includes("multi_day_pass_required")'));
    assert.ok(src.indexOf("multi_day_pass_required") < src.indexOf('error?.code === "42501"'));
  });
  test("checkout returns multi-day buyers to the pass step", () => {
    const src = readFileSync("app/api/checkout/route.ts", "utf8");
    assert.ok(src.includes("multiDayCheckoutReturnPath(gatheringId)"));
  });
  test("pass step page has no payment code of its own", () => {
    const src = readFileSync("app/(host)/host/(account)/create/pass/PassStepActions.tsx", "utf8");
    assert.ok(src.includes('action="/api/checkout"'));
    assert.ok(!/stripe/i.test(src));
  });
});

describe("interim gate (203003) awareness", () => {
  test("gate off: legacy finalise even without a pass", () =>
    assert.deepEqual(planMultiDayLockIn({ durationType: "multi_day", access: { ok: true, hasPass: false }, gate: "off" }), { action: "finalise" }));
  test("gate absent (RPC not deployed): legacy finalise", () =>
    assert.deepEqual(planMultiDayLockIn({ durationType: "multi_day", access: { ok: false }, gate: "absent" }), { action: "finalise" }));
  test("gate enforce, no pass: pass step", () =>
    assert.deepEqual(planMultiDayLockIn({ durationType: "multi_day", access: { ok: true, hasPass: false }, gate: "enforce" }), { action: "pass_step" }));
  test("gate enforce, pass: finalise", () =>
    assert.deepEqual(planMultiDayLockIn({ durationType: "multi_day", access: { ok: true, hasPass: true }, gate: "enforce" }), { action: "finalise" }));
  test("gate enforce, unreadable access: stop, never guess", () =>
    assert.equal(planMultiDayLockIn({ durationType: "multi_day", access: { ok: false }, gate: "enforce" }).action, "stop"));
  test("gate omitted: unchanged existing behaviour", () =>
    assert.deepEqual(planMultiDayLockIn({ durationType: "multi_day", access: { ok: true, hasPass: false } }), { action: "pass_step" }));
  test("single-day ignores the gate", () =>
    assert.deepEqual(planMultiDayLockIn({ durationType: "single_day", access: { ok: false }, gate: "enforce" }), { action: "finalise" }));
  test("parse: enforce/off/garbage", () => {
    assert.equal(parseMultiDayGateMode({ mode: "enforce" }), "enforce");
    assert.equal(parseMultiDayGateMode({ mode: "off" }), "off");
    assert.equal(parseMultiDayGateMode(null), "absent");
    assert.equal(parseMultiDayGateMode({ mode: "ENFORCE " }), "absent");
  });
});
