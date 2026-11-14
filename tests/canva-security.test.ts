import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  digest,
  equalSecret,
  openGrant,
  sealGrant,
  validateOAuthRequest,
  validVerifier,
  validOAuthClient,
} from "../lib/canva-security.ts";
const key = randomBytes(32).toString("base64");
test("Canva grant rejects tampering, wrong keys, expiration and malformed data", () => {
  const now = Date.now();
  const grant = {
    userId: "host-a",
    accessToken: "private-supabase-token",
    expiresAt: now + 60000,
  };
  const token = sealGrant(grant, key);
  assert.deepEqual(openGrant(token, key, now), grant);
  assert.ok(!token.includes(grant.accessToken));
  assert.throws(() =>
    openGrant(token, randomBytes(32).toString("base64"), now),
  );
  const bytes = Buffer.from(token, "base64url");
  bytes[30] ^= 1;
  assert.throws(() => openGrant(bytes.toString("base64url"), key, now));
  assert.throws(() => openGrant(token, key, now + 60001));
  assert.throws(() => openGrant("broken", key, now));
  assert.throws(() =>
    openGrant(sealGrant({ ...grant, expiresAt: now + 700000 }, key), key, now),
  );
});
test("OAuth binds exact client, callback, S256 and allowed scopes", () => {
  const config = {
    clientId: "canva-client",
    redirectUri: "https://www.canva.com/oauth/callback",
  };
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: digest("verifier"),
    state: "opaque-state",
    scope: "invitation:write gatherings:read",
  });
  assert.equal(validateOAuthRequest(params, config).state, "opaque-state");
  for (const [name, value] of [
    ["client_id", "attacker"],
    ["redirect_uri", "https://evil.example"],
    ["response_type", "token"],
    ["code_challenge_method", "plain"],
    ["scope", "admin"],
    ["state", ""],
    ["code_challenge", "bad"],
  ]) {
    const invalid = new URLSearchParams(params);
    invalid.set(name, value);
    assert.throws(() => validateOAuthRequest(invalid, config));
  }
  assert.ok(validVerifier("x".repeat(43)));
  assert.ok(!validVerifier("short"));
  assert.ok(!validVerifier("/".repeat(43)));
  assert.ok(equalSecret("secret", "secret"));
  assert.ok(!equalSecret("secret", "other"));
  assert.ok(!equalSecret("secret", "short"));
});

test("OAuth public client mode is explicit and keeps confidential mode fail-closed", () => {
  const confidential = {
    clientId: "qa",
    clientAuth: "secret",
    clientSecret: "private",
  };
  assert.equal(validOAuthClient("qa", "private", confidential), true);
  assert.equal(validOAuthClient("qa", "", confidential), false);
  assert.equal(
    validOAuthClient("qa", "", { ...confidential, clientSecret: undefined }),
    false,
  );
  assert.equal(
    validOAuthClient("other", "", { clientId: "qa", clientAuth: "public" }),
    false,
  );
  assert.equal(
    validOAuthClient("qa", "", { clientId: "qa", clientAuth: "public" }),
    true,
  );
  assert.equal(
    validOAuthClient("qa", "unexpected", {
      clientId: "qa",
      clientAuth: "public",
    }),
    false,
  );
});
