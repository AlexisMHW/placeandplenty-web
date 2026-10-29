-- QA ONLY. Run as database owner in the isolated Canva QA branch.
-- Synthetic fixtures exist only within this transaction. No production data or
-- persistent application rows are changed. Failure aborts the transaction.
begin;
set local statement_timeout = '20s';
do $$ begin
 if exists(select 1 from auth.users) or exists(select 1 from public.gatherings) then
   raise exception 'QA guard: requires an empty isolated branch';
 end if;
end $$;
insert into auth.users (id,email,raw_app_meta_data,raw_user_meta_data)
values
 ('ca000000-0000-4000-8000-000000000001','canva-owner@example.invalid','{"provider":"email"}','{}'),
 ('ca000000-0000-4000-8000-000000000002','canva-cohost@example.invalid','{"provider":"email"}','{}'),
 ('ca000000-0000-4000-8000-000000000003','canva-invited@example.invalid','{"provider":"email"}','{}'),
 ('ca000000-0000-4000-8000-000000000004','canva-stranger@example.invalid','{"provider":"email"}','{}');
insert into public.gatherings (id,owner_user_id,name,gathering_type,gathering_date,arrival_time)
values ('ca000000-0000-4000-8000-000000000010','ca000000-0000-4000-8000-000000000001','Canva transaction-only QA','dinner',current_date+30,'18:00');
insert into public.gathering_members (gathering_id,user_id,invited_email,status)
values
 ('ca000000-0000-4000-8000-000000000010','ca000000-0000-4000-8000-000000000002','canva-cohost@example.invalid','accepted'),
 ('ca000000-0000-4000-8000-000000000010','ca000000-0000-4000-8000-000000000003','canva-invited@example.invalid','invited');
set local role authenticated;
set local request.jwt.claim.sub = 'ca000000-0000-4000-8000-000000000001';
do $$ begin
 if (select count(*) from public.list_my_gatherings_with_lifecycle() where id='ca000000-0000-4000-8000-000000000010') <> 1 then raise exception 'owner cannot list gathering'; end if;
 insert into storage.objects(bucket_id,name) values ('invitation-artwork','ca000000-0000-4000-8000-000000000010/qa-owner.png');
 perform public.save_invitation_artwork('ca000000-0000-4000-8000-000000000010','ca000000-0000-4000-8000-000000000010/qa-owner.png','image/png','qa-owner.png');
 if (select invitation_artwork_path from public.gatherings where id='ca000000-0000-4000-8000-000000000010') not like '%/qa-owner.png' then raise exception 'owner save failed'; end if;
 insert into public.canva_authorization_codes(code_hash,user_id,code_challenge,encrypted_grant,expires_at)
 values ('qa-valid','ca000000-0000-4000-8000-000000000001','qa-pkce','qa-encrypted',now()+interval '60 seconds');
 begin
   insert into public.canva_authorization_codes(code_hash,user_id,code_challenge,encrypted_grant,expires_at)
   values ('qa-wrong-user','ca000000-0000-4000-8000-000000000002','qa-pkce','qa-encrypted',now()+interval '60 seconds');
   raise exception 'authorization code accepted another user';
 exception when insufficient_privilege then null; end;
 begin
   perform 1 from public.canva_authorization_codes;
   raise exception 'authorization code table is readable';
 exception when insufficient_privilege then null; end;
end $$;
set local request.jwt.claim.sub = 'ca000000-0000-4000-8000-000000000002';
do $$ begin
 if (select count(*) from public.list_my_gatherings_with_lifecycle() where id='ca000000-0000-4000-8000-000000000010') <> 1 then raise exception 'accepted cohost cannot list'; end if;
 if not exists(select 1 from storage.objects where bucket_id='invitation-artwork' and name='ca000000-0000-4000-8000-000000000010/qa-owner.png') then raise exception 'cohost cannot read artwork'; end if;
 insert into storage.objects(bucket_id,name) values ('invitation-artwork','ca000000-0000-4000-8000-000000000010/qa-cohost.png');
 perform public.save_invitation_artwork('ca000000-0000-4000-8000-000000000010','ca000000-0000-4000-8000-000000000010/qa-cohost.png','image/png','qa-cohost.png');
end $$;
set local request.jwt.claim.sub = 'ca000000-0000-4000-8000-000000000003';
do $$ begin
 if exists(select 1 from public.list_my_gatherings_with_lifecycle() where id='ca000000-0000-4000-8000-000000000010') then raise exception 'unaccepted invitee can list'; end if;
 if exists(select 1 from storage.objects where bucket_id='invitation-artwork' and name like 'ca000000-0000-4000-8000-000000000010/%') then raise exception 'unauthorized artwork read'; end if;
 begin
   insert into storage.objects(bucket_id,name) values ('invitation-artwork','ca000000-0000-4000-8000-000000000010/qa-denied.png');
   raise exception 'unauthorized artwork upload';
 exception when insufficient_privilege then null; end;
 begin
   perform public.save_invitation_artwork('ca000000-0000-4000-8000-000000000010','qa-invalid.png','image/png','qa.png');
   raise exception 'unaccepted invitee can save';
 exception when raise_exception then
   if sqlerrm <> 'not authorized' then raise; end if;
 end;
end $$;
set local request.jwt.claim.sub = 'ca000000-0000-4000-8000-000000000004';
do $$ begin
 if exists(select 1 from public.list_my_gatherings_with_lifecycle() where id='ca000000-0000-4000-8000-000000000010') then raise exception 'stranger can list'; end if;
 if exists(select 1 from storage.objects where bucket_id='invitation-artwork' and name like 'ca000000-0000-4000-8000-000000000010/%') then raise exception 'unauthorized artwork read'; end if;
 begin
   insert into storage.objects(bucket_id,name) values ('invitation-artwork','ca000000-0000-4000-8000-000000000010/qa-denied.png');
   raise exception 'unauthorized artwork upload';
 exception when insufficient_privilege then null; end;
 begin
   perform public.save_invitation_artwork('ca000000-0000-4000-8000-000000000010','qa-invalid.png','image/png','qa.png');
   raise exception 'stranger can save';
 exception when raise_exception then
   if sqlerrm <> 'not authorized' then raise; end if;
 end;
end $$;
set local role anon;
do $$ begin
 if public.redeem_canva_authorization_code('qa-valid','wrong-pkce') is not null then raise exception 'wrong PKCE accepted'; end if;
 if public.redeem_canva_authorization_code('qa-valid','qa-pkce') is distinct from 'qa-encrypted' then raise exception 'valid redemption failed'; end if;
 if public.redeem_canva_authorization_code('qa-valid','qa-pkce') is not null then raise exception 'code replay accepted'; end if;
end $$;
rollback;
select 'PASS: owner/cohost writes; invitee/stranger denial; code ownership, read denial, PKCE and replay. Transaction rolled back.' as result;
