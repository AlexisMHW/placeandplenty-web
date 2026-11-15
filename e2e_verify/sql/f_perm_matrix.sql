-- F: permission matrix over every function added or changed by the 40 steps (the list is injected into e_f_targets by the runner).
-- Each call runs in its own sub-transaction that is ALWAYS rolled back (nothing persists). Roles are simulated like Supabase: SET LOCAL ROLE + request.jwt.claims.
create table if not exists public.e_f_results(fn text, who text, outcome text, msg text);
truncate public.e_f_results;
do $$
declare
  f record; w record; v_args text; v_call text; v_out text; v_msg text; v_state text; a record; v_claims text;
  v_roles text[][] := array[['anon',''],['authenticated','nonstaff'],['authenticated','support'],['authenticated','marketing_pr'],['authenticated','business_admin'],['authenticated','creator_program_manager'],['authenticated','owner'],['service_role','']];
  i int; v_uid uuid; v_role text; v_who text;
begin
  for f in select t.oid, t.proname, t.sig from public.e_f_targets t order by t.sig loop
    v_args := '';
    for a in select (row_number() over ())::int as n, format_type(x.typ, null) as ty
               from unnest((select proargtypes::oid[] from pg_proc where oid = f.oid)) with ordinality as x(typ, ord) order by x.ord loop
      v_args := v_args || case when v_args = '' then '' else ',' end ||
        case
          when a.ty = 'uuid' then quote_literal('00000000-0000-0000-0000-0000000000aa') || '::uuid'
          when a.ty in ('integer','bigint','smallint') then '1::' || a.ty
          when a.ty = 'numeric' then '1::numeric'
          when a.ty = 'boolean' then 'false'
          when a.ty = 'jsonb' then '''{}''::jsonb'
          when a.ty = 'json' then '''{}''::json'
          when a.ty like 'timestamp%' then 'now()::' || a.ty
          when a.ty = 'date' then 'current_date'
          when a.ty = 'uuid[]' then '''{}''::uuid[]'
          when a.ty = 'text[]' then '''{}''::text[]'
          when a.ty = 'citext' then '''x@e2e.test''::citext'
          else quote_literal('x') || '::' || a.ty end;
    end loop;
    v_call := format('select %s(%s)', f.oid::regproc::text, v_args);
    for i in 1 .. array_length(v_roles, 1) loop
      v_role := v_roles[i][1]; v_who := case when v_roles[i][2] = '' then v_role else v_roles[i][2] end;
      v_uid := case v_roles[i][2] when '' then null when 'nonstaff' then '00000000-0000-0000-0000-0000000000f0'::uuid
                 else (select user_id from public.staff_members where role = v_roles[i][2] limit 1) end;
      v_claims := case when v_uid is null then jsonb_build_object('role', v_role)::text else jsonb_build_object('sub', v_uid, 'role', v_role, 'aud', 'authenticated')::text end;
      begin
        perform set_config('request.jwt.claims', v_claims, true);
        execute format('set local role %I', v_role);
        execute v_call;
        raise exception '__OK__';
      exception when others then
        v_msg := sqlerrm; v_state := sqlstate;
      end;
      v_out := case when v_msg = '__OK__' then 'SUCCESS' when v_state = '42501' then 'DENIED_ACL' when v_msg ~* 'not[_ ]authorized|not_staff|owner_required|forbidden|service_role_required|hc_service_required|not_found|no_application' then 'DENIED_FN' else 'REACHED_ERR' end;
      insert into public.e_f_results values (f.sig, v_who, v_out, left(v_msg, 120));
    end loop;
  end loop;
end $$;
