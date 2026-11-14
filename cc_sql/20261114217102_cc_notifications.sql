-- 217102 (A3's cc_sql/217002, RENUMBERED by A1b; 217002 is A1's tier-reconcile number): FOUNDER NOTIFICATIONS, TWO CHANNELS (founder decision D5).
--   (A) Command Center inbox: persistent, permission-filtered per row (cc_notifications.required_permission), dedup'd, acknowledge/resolve.
--   (B) Business email: destination is CONFIGURABLE (never hardcoded), starts UNSET, must be verified by a code before email can be enabled
--       (table CHECK enforces it). This file only QUEUES email rows; it sends nothing. The dispatcher (comms owner) claims rows through
--       cc_claim_email_deliveries and reports results through cc_record_delivery_result. queued != sent != delivered.
--   Bodies carry no applicant names, emails or amounts: titles are generic, details live behind the Command Center login.
-- Depends on: 215000 (staff_has_permission, get_my_staff_context, admin_audit_log), 212001 (hc_require_service), 214000 (hc_owner_notifications,
--   creator_applications), 212000 (payouts). Optional sources (communication_deliveries, entitlement_events) are read only if they exist.
-- A1b: this is the CANONICAL D5 inbox (the Command Center UI calls it). A1's founder_notifications (218000) is SUPERSEDED; 217110 adds a service-only founder_notify_upsert compatibility wrapper.
-- Rollback: rollback/ROLLBACK_217102.sql

