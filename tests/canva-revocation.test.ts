import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertCanvaGrantActive,
  revokeCanvaGrant,
} from "../lib/canva-revocation.ts";
import { digest } from "../lib/canva-security.ts";
import { oauthClientAuthorized } from "../lib/canva-oauth-client.ts";
const config = { clientId: "canva-qa", clientAuth: "public" };
function fake(data: unknown, error: unknown = null) {
  const calls: unknown[] = [];
  return {
    calls,
    client: {
      rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return { data, error };
      },
    } as unknown as SupabaseClient,
  };
}
test("grant checks require an explicit non-revoked result and fail closed", async () => {
  for (const data of [true, null, undefined, "false", {}, 0])
    await assert.rejects(
      assertCanvaGrantActive(fake(data).client, "opaque-token"),
    );
  await assert.rejects(
    assertCanvaGrantActive(
      fake(false, { message: "offline" }).client,
      "opaque-token",
    ),
  );
  const good = fake(false);
  await assertCanvaGrantActive(good.client, "opaque-token");
  assert.deepEqual(good.calls, [
    {
      name: "is_canva_grant_revoked",
      args: { p_token_hash: digest("opaque-token") },
    },
  ]);
});
test("revocation sends only a hash and expiry; failures never claim completion", async () => {
  const good = fake(true);
  await revokeCanvaGrant(good.client, "secret-token", 100000);
  assert.deepEqual(good.calls, [
    {
      name: "revoke_canva_grant",
      args: {
        p_token_hash: digest("secret-token"),
        p_expires_at: new Date(100000).toISOString(),
      },
    },
  ]);
  for (const data of [false, null, "true"])
    await assert.rejects(revokeCanvaGrant(fake(data).client, "token", 100000));
  await assert.rejects(
    revokeCanvaGrant(fake(true, {}).client, "token", 100000),
  );
});
test("OAuth client authentication handles body and Basic modes without ambiguous credentials", () => {
  const body = new URLSearchParams({ client_id: "canva-qa" });
  assert.equal(oauthClientAuthorized(new Headers(), body, config), true);
  const basic = (value: string) =>
    new Headers({
      Authorization: `Basic ${Buffer.from(value).toString("base64")}`,
    });
  assert.equal(oauthClientAuthorized(basic("canva-qa:"), body, config), true);
  assert.equal(
    oauthClientAuthorized(basic("canva-qa:wrong"), body, config),
    false,
  );
  assert.equal(
    oauthClientAuthorized(
      basic("canva-qa:"),
      new URLSearchParams({ client_id: "other" }),
      config,
    ),
    false,
  );
  assert.equal(oauthClientAuthorized(basic("canva-qa"), body, config), false);
  assert.equal(oauthClientAuthorized(basic("%ZZ:"), body, config), false);
  assert.equal(
    oauthClientAuthorized(
      new Headers({ Authorization: "Bearer token" }),
      body,
      config,
    ),
    false,
  );
  assert.equal(
    oauthClientAuthorized(
      new Headers(),
      new URLSearchParams("client_id=canva-qa&client_id=other"),
      config,
    ),
    false,
  );
  assert.equal(
    oauthClientAuthorized(basic("canva-qa:correct"), new URLSearchParams(), {
      ...config,
      clientAuth: "secret",
      clientSecret: "correct",
    }),
    true,
  );
  assert.equal(
    oauthClientAuthorized(
      basic("canva-qa:correct"),
      new URLSearchParams({ client_secret: "other" }),
      { ...config, clientAuth: "secret", clientSecret: "correct" },
    ),
    false,
  );
});
