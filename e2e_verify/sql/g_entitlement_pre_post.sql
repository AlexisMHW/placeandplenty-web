\set ON_ERROR_STOP 0
begin;
insert into auth.users(id,email) values ('00000000-0000-0000-0000-00000000a001','g1@t.test'),('00000000-0000-0000-0000-00000000a002','g2@t.test'),('00000000-0000-0000-0000-00000000a003','g3@t.test'),('00000000-0000-0000-0000-00000000a004','g4@t.test');
insert into gathering_entitlements(user_id,entitlement_type,active,purchased_at,expires_at,scope,source) values
 ('00000000-0000-0000-0000-00000000a001','plus',true,now()-interval '10 days',now()+interval '300 days','account','test'),
 ('00000000-0000-0000-0000-00000000a002','plus',true,now()-interval '10 days',now()+interval '300 days','account','test'),
 ('00000000-0000-0000-0000-00000000a003','plus',true,now()-interval '400 days',now()-interval '35 days','account','test'),
 ('00000000-0000-0000-0000-00000000a004','plus',true,now()-interval '10 days',null,'account','test');
update gathering_entitlements set refunded_at=now() where user_id='00000000-0000-0000-0000-00000000a002';
select 'ACL anon/auth', has_function_privilege('anon','public.current_plus_term(uuid)','execute'), has_function_privilege('authenticated','public.current_plus_term(uuid)','execute');
select 'active plus (a001)', count(*) from current_plus_term('00000000-0000-0000-0000-00000000a001');
select 'refunded plus (a002)', count(*) from current_plus_term('00000000-0000-0000-0000-00000000a002');
select 'expired plus (a003)', count(*) from current_plus_term('00000000-0000-0000-0000-00000000a003');
select 'lifetime plus (a004)', count(*) from current_plus_term('00000000-0000-0000-0000-00000000a004');
rollback;