create table if not exists public.cc_notification_settings (
  singleton boolean primary key default true check (singleton),
  email_destination text check (email_destination is null or (char_length(email_destination) <= 254 and email_destination ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  destination_status text not null default 'unset' check (destination_status in ('unset','pending_verification','verified')),
  verification_code_hash text,
  verification_expires_at timestamptz,
  verification_sent_at timestamptz,
  verification_attempts integer not null default 0,
  verified_at timestamptz,
  email_enabled boolean not null default false,
  email_min_severity text not null default 'warning' check (email_min_severity in ('info','warning','critical')),
  awaiting_review_hours integer not null default 48 check (awaiting_review_hours between 1 and 720),
  payout_approval_hours integer not null default 24 check (payout_approval_hours between 1 and 720),
  updated_at timestamptz not null default now(),
  updated_by uuid,
  check (not email_enabled or (destination_status = 'verified' and email_destination is not null))
);
insert into public.cc_notification_settings (singleton) values (true) on conflict do nothing;

create table if not exists public.cc_notifications (
  id bigint generated always as identity primary key,
  category text not null check (category in ('hc_application_received','hc_application_possible_duplicate','hc_applications_awaiting_review',
    'hc_application_approved','hc_application_declined','hc_member_onboarded','hc_content_submitted','hc_payout_needs_approval',
    'comms_failed_or_delayed','system_failure')),
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  title text not null check (char_length(title) between 3 and 120),
  body text check (body is null or char_length(body) <= 240),
  ref_type text,
  ref_id text,
  link text check (link is null or link ~ '^/command-center(/[a-z0-9-]+)*$'),
  dedup_key text not null check (char_length(dedup_key) between 3 and 160),
  occurrences integer not null default 1,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  required_permission text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_at timestamptz, acknowledged_by uuid,
  resolved_at timestamptz, resolved_by uuid
);
-- DEDUP: one live (not resolved) notification per key; repeats bump occurrences instead of adding rows.
create unique index if not exists cc_notifications_live_dedup_idx on public.cc_notifications (dedup_key) where status <> 'resolved';
create index if not exists cc_notifications_status_idx on public.cc_notifications (status, last_seen_at desc);

create table if not exists public.cc_notification_deliveries (
  id bigint generated always as identity primary key,
  notification_id bigint references public.cc_notifications(id),
  kind text not null default 'notification' check (kind in ('notification','verification')),
  channel text not null default 'email' check (channel = 'email'),
  status text not null default 'queued' check (status in ('queued','sending','sent','delivered','delayed','failed','bounced','suppressed')),
  attempts integer not null default 0,
  last_error text check (last_error is null or char_length(last_error) <= 60),
  payload jsonb,                       -- SERVICE ONLY (verification code + address); cleared after send; never returned to staff
  queued_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz, delivered_at timestamptz,
  provider_message_id text
);
create index if not exists cc_notification_deliveries_claim_idx on public.cc_notification_deliveries (status, next_attempt_at);

do $$ declare t text; begin
  foreach t in array array['cc_notification_settings','cc_notifications','cc_notification_deliveries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
revoke all on sequence public.cc_notifications_id_seq, public.cc_notification_deliveries_id_seq from public, anon, authenticated;

create or replace function public.cc_sev_rank(p text) returns integer language sql immutable set search_path to '' as
$$ select case p when 'info' then 1 when 'warning' then 2 when 'critical' then 3 else 0 end $$;

-- INTERNAL raise (dedup + email queue). Not callable by clients.
create or replace function public.cc_raise_notification(p_category text, p_severity text, p_dedup_key text, p_title text, p_body text,
                                                         p_ref_type text, p_ref_id text, p_link text)
 returns bigint
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_perm text; v_id bigint; v_inserted boolean; v_old_rank integer; v_set public.cc_notification_settings;
begin
  v_perm := case when p_category = 'hc_payout_needs_approval' then 'hc.payout'
                 when p_category in ('comms_failed_or_delayed','system_failure') then 'ops.read' else 'hc.read' end;
  select cc_sev_rank into v_old_rank from (select public.cc_sev_rank(severity) cc_sev_rank from public.cc_notifications where dedup_key = p_dedup_key and status <> 'resolved') x;
  insert into public.cc_notifications (category, severity, title, body, ref_type, ref_id, link, dedup_key, required_permission)
  values (p_category, p_severity, left(p_title, 120), left(p_body, 240), p_ref_type, p_ref_id, p_link, p_dedup_key, v_perm)
  on conflict (dedup_key) where status <> 'resolved' do update
     set occurrences = public.cc_notifications.occurrences + 1, last_seen_at = now(),
         severity = case when public.cc_sev_rank(excluded.severity) > public.cc_sev_rank(public.cc_notifications.severity) then excluded.severity else public.cc_notifications.severity end
  returning id, (xmax = 0) into v_id, v_inserted;
  select * into v_set from public.cc_notification_settings where singleton;
  if v_set.email_enabled and v_set.destination_status = 'verified'
     and public.cc_sev_rank(p_severity) >= public.cc_sev_rank(v_set.email_min_severity)
     and (v_inserted or public.cc_sev_rank(p_severity) > coalesce(v_old_rank, 0)) then
    insert into public.cc_notification_deliveries (notification_id) values (v_id);
  end if;
  return v_id;
end;
$function$;

create or replace function public.cc_resolve_by_dedup(p_dedup_key text)
 returns void language sql security definer set search_path to '' as
$$ update public.cc_notifications set status = 'resolved', resolved_at = now() where dedup_key = p_dedup_key and status <> 'resolved' $$;

-- ---------- triggers: events -> notifications (generic titles only) ----------
create or replace function public.cc_trg_owner_event() returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.kind = 'application_received' then
    perform public.cc_raise_notification('hc_application_received','info','hcn:app:'||new.ref_id,'New Hosting Collective application',
      'A new application is waiting for review.', new.ref_type, new.ref_id, '/command-center/hosting-collective/applications');
  elsif new.kind = 'application_possible_duplicate' then
    perform public.cc_raise_notification('hc_application_possible_duplicate','warning','hcn:dup:'||new.ref_id,'Possible duplicate application',
      'An application looks like a duplicate and needs a decision.', new.ref_type, new.ref_id, '/command-center/hosting-collective/applications');
  elsif new.kind in ('content_submitted','content_permission_revoked') then
    perform public.cc_raise_notification('hc_content_submitted', case when new.kind = 'content_submitted' then 'info' else 'warning' end,
      'hcn:content:'||new.kind||':'||new.ref_id, case when new.kind = 'content_submitted' then 'Creator content submitted' else 'Creator content permission changed' end,
      'Open the content review queue.', new.ref_type, new.ref_id, '/command-center/hosting-collective/content');
  elsif new.kind = 'member_claimed' then
    perform public.cc_raise_notification('hc_member_onboarded','info','hcn:member:'||new.ref_id,'New member signed in and started onboarding',
      'A new Hosting Collective member claimed their membership.', new.ref_type, new.ref_id, '/command-center/hosting-collective/members');
  end if;
  return new;
end $function$;
drop trigger if exists cc_owner_event_notify on public.hc_owner_notifications;
create trigger cc_owner_event_notify after insert on public.hc_owner_notifications for each row execute function public.cc_trg_owner_event();

create or replace function public.cc_trg_application_status() returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if new.status is distinct from old.status then
    if new.status = 'approved' then
      perform public.cc_raise_notification('hc_application_approved','info','hcn:approved:'||new.id,'Application approved','An application was approved.','application',new.id::text,'/command-center/hosting-collective/applications');
    elsif new.status = 'declined' then
      perform public.cc_raise_notification('hc_application_declined','info','hcn:declined:'||new.id,'Application declined','An application was declined.','application',new.id::text,'/command-center/hosting-collective/applications');
    end if;
    if new.status not in ('received','in_review') then
      perform public.cc_resolve_by_dedup('hcn:app:'||new.id); perform public.cc_resolve_by_dedup('hcn:dup:'||new.id);
    end if;
  end if;
  return new;
end $function$;
drop trigger if exists cc_application_status_notify on public.creator_applications;
create trigger cc_application_status_notify after update of status on public.creator_applications for each row execute function public.cc_trg_application_status();

create or replace function public.cc_trg_payout() returns trigger language plpgsql security definer set search_path to '' as $function$
begin
  if tg_op = 'INSERT' and new.status = 'draft' then
    perform public.cc_raise_notification('hc_payout_needs_approval','warning','hcn:payout:'||new.id,'Payout draft needs your approval',
      'A payout draft is waiting. Nothing is paid until you record an external payment.','payout',new.id::text,'/command-center/hosting-collective/payouts');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status <> 'draft' then
    perform public.cc_resolve_by_dedup('hcn:payout:'||new.id);
  end if;
  return new;
end $function$;
drop trigger if exists cc_payout_notify on public.payouts;
create trigger cc_payout_notify after insert or update of status on public.payouts for each row execute function public.cc_trg_payout();

-- Scheduled sweep (service only; scheduling is set up separately): stale reviews/approvals, comms failures/delays, purchase-grant failures.
create or replace function public.cc_sweep_notifications(p_now timestamptz default now())
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_set public.cc_notification_settings; n bigint; v_out jsonb := '{}'::jsonb;
begin
  perform public.hc_require_service();
  select * into v_set from public.cc_notification_settings where singleton;
  select count(*) into n from public.creator_applications where status in ('received','in_review') and created_at < p_now - make_interval(hours => v_set.awaiting_review_hours);
  if n > 0 then perform public.cc_raise_notification('hc_applications_awaiting_review','warning','sweep:apps_waiting','Applications are waiting for review',
      n::text || ' application(s) have waited longer than your review window.', null, null, '/command-center/hosting-collective/applications');
  else perform public.cc_resolve_by_dedup('sweep:apps_waiting'); end if;
  v_out := v_out || jsonb_build_object('apps_waiting', n);
  select count(*) into n from public.payouts where status = 'draft' and created_at < p_now - make_interval(hours => v_set.payout_approval_hours);
  if n > 0 then perform public.cc_raise_notification('hc_payout_needs_approval','warning','sweep:payouts_waiting','Payout drafts are waiting for approval',
      n::text || ' payout draft(s) have waited longer than your approval window.', null, null, '/command-center/hosting-collective/payouts');
  else perform public.cc_resolve_by_dedup('sweep:payouts_waiting'); end if;
  v_out := v_out || jsonb_build_object('payouts_waiting', n);
  if to_regclass('public.communication_deliveries') is not null then
    execute $q$select count(*) from public.communication_deliveries where status::text in ('failed','bounced') and created_at > $1 - interval '24 hours'$q$ into n using p_now;
    if n > 0 then perform public.cc_raise_notification('comms_failed_or_delayed','warning','sweep:comms_failed','Some messages failed to deliver',
        n::text || ' message(s) failed in the last 24 hours.', null, null, '/command-center/comms');
    else perform public.cc_resolve_by_dedup('sweep:comms_failed'); end if;
    v_out := v_out || jsonb_build_object('comms_failed', n);
    execute $q$select count(*) from public.communication_deliveries where status::text in ('queued','pending') and created_at < $1 - interval '1 hour'$q$ into n using p_now;
    if n > 0 then perform public.cc_raise_notification('comms_failed_or_delayed','warning','sweep:comms_delayed','Some messages are delayed',
        n::text || ' message(s) have been queued for over an hour.', null, null, '/command-center/comms');
    else perform public.cc_resolve_by_dedup('sweep:comms_delayed'); end if;
    v_out := v_out || jsonb_build_object('comms_delayed', n);
  end if;
  if to_regclass('public.entitlement_events') is not null then
    execute $q$select count(*) from public.entitlement_events where created_at > $1 - interval '24 hours' and event_type in ('grant_rejected','refund_before_grant')$q$ into n using p_now;
    if n > 0 then perform public.cc_raise_notification('system_failure','critical','sweep:grant_rejected','Purchase grants were rejected',
        n::text || ' purchase event(s) were rejected in the last 24 hours.', null, null, '/command-center/purchases');
    else perform public.cc_resolve_by_dedup('sweep:grant_rejected'); end if;
    v_out := v_out || jsonb_build_object('grant_rejected', n);
  end if;
  return v_out;
end;
$function$;

-- ---------- staff RPCs ----------
create or replace function public.cc_require_staff() returns void language plpgsql stable security definer set search_path to '' as $function$
begin if public.get_my_staff_context() is null then raise exception 'not_authorized' using errcode = 'P0001'; end if; end $function$;

create or replace function public.admin_list_notifications(p_status text default 'open', p_limit integer default 50)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  perform public.cc_require_staff();
  if p_status is not null and p_status not in ('open','acknowledged','resolved','all') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'category', n.category, 'severity', n.severity, 'title', n.title, 'body', n.body,
      'link', n.link, 'occurrences', n.occurrences, 'status', n.status, 'first_seen_at', n.first_seen_at, 'last_seen_at', n.last_seen_at,
      'acknowledged_at', n.acknowledged_at) order by public.cc_sev_rank(n.severity) desc, n.last_seen_at desc)
    from (select * from public.cc_notifications x
           where (coalesce(p_status,'open') = 'all' or x.status = coalesce(p_status,'open')) and public.staff_has_permission(x.required_permission)
           order by x.last_seen_at desc limit least(greatest(coalesce(p_limit,50),1),200)) n), '[]'::jsonb);
