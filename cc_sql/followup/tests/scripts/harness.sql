-- test harness (schema t, not public). q(uid, role, sql): run `select (sql)::text` as that identity; returns value or 'ERR sqlstate:message'
create schema if not exists t;
create table if not exists t.res (n serial, label text, ok boolean, got text, want text);
create or replace function t.q(p_uid uuid, p_role text, p_sql text) returns text language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', case when p_uid is null and p_role='anon' then json_build_object('role','anon')::text
     else json_build_object('sub',p_uid,'role',p_role)::text end, true);
  execute 'set local role '||quote_ident(p_role);
  begin
    execute 'select ('||p_sql||')::text' into v;
  exception when others then
    v := 'ERR '||sqlstate||':'||sqlerrm;
  end;
  reset role;
  perform set_config('request.jwt.claims','',true);
  return coalesce(v,'NULL');
end $f$;
-- exec(uid, role, sql): run a statement (no result), returns 'ok' or ERR
create or replace function t.x(p_uid uuid, p_role text, p_sql text) returns text language plpgsql as $f$
declare v text := 'ok';
begin
  perform set_config('request.jwt.claims', case when p_uid is null then json_build_object('role',p_role)::text else json_build_object('sub',p_uid,'role',p_role)::text end, true);
  execute 'set local role '||quote_ident(p_role);
  begin execute p_sql; exception when others then v := 'ERR '||sqlstate||':'||sqlerrm; end;
  reset role;
  perform set_config('request.jwt.claims','',true);
  return v;
end $f$;
create or replace function t.eq(p_label text, p_got text, p_want text) returns void language plpgsql as $f$
begin insert into t.res(label,ok,got,want) values (p_label, p_got is not distinct from p_want, p_got, p_want); end $f$;
-- like: want is a LIKE pattern
create or replace function t.lk(p_label text, p_got text, p_pat text) returns void language plpgsql as $f$
begin insert into t.res(label,ok,got,want) values (p_label, p_got like p_pat, p_got, p_pat); end $f$;
create or replace function t.report() returns text language sql as $f$
 select string_agg((case when ok then 'PASS ' else 'FAIL ' end)||label||case when ok then '' else '  got=['||coalesce(left(got,300),'NULL')||'] want=['||coalesce(want,'NULL')||']' end, E'\n' order by n)
        ||E'\nTOTAL pass='||count(*) filter (where ok)||' fail='||count(*) filter (where not ok) from t.res $f$;
-- helper to make users
create or replace function t.mkuser(p_email text default null) returns uuid language plpgsql as $f$
declare u uuid := gen_random_uuid(); begin
 insert into auth.users(id,email,email_confirmed_at,last_sign_in_at) values (u, coalesce(p_email,u||'@example.test'), now(), now()); return u; end $f$;
