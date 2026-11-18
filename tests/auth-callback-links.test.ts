import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authLinkErrorMessage, isTokenHashType, parseAuthFragment, safeNext, CONFIRMED_PATH, COMPLETE_PATH } from "../lib/auth-redirects.ts";
import { isExistingAccountError } from "../lib/resend-cooldown.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("fragment links (requests made from the app use the implicit flow)", () => {
  test("session in the fragment is read, with its type", () => {
    assert.deepEqual(parseAuthFragment("#access_token=a&refresh_token=r&type=recovery&expires_in=3600"), { kind: "tokens", accessToken: "a", refreshToken: "r", type: "recovery" });
    assert.deepEqual(parseAuthFragment("access_token=a&refresh_token=r"), { kind: "tokens", accessToken: "a", refreshToken: "r", type: null });
  });
  test("an expired or used link is an error, not a silent blank", () => {
    assert.deepEqual(parseAuthFragment("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"), { kind: "error", reason: "link_expired" });
    assert.deepEqual(parseAuthFragment("#error=server_error&error_code=unexpected_failure"), { kind: "error", reason: "link_error" });
  });
  test("nothing usable is 'none' and never throws", () => {
    for (const h of [undefined, null, "", "#", "#foo=bar", "#access_token=only"]) assert.deepEqual(parseAuthFragment(h as string), { kind: "none" });
  });
  test("every failure reason the callback can produce has plain-language text", () => {
    for (const r of ["link_expired", "missing_code", "invalid_type", "link_error"]) assert.ok(authLinkErrorMessage(r));
    assert.equal(authLinkErrorMessage(undefined), null);
    assert.equal(authLinkErrorMessage("<script>"), null);
  });
});

describe("callback route", () => {
  const route = read("app/auth/callback/route.ts");
  test("a link with no code forwards to the client completion page instead of dead-ending", () => {
    assert.match(route, /COMPLETE_PATH/);
    assert.doesNotMatch(route, /if \(!code && !tokenHash\) return failure\("missing_code"\)/);
    assert.equal(COMPLETE_PATH, "/auth/complete");
  });
  test("token_hash verification is limited to a known list of types", () => {
    assert.match(route, /isTokenHashType\(type\)/);
    for (const t of ["recovery", "signup", "email", "magiclink", "invite", "email_change"]) assert.equal(isTokenHashType(t), true);
    for (const t of ["", null, undefined, "admin", "reauthentication", "RECOVERY"]) assert.equal(isTokenHashType(t as string), false);
  });
  test("redirects stay same-site: next is validated and the confirmed page is allowed", () => {
    assert.equal(safeNext(CONFIRMED_PATH), "/auth/confirmed");
    assert.equal(safeNext("//evil.example"), "/host");
    assert.equal(safeNext("https://evil.example"), "/host");
    assert.equal(safeNext("/auth/callback"), "/host");
  });
});

describe("completion page and screens", () => {
  const complete = read("app/auth/complete/CompleteClient.tsx");
  test("tokens are set client-side, removed from the address bar, and dead links go to the explained screens", () => {
    assert.match(complete, /setSession\(/);
    assert.match(complete, /history\.replaceState/);
    assert.match(complete, /\/login\?error=/);
    assert.match(complete, /RESET_PASSWORD_PATH\}\?error=/);
  });
  test("login explains a dead link and offers a fresh confirmation email and a reset", () => {
    const login = read("app/(marketing)/login/LoginForm.tsx");
    assert.match(login, /authLinkErrorMessage\(linkError\)/);
    assert.match(login, /<ResendConfirmation/);
    assert.match(login, /\/forgot-password/);
    assert.match(read("app/(marketing)/login/page.tsx"), /linkError=\{searchParams\.error\}/);
  });
  test("sign-up gives an existing address the same check-your-email screen (confirmations off returns an error)", () => {
    assert.equal(isExistingAccountError({ code: "user_already_exists" }), true);
    assert.equal(isExistingAccountError(new Error("User already registered")), true);
    assert.equal(isExistingAccountError(new Error("Password should be at least 6 characters")), false);
    assert.match(read("app/(marketing)/signup/SignUpForm.tsx"), /isExistingAccountError\(error\)/);
  });
  test("confirmed page tells app users to go back to the app", () => {
    assert.match(read("app/auth/confirmed/page.tsx"), /Go back to the Place &amp; Plenty app/);
  });
});