end $function$;

create or replace function public.admin_notification_counts()
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  perform public.cc_require_staff();
  return (select jsonb_build_object('open', count(*), 'critical', count(*) filter (where severity = 'critical'), 'warning', count(*) filter (where severity = 'warning'))
            from public.cc_notifications x where x.status = 'open' and public.staff_has_permission(x.required_permission));
end $function$;

create or replace function public.admin_set_notification_state(p_id bigint, p_state text)
 returns void language plpgsql security definer set search_path to '' as $function$
declare r public.cc_notifications;
begin
  perform public.cc_require_staff();
  if p_state not in ('acknowledged','resolved') then raise exception 'invalid_state' using errcode = 'P0001'; end if;
  select * into r from public.cc_notifications where id = p_id for update;
  if not found or not public.staff_has_permission(r.required_permission) then raise exception 'not_found' using errcode = 'P0001'; end if;
  if r.status = 'resolved' then raise exception 'already_resolved' using errcode = 'P0001'; end if;
  if p_state = 'acknowledged' then
    update public.cc_notifications set status = 'acknowledged', acknowledged_at = now(), acknowledged_by = auth.uid() where id = p_id;
  else
    update public.cc_notifications set status = 'resolved', resolved_at = now(), resolved_by = auth.uid() where id = p_id;
  end if;
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'cc.notification_' || p_state, 'cc_notification', p_id::text, jsonb_build_object('category', r.category));
end $function$;

