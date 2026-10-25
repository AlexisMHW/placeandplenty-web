import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const gathering = "33333333-3333-4333-8333-333333333333";
const request = "44444444-4444-4444-8444-444444444444";
const hash = "a".repeat(64);
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema storage;
    create table auth.users(id uuid primary key); insert into auth.users values ('${owner}'),('${other}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    create table storage.objects(bucket_id text,name text);
    create table public.gatherings(id uuid primary key,owner_user_id uuid,effective_status text,duration_type text,path text,saves integer default 0);
    insert into public.gatherings values ('${gathering}','${owner}','active','single_day',null,0);
    insert into public.gatherings values ('66666666-6666-4666-8666-666666666666','${other}','active','single_day',null,0);
    alter table public.gatherings enable row level security;
    grant select on public.gatherings to authenticated;
    create policy owned on public.gatherings for select to authenticated using(owner_user_id=auth.uid());
    create function public.is_accepted_gathering_member(p_id uuid) returns boolean language sql security definer as $$
      select exists(select 1 from public.gatherings where id=p_id and owner_user_id=auth.uid()); $$;
    create function public.effective_gathering_status(p_id uuid) returns text language plpgsql security definer as $$ begin
      if not public.is_accepted_gathering_member(p_id) then raise exception 'not_authorized'; end if;
      return (select effective_status from public.gatherings where id=p_id);
    end $$;
    -- Like production: invoker/RLS list calls a guarded lifecycle function per row.
    create function public.list_my_gatherings_with_lifecycle() returns table(id uuid,effective_status text,duration_type text) language sql as $$
      select g.id,public.effective_gathering_status(g.id),g.duration_type from public.gatherings g; $$;
    create function public.save_invitation_artwork(p_id uuid,p_path text,p_mime text,p_name text) returns void language plpgsql security definer as $$ begin
      if not exists(select 1 from public.gatherings where id=p_id and owner_user_id=auth.uid()) then raise exception 'not authorized'; end if;
      update public.gatherings set path=p_path,saves=saves+1 where id=p_id;
    end $$;`);
  for (const file of [
    "canva_authorization_codes.sql",
    "canva_publisher_safeguards.sql",
    "canva_selected_gathering_guard.sql",
  ])
    await db.exec(
      await readFile(
        new URL(`../../docs/integrations/sql/${file}`, import.meta.url),
        "utf8",
      ),
    );
}, 30000);
beforeEach(async () => {
  await db.exec(`reset role; reset request.jwt.claim.sub;
    delete from canva_private.rate_events; delete from canva_private.publish_requests;
    delete from public.canva_authorization_codes; delete from storage.objects;
    update public.gatherings set effective_status='active',path=null,saves=0;`);
});
afterAll(async () => {
  await db.close();
});
async function asUser(user = owner) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${user}';`);
}
async function begin(id = request, content = hash) {
  const r = await db.query<{ result: Record<string, any> }>(
    "select public.begin_canva_publish($1,$2,$3) as result",
    [id, gathering, content],
  );
  return r.rows[0]!.result;
}
async function complete(lease: string) {
  return db.query("select public.complete_canva_publish($1,$2)", [
    request,
    lease,
  ]);
}
async function storeObject(path: string) {
  await db.exec("reset role");
  await db.query(
    "insert into storage.objects values ('invitation-artwork',$1)",
    [path],
  );
  await asUser();
}
it("private state, cleanup and protected RPCs are inaccessible to anon", async () => {
  await db.exec("set role anon");
  await expect(
    db.query("select public.check_canva_gathering_quota()"),
  ).rejects.toThrow(/permission denied/);
  await expect(begin()).rejects.toThrow(/permission denied/);
  await asUser();
  await expect(
    db.query("select * from canva_private.publish_requests"),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.query("select canva_private.cleanup_temporary_records()"),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.query(
      "insert into public.canva_authorization_codes values ('own',$1,'challenge','grant',now(),null)",
      [owner],
    ),
  ).rejects.toThrow(/permission denied/);
});
it("gathering quota is per account and reports a bounded retry time", async () => {
  await asUser();
  for (let i = 0; i < 60; i++)
    expect(
      (
        await db.query<{ r: any }>(
          "select public.check_canva_gathering_quota() r",
        )
      ).rows[0]!.r.status,
    ).toBe("allowed");
  const blocked = (
    await db.query<{ r: any }>("select public.check_canva_gathering_quota() r")
  ).rows[0]!.r;
  expect(blocked.status).toBe("rate_limited");
  expect(blocked.retry_after).toBeGreaterThan(0);
  expect(blocked.retry_after).toBeLessThanOrEqual(60);
  await asUser(other);
  expect(
    (
      await db.query<{ r: any }>(
        "select public.check_canva_gathering_quota() r",
      )
    ).rows[0]!.r.status,
  ).toBe("allowed");
});
it("authorization issuance stops at ten approvals and cannot be bypassed by direct INSERT", async () => {
  await asUser();
  for (let i = 0; i < 11; i++) {
    const { rows } = await db.query<{ r: any }>(
      "select public.issue_canva_authorization_code($1,$2,$3) r",
      [String(i).padStart(43, "a"), "b".repeat(43), "c".repeat(100)],
    );
    expect(rows[0]!.r.status).toBe(i < 10 ? "issued" : "rate_limited");
  }
  await db.exec("reset role");
  expect(
    (
      await db.query<{ n: number }>(
        "select count(*)::int n from public.canva_authorization_codes",
      )
    ).rows[0]!.n,
  ).toBe(10);
});
it("publish quotas enforce both five per minute and thirty per rolling hour", async () => {
  await asUser();
  for (let i = 0; i < 6; i++)
    expect(
      (await begin(`44444444-4444-4444-8444-${String(i).padStart(12, "0")}`))
        .status,
    ).toBe(i < 5 ? "claimed" : "rate_limited");
  await db.exec(`reset role; delete from canva_private.rate_events;
    insert into canva_private.rate_events select '${owner}','publish',clock_timestamp()-interval '2 minutes' from generate_series(1,30);`);
  await asUser();
  const blocked = await begin();
  expect(blocked.status).toBe("rate_limited");
  expect(blocked.retry_after).toBeGreaterThan(3000);
});
it("completed retries do not save again; request keys bind content and gathering permissions", async () => {
  await asUser();
  const claim = await begin();
  expect((await begin()).status).toBe("in_progress");
  expect((await begin(request, "b".repeat(64))).status).toBe("conflict");
  await expect(complete(claim.lease_id)).rejects.toThrow(/artwork unavailable/);
  await storeObject(claim.path);
  await complete(claim.lease_id);
  expect((await begin()).status).toBe("completed");
  await complete(claim.lease_id);
  await db.exec("reset role");
  expect(
    (
      await db.query<{ saves: number }>(
        `select saves from public.gatherings where id='${gathering}'`,
      )
    ).rows[0]!.saves,
  ).toBe(1);
  await asUser(other);
  await expect(begin()).rejects.toThrow(/Gathering unavailable/);
});
it("expired workers cannot finalize or delete another attempt's object", async () => {
  await asUser();
  const old = await begin();
  await db.exec("reset role");
  await db.query(
    "update canva_private.publish_requests set lease_until=now()-interval '1 second'",
  );
  await asUser();
  const fresh = await begin();
  expect(fresh.path).not.toBe(old.path);
  await expect(complete(old.lease_id)).rejects.toThrow(/lease unavailable/);
  await storeObject(fresh.path);
  await complete(fresh.lease_id);
});
it("permission/lifecycle changes prevent completion without mutating canonical artwork", async () => {
  await asUser();
  const claim = await begin();
  await storeObject(claim.path);
  await db.exec(
    "reset role; update public.gatherings set effective_status='archived'",
  );
  await asUser();
  await expect(complete(claim.lease_id)).rejects.toThrow(
    /Gathering unavailable/,
  );
  await db.exec("reset role");
  expect(
    (
      await db.query<{ saves: number }>(
        `select saves from public.gatherings where id='${gathering}'`,
      )
    ).rows[0]!.saves,
  ).toBe(0);
});
it("cleanup removes only eligible temporary records and preserves canonical artwork and objects", async () => {
  await asUser();
  const claim = await begin();
  await storeObject(claim.path);
  await complete(claim.lease_id);
  await db.exec(`reset role;
    insert into public.canva_authorization_codes values ('expired','${owner}','c','encrypted',now()-interval '1 minute',null),('live','${owner}','c','encrypted',now()+interval '1 minute',null);
    update canva_private.publish_requests set completed_at=now()-interval '25 hours';
    insert into canva_private.rate_events values ('${owner}','publish',now()-interval '2 hours');
    select canva_private.cleanup_temporary_records();`);
  expect(
    (await db.query("select * from canva_private.publish_requests")).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from public.canva_authorization_codes")).rows,
  ).toHaveLength(1);
  expect((await db.query("select * from storage.objects")).rows).toHaveLength(
    1,
  );
  expect(
    (
      await db.query<{ saves: number }>(
        `select saves from public.gatherings where id='${gathering}'`,
      )
    ).rows[0]!.saves,
  ).toBe(1);
});

it("an unrelated host's gathering cannot block the selected authorized gathering", async () => {
  await asUser();
  const listed = await db.query(
    "select * from public.list_my_gatherings_with_lifecycle()",
  );
  expect(listed.rows).toHaveLength(1);
  expect((await begin()).status).toBe("claimed");
  await asUser(other);
  await expect(begin()).rejects.toThrow(/Gathering unavailable/);
});
