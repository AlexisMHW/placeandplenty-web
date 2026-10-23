import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}'),('${other}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  await db.exec(
    await readFile(
      new URL(
        "../../docs/integrations/sql/canva_authorization_codes.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
async function insert(
  code: string,
  user = owner,
  expiration = "now()+interval '1 minute'",
) {
  await db.exec(
    `set role authenticated; set request.jwt.claim.sub='${owner}';`,
  );
  return db.query(
    `insert into public.canva_authorization_codes(code_hash,user_id,code_challenge,encrypted_grant,expires_at) values ($1,$2,'challenge','encrypted-grant',${expiration})`,
    [code, user],
  );
}
async function redeem(code: string, challenge = "challenge") {
  await db.exec("set role anon");
  const result = await db.query<{ grant: string | null }>(
    "select public.redeem_canva_authorization_code($1,$2) as grant",
    [code, challenge],
  );
  return result.rows[0]?.grant;
}
it("RLS permits own code insert but rejects cross-account insertion and any table read", async () => {
  await insert("own");
  await expect(insert("other", other)).rejects.toThrow(/row-level security/);
  await expect(
    db.query("select * from public.canva_authorization_codes"),
  ).rejects.toThrow(/permission denied/);
  await db.exec("set role anon");
  await expect(
    db.query("select * from public.canva_authorization_codes"),
  ).rejects.toThrow(/permission denied/);
});
it("wrong PKCE cannot consume the code, and a valid code can be redeemed once", async () => {
  await insert("once");
  expect(await redeem("once", "wrong")).toBeNull();
  expect(await redeem("once")).toBe("encrypted-grant");
  expect(await redeem("once")).toBeNull();
});
it("expired and unknown codes cannot be redeemed", async () => {
  await insert("expired", owner, "now()-interval '1 minute'");
  expect(await redeem("expired")).toBeNull();
  expect(await redeem("unknown")).toBeNull();
});
it("back-to-back queued redemptions return only one grant", async () => {
  await insert("race");
  await db.exec("set role anon");
  const results = await Promise.all([
    db.query<{ grant: string | null }>(
      "select public.redeem_canva_authorization_code('race','challenge') as grant",
    ),
    db.query<{ grant: string | null }>(
      "select public.redeem_canva_authorization_code('race','challenge') as grant",
    ),
  ]);
  expect(results.map((r) => r.rows[0]?.grant).filter(Boolean)).toEqual([
    "encrypted-grant",
  ]);
});