create or replace function public.cc_mask_email(p text) returns text language sql immutable set search_path to '' as
$$ select case when p is null then null else left(split_part(p,'@',1),1) || '***@' || left(split_part(p,'@',2),1) || '***' || substr(split_part(p,'@',2), greatest(position('.' in split_part(p,'@',2)),1)) end $$;

create or replace function public.admin_get_notification_settings()
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare s public.cc_notification_settings; v_mgr boolean;
begin
  if not (public.staff_has_permission('ops.read') or public.staff_has_permission('staff.manage')) then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  v_mgr := public.staff_has_permission('staff.manage');
  select * into s from public.cc_notification_settings where singleton;
  return jsonb_build_object('destination', case when v_mgr then s.email_destination else public.cc_mask_email(s.email_destination) end,
    'destination_status', s.destination_status, 'verified_at', s.verified_at, 'email_enabled', s.email_enabled, 'email_min_severity', s.email_min_severity,
    'awaiting_review_hours', s.awaiting_review_hours, 'payout_approval_hours', s.payout_approval_hours, 'can_manage', v_mgr,
    'email_pending_count', (select count(*) from public.cc_notification_deliveries where status in ('queued','sending')));
end $function$;

create or replace function public.admin_set_notification_destination(p_email text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_email text := lower(trim(coalesce(p_email,''))); v_code text; s public.cc_notification_settings;
begin
  if not public.staff_has_permission('staff.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then raise exception 'invalid_email' using errcode = 'P0001'; end if;
  select * into s from public.cc_notification_settings where singleton for update;
  if s.verification_sent_at is not null and s.verification_sent_at > now() - interval '60 seconds' then raise exception 'too_soon' using errcode = 'P0001'; end if;
  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  update public.cc_notification_settings
     set email_destination = v_email, destination_status = 'pending_verification', email_enabled = false, verified_at = null,
         verification_code_hash = encode(sha256(convert_to(v_code, 'UTF8')), 'hex'), verification_expires_at = now() + interval '30 minutes',
         verification_sent_at = now(), verification_attempts = 0, updated_at = now(), updated_by = auth.uid()
   where singleton;
  update public.cc_notification_deliveries set payload = null, status = 'suppressed' where kind = 'verification' and status in ('queued','sending','failed');
  insert into public.cc_notification_deliveries (kind, payload) values ('verification', jsonb_build_object('to', v_email, 'code', v_code));
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'cc.notification_destination_set', 'cc_notification_settings', 'singleton', jsonb_build_object('destination', public.cc_mask_email(v_email)));
  return jsonb_build_object('status', 'pending_verification');   -- the code is NEVER returned to the browser
end $function$;

create or replace function public.admin_verify_notification_destination(p_code text)
 returns text language plpgsql security definer set search_path to '' as $function$
declare s public.cc_notification_settings;
begin
  if not public.staff_has_permission('staff.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  select * into s from public.cc_notification_settings where singleton for update;
  if s.destination_status <> 'pending_verification' then raise exception 'nothing_to_verify' using errcode = 'P0001'; end if;
  if s.verification_expires_at < now() then raise exception 'code_expired' using errcode = 'P0001'; end if;
  if s.verification_attempts >= 5 then raise exception 'too_many_attempts' using errcode = 'P0001'; end if;
  if encode(sha256(convert_to(lower(trim(coalesce(p_code,''))), 'UTF8')), 'hex') is distinct from s.verification_code_hash then
    -- returned (not raised) so the failed-attempt counter is committed; 5 wrong tries lock the code
    update public.cc_notification_settings set verification_attempts = verification_attempts + 1 where singleton;
    return 'wrong_code';
  end if;
  update public.cc_notification_settings set destination_status = 'verified', verified_at = now(), verification_code_hash = null,
     verification_expires_at = null, updated_at = now(), updated_by = auth.uid() where singleton;
  update public.cc_notification_deliveries set payload = null where kind = 'verification';
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'cc.notification_destination_verified', 'cc_notification_settings', 'singleton', '{}'::jsonb);
  return 'verified';
end $function$;

create or replace function public.admin_set_notification_email_enabled(p_enabled boolean, p_min_severity text default null)
 returns void language plpgsql security definer set search_path to '' as $function$
declare s public.cc_notification_settings;
begin
  if not public.staff_has_permission('staff.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  select * into s from public.cc_notification_settings where singleton for update;
  if p_min_severity is not null and p_min_severity not in ('info','warning','critical') then raise exception 'invalid_severity' using errcode = 'P0001'; end if;
  if p_enabled is true and s.destination_status <> 'verified' then raise exception 'destination_not_verified' using errcode = 'P0001'; end if;
  update public.cc_notification_settings set email_enabled = coalesce(p_enabled, false), email_min_severity = coalesce(p_min_severity, email_min_severity),
     updated_at = now(), updated_by = auth.uid() where singleton;
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'cc.notification_email_toggled', 'cc_notification_settings', 'singleton', jsonb_build_object('enabled', coalesce(p_enabled,false), 'min_severity', coalesce(p_min_severity, s.email_min_severity)));
end $function$;

create or replace function public.admin_set_notification_thresholds(p_awaiting_review_hours integer, p_payout_approval_hours integer)
 returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.staff_has_permission('staff.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if p_awaiting_review_hours is null or p_awaiting_review_hours not between 1 and 720 or p_payout_approval_hours is null or p_payout_approval_hours not between 1 and 720 then
    raise exception 'invalid_hours' using errcode = 'P0001'; end if;
  update public.cc_notification_settings set awaiting_review_hours = p_awaiting_review_hours, payout_approval_hours = p_payout_approval_hours, updated_at = now(), updated_by = auth.uid() where singleton;
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'cc.notification_thresholds_set', 'cc_notification_settings', 'singleton', jsonb_build_object('awaiting_review_hours', p_awaiting_review_hours, 'payout_approval_hours', p_payout_approval_hours));
end $function$;

create or replace function public.admin_list_notification_deliveries(p_status text default null, p_limit integer default 50)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
begin
  if not public.staff_has_permission('ops.read') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'kind', d.kind, 'status', d.status, 'attempts', d.attempts, 'last_error', d.last_error,
      'queued_at', d.queued_at, 'sent_at', d.sent_at, 'delivered_at', d.delivered_at, 'category', n.category, 'severity', n.severity, 'title', n.title,
      'retryable', d.status = 'failed' and d.attempts < 5) order by d.queued_at desc)
    from (select * from public.cc_notification_deliveries x where p_status is null or x.status = p_status order by x.queued_at desc limit least(greatest(coalesce(p_limit,50),1),200)) d
    left join public.cc_notifications n on n.id = d.notification_id), '[]'::jsonb);
