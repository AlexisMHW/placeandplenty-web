-- Run only on isolated Canva QA. All fixtures are transaction-local and rolled back.
begin;
set local statement_timeout = '20s';
create temporary table canva_plan_cases (
 kind text, user_id uuid, gathering_id uuid, plus_access boolean,
 smart_access boolean, multi_day_access boolean
);
insert into canva_plan_cases values
 ('free','cb000000-0000-4000-8000-000000000001','cb000000-0000-4000-8000-000000000101',false,false,false),
 ('gathering_pass','cb000000-0000-4000-8000-000000000002','cb000000-0000-4000-8000-000000000102',false,true,false),
 ('plus','cb000000-0000-4000-8000-000000000003','cb000000-0000-4000-8000-000000000103',true,true,false),
 ('multi_day_pass','cb000000-0000-4000-8000-000000000004','cb000000-0000-4000-8000-000000000104',false,true,true),
 ('expired_plus','cb000000-0000-4000-8000-000000000005','cb000000-0000-4000-8000-000000000105',false,false,false),
 ('refunded_plus','cb000000-0000-4000-8000-000000000006','cb000000-0000-4000-8000-000000000106',false,false,false),
 ('revoked_multi_day','cb000000-0000-4000-8000-000000000007','cb000000-0000-4000-8000-000000000107',false,false,false);
do $$ begin
 if exists(select 1 from auth.users u join canva_plan_cases c on c.user_id=u.id)
 then raise exception 'QA fixture collision; no existing rows may be changed'; end if;
end $$;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
 select user_id,'canva-plan-'||kind||'@example.invalid','{"provider":"email"}','{}'
 from canva_plan_cases;
insert into public.gatherings(id,owner_user_id,name,gathering_type,gathering_date,arrival_time,duration_type,gathering_end_date)
 select gathering_id,user_id,'Canva plan QA '||kind,'dinner',current_date+30,'18:00',
 case when kind in ('multi_day_pass','revoked_multi_day') then 'multi_day' else 'single_day' end,
 case when kind in ('multi_day_pass','revoked_multi_day') then current_date+31 else null end
 from canva_plan_cases;
insert into public.gathering_entitlements(user_id,gathering_id,entitlement_type,canonical_product_id,scope,provider,source,expires_at,refunded_at,revoked_at)
 select user_id,
 case when kind like '%plus' or kind='plus' then null else gathering_id end,
 case when kind like '%plus' or kind='plus' then 'plus' when kind='revoked_multi_day' then 'multi_day_pass' else kind end,
 case when kind like '%plus' or kind='plus' then 'plus_annual' when kind='revoked_multi_day' then 'multi_day_pass' else kind end,
 case when kind like '%plus' or kind='plus' then 'account' else 'gathering' end,
 'beta','canva_transaction_only_qa',
 case when kind='expired_plus' then now()-interval '1 day' else now()+interval '1 year' end,
 case when kind='refunded_plus' then now() else null end,
 case when kind='revoked_multi_day' then now() else null end
 from canva_plan_cases where kind<>'free';
create temporary table canva_entitlements_before as
 select ge.* from public.gathering_entitlements ge join canva_plan_cases c on c.user_id=ge.user_id;
grant select on canva_plan_cases to authenticated;
set local role authenticated;
do $$ declare c record; begin
 for c in select * from canva_plan_cases loop
   perform set_config('request.jwt.claim.sub',c.user_id::text,true);
   if public.user_has_plus() is distinct from c.plus_access
     or public.gathering_can_access_smart_closet(c.gathering_id) is distinct from c.smart_access
     or public.gathering_has_multi_day_access(c.gathering_id) is distinct from c.multi_day_access
   then raise exception 'baseline plan mismatch: %',c.kind; end if;
   if not exists(select 1 from public.list_my_gatherings_with_lifecycle() where id=c.gathering_id)
   then raise exception 'owner cannot select % gathering',c.kind; end if;
   perform public.save_invitation_artwork(c.gathering_id,c.gathering_id::text||'/plan-qa.png','image/png','plan-qa.png');
   if public.user_has_plus() is distinct from c.plus_access
     or public.gathering_can_access_smart_closet(c.gathering_id) is distinct from c.smart_access
     or public.gathering_has_multi_day_access(c.gathering_id) is distinct from c.multi_day_access
   then raise exception 'artwork changed paid access: %',c.kind; end if;
 end loop;
 -- A paid account must not gain access to another host's gathering.
 perform set_config('request.jwt.claim.sub','cb000000-0000-4000-8000-000000000003',true);
 if exists(select 1 from public.list_my_gatherings_with_lifecycle() where id='cb000000-0000-4000-8000-000000000101')
   or public.gathering_can_access_smart_closet('cb000000-0000-4000-8000-000000000101')
 then raise exception 'Plus bypassed membership'; end if;
 begin
   perform public.save_invitation_artwork('cb000000-0000-4000-8000-000000000101','blocked.png','image/png','blocked.png');
   raise exception 'Plus account wrote unrelated artwork';
 exception when raise_exception then
   if sqlerrm <> 'not authorized' then raise; end if;
 end;
end $$;
reset role;
do $$ begin
 if exists((select * from canva_entitlements_before except select ge.* from public.gathering_entitlements ge join canva_plan_cases c on c.user_id=ge.user_id)
 union all
 (select ge.* from public.gathering_entitlements ge join canva_plan_cases c on c.user_id=ge.user_id except select * from canva_entitlements_before))
 then raise exception 'entitlement records changed'; end if;
end $$;
rollback;
select 'PASS: seven plan states preserve Plus/Smart Closet/Multi-Day access and entitlement rows; paid stranger denied. Fixtures rolled back.' as result;
