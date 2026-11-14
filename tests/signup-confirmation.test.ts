import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  authEmailErrorMessage,
  classifyAuthEmailError,
  isEmailNotConfirmed,
  resendSecondsRemaining,
  retryAfterSeconds,
  RESEND_COOLDOWN_SECONDS,
} from "../lib/resend-cooldown.ts";

describe("resend cooldown", () => {
  test("first send is allowed, then a full minute counts down", () => {
    assert.equal(resendSecondsRemaining(null, 1000), 0);
    assert.equal(resendSecondsRemaining(1000, 1000), RESEND_COOLDOWN_SECONDS);
    assert.equal(resendSecondsRemaining(1000, 1000 + 59_000), 1);
    assert.equal(resendSecondsRemaining(1000, 1000 + 60_000), 0);
  });
  test("a backwards clock or bad input never locks the button", () => {
    assert.equal(resendSecondsRemaining(5000, 1000), 0);
    assert.equal(resendSecondsRemaining(Number.NaN, 1000), 0);
  });
});

describe("auth email errors", () => {
  test("rate limits are recognised in every shape", () => {
    assert.equal(classifyAuthEmailError({ status: 429 }), "rate_limited");
    assert.equal(classifyAuthEmailError({ code: "over_email_send_rate_limit" }), "rate_limited");
    assert.equal(classifyAuthEmailError(new Error("email rate limit exceeded")), "rate_limited");
    assert.equal(classifyAuthEmailError(new Error("you can only request this after 41 seconds")), "rate_limited");
  });
  test("network and unknown stay distinct, and no raw provider text is shown", () => {
    assert.equal(classifyAuthEmailError(new Error("Failed to fetch")), "network");
    assert.equal(classifyAuthEmailError(new Error("boom: stack trace")), "unknown");
    for (const e of [new Error("boom: stack trace"), { status: 429 }, new Error("Failed to fetch")]) {
      assert.doesNotMatch(authEmailErrorMessage(e), /boom|stack|429|fetch/i);
    }
  });
  test("retry-after honours the provider and is clamped", () => {
    assert.equal(retryAfterSeconds(new Error("after 41 seconds")), 41);
    assert.equal(retryAfterSeconds(new Error("after 99999 seconds")), 600);
    assert.equal(retryAfterSeconds(new Error("nothing")), RESEND_COOLDOWN_SECONDS);
  });
  test("unconfirmed sign-in is detected, bad passwords are not", () => {
    assert.equal(isEmailNotConfirmed({ code: "email_not_confirmed", message: "x" }), true);
    assert.equal(isEmailNotConfirmed(new Error("Email not confirmed")), true);
    assert.equal(isEmailNotConfirmed(new Error("Invalid login credentials")), false);
  });
});

describe("signup confirmation journey wiring", () => {
  const signup = readFileSync(new URL("../app/(marketing)/signup/SignUpForm.tsx", import.meta.url), "utf8");
  const login = readFileSync(new URL("../app/(marketing)/login/LoginForm.tsx", import.meta.url), "utf8");
  const resend = readFileSync(new URL("../components/auth/ResendConfirmation.tsx", import.meta.url), "utf8");

  test("sign-up shows the resend control after the confirmation email, starting the clock", () => {
    assert.match(signup, /<ResendConfirmation[^>]*justSentAt=\{sentAt\}/);
    assert.match(signup, /setSentAt\(Date\.now\(\)\)/);
  });
  test("login offers a resend instead of a dead-end for an unconfirmed address", () => {
    assert.match(login, /isEmailNotConfirmed\(error\)/);
    assert.match(login, /<ResendConfirmation/);
  });
  test("resend uses the same allowlisted callback and respects the cooldown", () => {
    assert.match(resend, /callbackUrl\(window\.location\.origin, next\)/);
    assert.match(resend, /auth\.resend\(\{\s*type: "signup"/);
    assert.match(resend, /remaining > 0/);
  });
  test("the check-inbox copy never reveals whether an address already has an account", () => {
    assert.match(signup, /Already have an account\?/);
    assert.doesNotMatch(signup, /already registered|already exists/i);
  });
});