end $function$;

create or replace function public.admin_retry_notification_delivery(p_id bigint)
 returns void language plpgsql security definer set search_path to '' as $function$
begin
  if not public.staff_has_permission('staff.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  update public.cc_notification_deliveries set status = 'queued', next_attempt_at = now(), last_error = null
   where id = p_id and status = 'failed' and attempts < 5 and kind = 'notification';
  if not found then raise exception 'not_retryable' using errcode = 'P0001'; end if;
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'cc.notification_delivery_retry', 'cc_notification_delivery', p_id::text, '{}'::jsonb);
end $function$;

create or replace function public.admin_get_notification(p_id bigint)
 returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare n public.cc_notifications;
begin
  perform public.cc_require_staff();
  select * into n from public.cc_notifications where id = p_id;
  if not found or not public.staff_has_permission(n.required_permission) then raise exception 'not_found' using errcode = 'P0001'; end if;
  return jsonb_build_object('id', n.id, 'category', n.category, 'severity', n.severity, 'title', n.title, 'body', n.body, 'link', n.link,
    'occurrences', n.occurrences, 'status', n.status, 'first_seen_at', n.first_seen_at, 'last_seen_at', n.last_seen_at, 'acknowledged_at', n.acknowledged_at, 'resolved_at', n.resolved_at,
    'deliveries', case when public.staff_has_permission('ops.read') then coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'status', d.status, 'attempts', d.attempts,
        'last_error', d.last_error, 'queued_at', d.queued_at, 'sent_at', d.sent_at, 'delivered_at', d.delivered_at) order by d.id) from public.cc_notification_deliveries d where d.notification_id = n.id), '[]'::jsonb) else null end);
