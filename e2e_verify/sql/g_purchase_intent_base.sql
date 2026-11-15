begin;
insert into auth.users(id,email) values ('00000000-0000-0000-0000-00000000b001','o@t.test'),('00000000-0000-0000-0000-00000000b002','lf@t.test'),('00000000-0000-0000-0000-00000000b003','mg@t.test'),('00000000-0000-0000-0000-00000000b004','out@t.test');
insert into gatherings(id,owner_user_id,name,gathering_type,gathering_date,arrival_time,status) values ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-00000000b001','G','dinner',current_date+10,'18:00','draft');
insert into gathering_members(gathering_id,user_id,status,invited_email) select '00000000-0000-0000-0000-0000000000c1',u,'accepted',u||'@x.test' from (values ('00000000-0000-0000-0000-00000000b002'::uuid,'legacy_full'),('00000000-0000-0000-0000-00000000b003','manager')) v(u,l);
create or replace function pg_temp.try(u uuid) returns text language plpgsql as $f$ begin
 perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
 set local role authenticated;
 begin perform public.create_purchase_intent('gathering_pass','00000000-0000-0000-0000-0000000000c1'); reset role; return 'ALLOWED'; exception when others then reset role; return 'DENIED: '||sqlerrm; end; end $f$;
grant execute on function pg_temp.try(uuid) to public;
select 'owner', pg_temp.try('00000000-0000-0000-0000-00000000b001');
select 'legacy_full cohost', pg_temp.try('00000000-0000-0000-0000-00000000b002');
select 'manager cohost', pg_temp.try('00000000-0000-0000-0000-00000000b003');
select 'outsider', pg_temp.try('00000000-0000-0000-0000-00000000b004');
rollback;
