import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  RESEND_ACCEPTED_MESSAGE,
  RESEND_COOLDOWN_MS,
  RESEND_FAILED_MESSAGE,
  RESEND_RATE_LIMITED_MESSAGE,
  formatCooldown,
  loginNotice,
  resendCooldownRemainingMs,
  resendErrorMessage,
} from "../lib/auth-messages.ts";

describe("loginNotice", () => {
  test("maps every code the callback can write", () => {
    for (const code of ["link_expired", "missing_code", "invalid_type"]) {
      const n = loginNotice(code);
      assert.ok(n, code);
      assert.ok(n.title.length > 0 && n.body.length > 0);
      assert.equal(n.offerResend, true);
    }
  });

  test("unknown or crafted values produce no notice (no reflected text)", () => {
    assert.equal(loginNotice("<script>alert(1)</script>"), null);
    assert.equal(loginNotice("Your account was deleted"), null);
    assert.equal(loginNotice(""), null);
    assert.equal(loginNotice(undefined), null);
    assert.equal(loginNotice(null), null);
  });

  test("expired-link copy covers scanner, other-device and already-confirmed cases", () => {
    const body = loginNotice("link_expired")!.body.toLowerCase();
    assert.match(body, /automatically/);
    assert.match(body, /different device/);
    assert.match(body, /already confirmed/);
  });

  test("copy never asserts whether an address has an account", () => {
    for (const code of ["link_expired", "missing_code", "invalid_type"]) {
      const text = `${loginNotice(code)!.title} ${loginNotice(code)!.body}`.toLowerCase();
      assert.doesNotMatch(text, /no account|not registered|doesn.t exist|already registered/);
    }
  });
});

describe("resend cooldown", () => {
  test("no previous send means no wait", () => {
    assert.equal(resendCooldownRemainingMs(null, 1_000), 0);
    assert.equal(resendCooldownRemainingMs(undefined, 1_000), 0);
    assert.equal(resendCooldownRemainingMs(Number.NaN, 1_000), 0);
  });

  test("counts down and reaches zero", () => {
    assert.equal(resendCooldownRemainingMs(10_000, 10_000), RESEND_COOLDOWN_MS);
    assert.equal(resendCooldownRemainingMs(10_000, 40_000), RESEND_COOLDOWN_MS - 30_000);
    assert.equal(resendCooldownRemainingMs(10_000, 10_000 + RESEND_COOLDOWN_MS), 0);
    assert.equal(resendCooldownRemainingMs(10_000, 10_000 + RESEND_COOLDOWN_MS + 5_000), 0);
  });

  test("a timestamp from the future cannot lock the button", () => {
    assert.equal(resendCooldownRemainingMs(10_000_000, 1_000), 0);
  });

  test("formats whole seconds, rounding up", () => {
    assert.equal(formatCooldown(1), "1s");
    assert.equal(formatCooldown(59_001), "60s");
  });
});

describe("resendErrorMessage", () => {
  test("throttling maps to the wait message", () => {
    assert.equal(resendErrorMessage({ status: 429, message: "x" }), RESEND_RATE_LIMITED_MESSAGE);
    assert.equal(
      resendErrorMessage({ message: "For security purposes, you can only request this after 45 seconds." }),
      RESEND_RATE_LIMITED_MESSAGE,
    );
    assert.equal(resendErrorMessage({ message: "email rate limit exceeded" }), RESEND_RATE_LIMITED_MESSAGE);
    assert.equal(resendErrorMessage({ code: "over_email_send_rate_limit" }), RESEND_RATE_LIMITED_MESSAGE);
  });

  test("everything else collapses to one generic line (no internals, no enumeration)", () => {
    assert.equal(resendErrorMessage({ message: "User not found" }), RESEND_FAILED_MESSAGE);
    assert.equal(resendErrorMessage({ message: "Email address is invalid" }), RESEND_FAILED_MESSAGE);
    assert.equal(resendErrorMessage(null), RESEND_FAILED_MESSAGE);
  });

  test("success message is one fixed string that does not name the address", () => {
    assert.doesNotMatch(RESEND_ACCEPTED_MESSAGE, /@/);
    assert.match(RESEND_ACCEPTED_MESSAGE, /If that address/);
  });
});