end $function$;

-- ---------- dispatcher interface (service role only) ----------
create or replace function public.cc_claim_email_deliveries(p_limit integer default 10)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_set public.cc_notification_settings; v_rows jsonb;
begin
  perform public.hc_require_service();
  select * into v_set from public.cc_notification_settings where singleton;
  if v_set.email_destination is null then return '[]'::jsonb; end if;
  with c as (
    select d.id from public.cc_notification_deliveries d
     where d.status in ('queued','failed') and d.next_attempt_at <= now() and d.attempts < 5
       and (d.kind = 'verification' or (v_set.email_enabled and v_set.destination_status = 'verified'))
     order by d.queued_at limit least(greatest(coalesce(p_limit,10),1),50) for update skip locked),
  u as (update public.cc_notification_deliveries d set status = 'sending', attempts = d.attempts + 1 from c where d.id = c.id returning d.*)
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'kind', u.kind, 'to', coalesce(u.payload->>'to', v_set.email_destination), 'payload', u.payload,
      'title', n.title, 'body', n.body, 'severity', n.severity, 'link', n.link)), '[]'::jsonb) into v_rows
    from u left join public.cc_notifications n on n.id = u.notification_id;
  return v_rows;
end $function$;

create or replace function public.cc_record_delivery_result(p_id bigint, p_status text, p_provider_message_id text default null, p_error text default null)
 returns void language plpgsql security definer set search_path to '' as $function$
declare d public.cc_notification_deliveries;
begin
  perform public.hc_require_service();
  if p_status not in ('sent','delivered','delayed','failed','bounced','suppressed') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  select * into d from public.cc_notification_deliveries where id = p_id for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  update public.cc_notification_deliveries set status = p_status, provider_message_id = coalesce(left(p_provider_message_id, 120), provider_message_id),
     last_error = case when p_status = 'failed' then left(coalesce(p_error, 'failed'), 60) else null end,
     sent_at = case when p_status in ('sent','delivered') then coalesce(sent_at, now()) else sent_at end,
     delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
     next_attempt_at = case when p_status = 'failed' then now() + make_interval(mins => least(60, 5 * d.attempts * d.attempts)) else next_attempt_at end,
     payload = case when p_status in ('sent','delivered','suppressed','bounced') then null else payload end
   where id = p_id;
end $function$;

revoke execute on function public.cc_raise_notification(text, text, text, text, text, text, text, text), public.cc_resolve_by_dedup(text),
  public.cc_sweep_notifications(timestamptz), public.cc_claim_email_deliveries(integer), public.cc_record_delivery_result(bigint, text, text, text),
  public.cc_trg_owner_event(), public.cc_trg_application_status(), public.cc_trg_payout() from public, anon, authenticated;
grant execute on function public.cc_raise_notification(text, text, text, text, text, text, text, text), public.cc_resolve_by_dedup(text),
  public.cc_sweep_notifications(timestamptz), public.cc_claim_email_deliveries(integer), public.cc_record_delivery_result(bigint, text, text, text) to service_role;
revoke execute on function public.cc_require_staff(), public.admin_list_notifications(text, integer), public.admin_notification_counts(),
  public.admin_set_notification_state(bigint, text), public.admin_get_notification(bigint), public.admin_get_notification_settings(), public.admin_set_notification_destination(text),
  public.admin_verify_notification_destination(text), public.admin_set_notification_email_enabled(boolean, text), public.admin_set_notification_thresholds(integer, integer),
  public.admin_list_notification_deliveries(text, integer), public.admin_retry_notification_delivery(bigint), public.cc_sev_rank(text), public.cc_mask_email(text) from public, anon;
grant execute on function public.cc_require_staff(), public.admin_list_notifications(text, integer), public.admin_notification_counts(),
  public.admin_set_notification_state(bigint, text), public.admin_get_notification(bigint), public.admin_get_notification_settings(), public.admin_set_notification_destination(text),
  public.admin_verify_notification_destination(text), public.admin_set_notification_email_enabled(boolean, text), public.admin_set_notification_thresholds(integer, integer),
  public.admin_list_notification_deliveries(text, integer), public.admin_retry_notification_delivery(bigint), public.cc_sev_rank(text), public.cc_mask_email(text) to authenticated, service_role;
