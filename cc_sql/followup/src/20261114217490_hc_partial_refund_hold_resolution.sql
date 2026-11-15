-- 20261114217490_hc_partial_refund_hold_resolution.sql   (agent J follow-up, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- FOLLOW-UP PACKAGE (supabase/qa_package/followup, FOLLOWUP_ORDER.tsv): applies AFTER the reviewed 61-step main package; the main package files are NOT edited.
-- PROBLEM: a commission held with reason 'partial_refund_review' (217470 / record_purchase_partial_refund) had NO release path, and the sweep re-held anything whose purchase facts
-- carry partial_refund_flagged_at, so even a manual change was undone by the next sweep. This adds an OWNER-CONTROLLED resolution.
-- NEW OBJECTS
--   table  public.hc_partial_refund_resolutions   append-only history of owner decisions (resolution 'release' | 'reverse', required note, who, when, and the refunded amount
--                                                 that was reviewed). No API grants (service_role SELECT only). No update / delete / truncate.
--   fn     public.hc_resolve_partial_refund_hold(p_commission_id uuid, p_resolution text, p_note text, p_confirm boolean)  OWNER ONLY (hc_is_owner(), else owner_required)
--            release: held / partial_refund_review -> pending / partial_refund_released, and from there the NORMAL path: the sweep validates it only once its ORIGINAL
--                     validate_after (purchase + 45 days) has elapsed; payable only through the normal owner-only draft / approve / record. Nothing is paid early.
--                     Refused (explicit error, nothing changed) when: open dispute (dispute_open), lost dispute (dispute_lost), full refund (fully_refunded), entitlement revoked for any
--                     reason other than ordinary subscription cancellation (entitlement_not_valid), commission already in a payout (commission_in_payout: payable / paid -
--                     the owner must use the existing payout controls: void / reverse / settle clawback).
--            reverse: held / partial_refund_review -> reversed / partial_refund_reversed. TERMINAL (no function revives a reversed commission). No money moves; clawback stays 0.
--            idempotent / replay-safe: the same resolution again returns already_resolved and changes nothing; the opposite resolution after the fact raises already_resolved_differently.
--            audited: one commission_events row (actor 'staff:<uid>') + one admin_audit_log row ('hc.partial_refund_hold_resolved') carrying the note; the note is also stored in the history table.
--   fn     public.hc_admin_list_partial_refund_holds(p_limit integer default 100)  VIEW for hc.payout (owner or any staff holding the explicit financial permission): the held commissions,
--            the reason a release would be refused (release_blocker), can_release, and the recent resolutions.
--   fn     public.hc_partial_refund_open(uuid)  internal predicate (no API grants): the purchase carries a partial-refund flag that the owner has NOT released at (or above) the refunded amount now on record.
--   fn     public.hc_partial_refund_release_blocker(uuid)  internal: first reason a release must be refused for this entitlement, or null.
-- CHANGED (CREATE OR REPLACE; every other line is byte-for-byte the 217470 body)
--   hc_sweep_commissions_core(timestamptz): steps 1c / 2b / 3 use hc_partial_refund_open() instead of "partial_refund_flagged_at is not null". Result: after a release the sweep does NOT re-hold it and
--       validates it on the normal schedule; a still-unresolved flag behaves exactly as before.
--   hc_commission_blocked(uuid): same substitution (a released commission is payable via the normal path; an unresolved one stays blocked from draft / approve / record).
--   record_purchase_partial_refund(text,integer): replay-safe after a release (same or smaller refunded amount => no re-hold, status already_resolved_released). A LARGER refunded amount than the one the owner
--       reviewed is new information and is held for review again (the owner can resolve it again).
--   hc_commission_maintenance / reconcile_commission_for_entitlement are unchanged (maintenance runs the sweep; reconcile only creates new rows, which cannot have a resolution).
-- NOT changed: amounts (Plus annual 1200c, Gathering Pass 50c), 30-day attribution, 45-day hold, $50 minimum, no renewal/upgrade commission, no automatic discount, exclusions, owner-only payout
--   approve / record / void / reverse / settle, no retroactive accrual, paid referrals default OFF, SMS. GATE 8 PREREQUISITE: paid referrals must not be enabled until this follow-up is applied and verified.
-- Idempotent. Rollback: ROLLBACK_217490.sql (restores the four pre-state bodies exactly, drops the new objects; refuses to drop the history table if it holds rows unless app.hc_followup_rollback_discard_history = 'yes').
-- Depends on: 217300, 217430 (hc_is_owner), 217440, 217470.

do $$ begin
  if to_regprocedure('public.hc_sweep_commissions_core(timestamptz)') is null or to_regprocedure('public.hc_commission_blocked(uuid)') is null
     or to_regprocedure('public.record_purchase_partial_refund(text,integer)') is null or to_regprocedure('public.hc_is_owner()') is null
     or to_regprocedure('public.hc_append_only_guard()') is null or to_regprocedure('public.hc_log_event(uuid,text,text,text,text)') is null then
    raise exception 'dependency_missing: 217300 / 217430 (hc_is_owner) / 217440 / 217470 must be applied first';
  end if;
  if to_regprocedure('public.hc_partial_refund_open(uuid)') is null
     and position('partial_refund_flagged_at' in pg_get_functiondef('public.hc_sweep_commissions_core(timestamptz)'::regprocedure)) = 0 then
    raise exception 'dependency_missing: hc_sweep_commissions_core is not the 217470 body';
  end if;
end $$;

create table if not exists public.hc_partial_refund_resolutions (
  id bigint generated always as identity primary key,
  commission_id uuid not null references public.commissions(id),
  entitlement_id uuid not null,
  resolution text not null check (resolution in ('release','reverse')),
  note text not null check (char_length(btrim(note)) >= 3),
  resolved_by uuid not null,
  resolved_at timestamptz not null default now(),
  refunded_cents_at_resolution integer not null default 0,
  from_state text not null,
  to_state text not null
);
create index if not exists hc_partial_refund_resolutions_commission_idx on public.hc_partial_refund_resolutions (commission_id, id desc);
alter table public.hc_partial_refund_resolutions enable row level security;
revoke all on public.hc_partial_refund_resolutions from public, anon, authenticated;
grant select on public.hc_partial_refund_resolutions to service_role;
revoke all on sequence public.hc_partial_refund_resolutions_id_seq from public, anon, authenticated;
drop trigger if exists hc_partial_refund_resolutions_append_only on public.hc_partial_refund_resolutions;
create trigger hc_partial_refund_resolutions_append_only before update or delete on public.hc_partial_refund_resolutions
  for each row execute function public.hc_append_only_guard();
drop trigger if exists hc_partial_refund_resolutions_no_truncate on public.hc_partial_refund_resolutions;
create trigger hc_partial_refund_resolutions_no_truncate before truncate on public.hc_partial_refund_resolutions
  for each statement execute function public.hc_append_only_guard();

-- internal predicate: the purchase carries a partial-refund flag the owner has NOT released at (or above) the refunded amount now on record
create or replace function public.hc_partial_refund_open(p_entitlement_id uuid)
 returns boolean language sql stable security definer set search_path to ''
as $function$
  select coalesce((
    select f.partial_refund_flagged_at is not null
       and not exists (
         select 1 from public.hc_partial_refund_resolutions r join public.commissions c on c.id = r.commission_id
          where c.entitlement_id = p_entitlement_id and r.resolution = 'release'
            and r.id = (select max(r2.id) from public.hc_partial_refund_resolutions r2 where r2.commission_id = r.commission_id)
            and r.refunded_cents_at_resolution >= coalesce(f.refunded_cents, 0))
      from public.commission_purchase_facts f where f.entitlement_id = p_entitlement_id), false);
$function$;

-- internal: the first reason a RELEASE must be refused for this entitlement (null = none)
create or replace function public.hc_partial_refund_release_blocker(p_entitlement_id uuid)
 returns text language sql stable security definer set search_path to ''
as $function$
  select case
    when e.id is null then 'entitlement_not_found'
    when e.refunded_at is not null then 'fully_refunded'
    when f.dispute_status = 'open' or (e.revoked_at is not null and e.revoked_reason = 'dispute_open') then 'dispute_open'
    when f.dispute_status = 'lost' or (e.revoked_at is not null and e.revoked_reason = 'dispute_lost') then 'dispute_lost'
    when e.revoked_at is not null and coalesce(e.revoked_reason, '') <> 'subscription_deleted' then 'entitlement_not_valid'
    else null end
  from (select 1) one
  left join public.gathering_entitlements e on e.id = p_entitlement_id
  left join public.commission_purchase_facts f on f.entitlement_id = p_entitlement_id;
$function$;

create or replace function public.hc_resolve_partial_refund_hold(p_commission_id uuid, p_resolution text, p_note text, p_confirm boolean)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
  c public.commissions; f public.commission_purchase_facts; v_last public.hc_partial_refund_resolutions;
  v_note text := btrim(coalesce(p_note, '')); v_blocker text; v_to text; v_reason text; v_actor text;
begin
  if not public.hc_is_owner() then raise exception 'owner_required' using errcode = 'P0001'; end if;   -- owner only: hc.payout alone (view) is refused
  if p_resolution is null or p_resolution not in ('release','reverse') then raise exception 'invalid_resolution' using errcode = 'P0001'; end if;
  if p_confirm is distinct from true then raise exception 'confirmation_required' using errcode = 'P0001'; end if;
  if char_length(v_note) < 3 then raise exception 'note_required' using errcode = 'P0001'; end if;
  select * into c from public.commissions where id = p_commission_id for update;
  if not found then raise exception 'commission_not_found' using errcode = 'P0001'; end if;
  -- a commission already in a payout (payable = draft / approved batch, paid) is never resolved here, whatever was decided before: explicit error, the owner uses the existing payout controls
  if c.state in ('payable','paid') then raise exception 'commission_in_payout' using errcode = 'P0001'; end if;
  select * into v_last from public.hc_partial_refund_resolutions where commission_id = c.id order by id desc limit 1;
  -- idempotent / replay-safe: a decision already taken is reported, never applied twice
  if found and not (c.state = 'held' and c.reason = 'partial_refund_review') then
    if v_last.resolution = p_resolution then
      return jsonb_build_object('status','already_resolved','resolution',v_last.resolution,'state',c.state,'commission_id',c.id);
    end if;
    raise exception 'already_resolved_differently' using errcode = 'P0001';
  end if;
  if not (c.state = 'held' and c.reason = 'partial_refund_review') then raise exception 'not_held_for_partial_refund' using errcode = 'P0001'; end if;
  if c.payout_id is not null then raise exception 'commission_in_payout' using errcode = 'P0001'; end if;
  select * into f from public.commission_purchase_facts where entitlement_id = c.entitlement_id;
  v_actor := 'staff:' || auth.uid()::text;

  if p_resolution = 'release' then
    v_blocker := public.hc_partial_refund_release_blocker(c.entitlement_id);
    if v_blocker is not null then raise exception '%', v_blocker using errcode = 'P0001'; end if;   -- dispute_open | dispute_lost | fully_refunded | entitlement_not_valid
    v_to := 'pending'; v_reason := 'partial_refund_released';
  else
    v_to := 'reversed'; v_reason := 'partial_refund_reversed';
  end if;

  update public.commissions set state = v_to, reason = v_reason, state_changed_at = now() where id = c.id;
  insert into public.hc_partial_refund_resolutions (commission_id, entitlement_id, resolution, note, resolved_by, refunded_cents_at_resolution, from_state, to_state)
  values (c.id, c.entitlement_id, p_resolution, left(v_note, 500), auth.uid(), coalesce(f.refunded_cents, 0), c.state, v_to);
  perform public.hc_log_event(c.id, c.state, v_to, v_reason, v_actor);
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.partial_refund_hold_resolved', 'commission', c.id::text,
          jsonb_build_object('resolution', p_resolution, 'note', left(v_note, 500), 'to_state', v_to, 'commission_cents', c.commission_cents,
                             'refunded_cents', coalesce(f.refunded_cents, 0), 'moved_money_here', false));
  return jsonb_build_object('status', case when p_resolution = 'release' then 'released' else 'reversed' end, 'resolution', p_resolution,
                            'state', v_to, 'commission_id', c.id, 'validate_after', c.validate_after);
end;
$function$;

create or replace function public.hc_admin_list_partial_refund_holds(p_limit integer default 100)
 returns jsonb language plpgsql stable security definer set search_path to ''
as $function$
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;   -- VIEW: owner or staff holding the explicit financial permission
  return jsonb_build_object(
    'holds', coalesce((select jsonb_agg(x order by x.state_changed_at) from (
        select c.id as commission_id, c.partner_id, p.display_name, c.canonical_product_id, c.commission_cents, c.base_amount_cents, c.purchased_at, c.validate_after,
               c.state_changed_at, c.payout_id, f.refunded_cents, f.partial_refund_flagged_at, f.dispute_status,
               public.hc_partial_refund_release_blocker(c.entitlement_id) as release_blocker,
               (c.payout_id is null and public.hc_partial_refund_release_blocker(c.entitlement_id) is null) as can_release
          from public.commissions c
          join public.partners p on p.id = c.partner_id
          left join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
         where c.state = 'held' and c.reason = 'partial_refund_review'
         order by c.state_changed_at limit least(greatest(coalesce(p_limit, 100), 1), 500)) x), '[]'::jsonb),
    'recent_resolutions', coalesce((select jsonb_agg(y order by y.resolved_at desc) from (
        select r.commission_id, r.resolution, r.note, r.resolved_by, r.resolved_at, r.refunded_cents_at_resolution, r.to_state
          from public.hc_partial_refund_resolutions r order by r.id desc limit 20) y), '[]'::jsonb));
end;
$function$;

CREATE OR REPLACE FUNCTION public.hc_sweep_commissions_core(p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  r record; v_set public.hc_settings; v_rev int := 0; v_val int := 0; v_held int := 0; v_rel int := 0;
begin
  select * into v_set from public.hc_settings where singleton;
  if not v_set.enabled then return jsonb_build_object('status','disabled'); end if;

  -- 1. reversals: refunded, revoked for a reason other than ordinary cancellation or an OPEN dispute (217470), or dispute lost
  for r in
    select c.id, c.state, c.commission_cents, c.payout_id, c.partner_id
      from public.commissions c
      join public.gathering_entitlements e on e.id = c.entitlement_id
      left join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where c.state in ('pending','held','validated','payable','paid')
       and (e.refunded_at is not null
            or (e.revoked_at is not null and coalesce(e.revoked_reason,'') not in ('subscription_deleted','dispute_open'))   -- 217470: 'dispute_open' is a HOLD (steps 1b/2), not a reversal
            or f.dispute_status = 'lost')
     for update of c
  loop
    update public.commissions
       set state = 'reversed', state_changed_at = p_now, reason = 'refund_or_dispute',
           clawback_cents = case when r.state = 'paid' then coalesce(r.commission_cents,0) else 0 end,
           clawback_status = case when r.state = 'paid' then 'pending_contract_language' else null end
     where id = r.id;
    perform public.hc_log_event(r.id, r.state, 'reversed', 'refund_or_dispute', 'system');
    if r.state = 'payable' and r.payout_id is not null then
      update public.payouts set status = 'void', void_reason = 'contains_reversed_commission' where id = r.payout_id and status in ('draft','approved');
      update public.commissions set state = 'validated', payout_id = null, state_changed_at = p_now
       where payout_id = r.payout_id and state = 'payable' and id <> r.id;
      update public.commissions set clawback_payout_id = null where clawback_payout_id = r.payout_id;
    end if;
    v_rev := v_rev + 1;
  end loop;

  -- 1b. (214003_r1) dispute opened on a commission already inside a draft/approved payout: void that batch so nothing is paid
  --     while the dispute is open; the owner rebuilds the draft later. Commissions already PAID are handled by the clawback model.
  for r in
    select c.id, c.payout_id from public.commissions c
      join public.gathering_entitlements e on e.id = c.entitlement_id
      left join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where (f.dispute_status = 'open' or (e.revoked_at is not null and e.revoked_reason = 'dispute_open')) and c.state = 'payable' for update of c
  loop
    update public.payouts set status = 'void', void_reason = 'contains_disputed_commission' where id = r.payout_id and status in ('draft','approved');
    update public.commissions set state = 'validated', payout_id = null, state_changed_at = p_now where payout_id = r.payout_id and state = 'payable';
    update public.commissions set clawback_payout_id = null where clawback_payout_id = r.payout_id;
  end loop;

  -- 1c. (217470, DEF-2) partial refund recorded on a commission already inside a draft/approved payout: void that batch so nothing is paid until the review is
  --     resolved; the commission returns to validated and is held below. Commissions already PAID keep the flag-only semantics of record_purchase_partial_refund.
  for r in
    select c.id, c.payout_id from public.commissions c join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where public.hc_partial_refund_open(c.entitlement_id) and c.state = 'payable' for update of c
  loop
    update public.payouts set status = 'void', void_reason = 'contains_partially_refunded_commission' where id = r.payout_id and status in ('draft','approved');
    update public.commissions set state = 'validated', payout_id = null, state_changed_at = p_now where payout_id = r.payout_id and state = 'payable';
    update public.commissions set clawback_payout_id = null where clawback_payout_id = r.payout_id;
  end loop;

  -- 2. dispute opened: freeze (HOLD, never reverse). dispute won: release if the only reason was the dispute. (217470) An open dispute is visible two ways and both hold:
  --    the purchase facts (dispute_status 'open') and the entitlement itself (revoked_at set with revoked_reason 'dispute_open', which is how the payment ledger takes access
  --    away while a dispute is open).
  for r in
    select c.id, c.state from public.commissions c
      join public.gathering_entitlements e on e.id = c.entitlement_id
      left join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where (f.dispute_status = 'open' or (e.revoked_at is not null and e.revoked_reason = 'dispute_open')) and c.state in ('pending','validated') for update of c
  loop
    update public.commissions set state = 'held', reason = 'dispute_open', state_changed_at = p_now where id = r.id;
    perform public.hc_log_event(r.id, r.state, 'held', 'dispute_open', 'system'); v_held := v_held + 1;
  end loop;
  -- release: the dispute is no longer open (won, or closed with no loss), the entitlement is no longer revoked for it, and nothing else holds the commission.
  -- The commission continues through the NORMAL path: pending, then validated once its original 45-day validate_after has elapsed (step 3). Lost / refunded never reach here (step 1).
  for r in
    select c.id from public.commissions c
      join public.gathering_entitlements e on e.id = c.entitlement_id
      left join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where c.state = 'held' and c.reason = 'dispute_open'
       and coalesce(f.dispute_status,'none') in ('won','none')
       and not (e.revoked_at is not null and e.revoked_reason = 'dispute_open')
     for update of c
  loop
    update public.commissions set state = 'pending', reason = 'dispute_won', state_changed_at = p_now where id = r.id;
    perform public.hc_log_event(r.id, 'held', 'pending', 'dispute_won', 'system'); v_rel := v_rel + 1;
  end loop;
  -- 2b. (217470, DEF-2) a partially refunded purchase (record_purchase_partial_refund set partial_refund_flagged_at) must not validate until resolved: hold it for review.
  --     (217490) 'Unresolved' = hc_partial_refund_open(): flagged AND not released by the owner at (or above) the refunded amount recorded now.
  --     Also catches a commission created or released AFTER the partial refund was recorded. There is no automatic release: an owner/staff decision resolves it.
  for r in
    select c.id, c.state from public.commissions c join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
     where public.hc_partial_refund_open(c.entitlement_id) and c.state in ('pending','validated') for update of c
  loop
    update public.commissions set state = 'held', reason = 'partial_refund_review', state_changed_at = p_now where id = r.id;
    perform public.hc_log_event(r.id, r.state, 'held', 'partial_refund_review', 'system'); v_held := v_held + 1;
  end loop;

  -- 3. validation: the SNAPSHOT hold has elapsed, no dispute (open or lost), not refunded, no partial refund under review. The processor fee is no longer needed.
  for r in
    select c.id from public.commissions c
      join public.commission_purchase_facts f on f.entitlement_id = c.entitlement_id
      join public.gathering_entitlements e on e.id = c.entitlement_id
     where c.state = 'pending' and c.validate_after <= p_now and c.commission_cents is not null
       and f.dispute_status in ('none','won') and e.refunded_at is null
       and not (e.revoked_at is not null and e.revoked_reason = 'dispute_open')
       and not public.hc_partial_refund_open(c.entitlement_id)   -- 217490: a partial refund the owner has RELEASED (hc_resolve_partial_refund_hold) no longer blocks
     for update of c
  loop
    update public.commissions set state = 'validated', reason = null, state_changed_at = p_now where id = r.id;
    perform public.hc_log_event(r.id, 'pending', 'validated', 'validation_period_elapsed', 'system'); v_val := v_val + 1;
  end loop;

  return jsonb_build_object('status','ok','reversed',v_rev,'validated',v_val,'held',v_held,'released',v_rel);
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_purchase_partial_refund(p_provider_transaction_id text, p_refunded_cents integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare f public.commission_purchase_facts; c public.commissions; v_amt integer;
begin
  perform public.hc_require_service();
  if p_refunded_cents is null or p_refunded_cents <= 0 then raise exception 'invalid_amount' using errcode = 'P0001'; end if;
  -- 217440 (E-PLUS): exact match first (Gathering Pass = PaymentIntent), then the existing payment linkage (Plus facts are keyed by the subscription id).
  select * into f from public.commission_purchase_facts
   where entitlement_id in (select r.entitlement_id from public.resolve_purchase_fact_entitlements(p_provider_transaction_id) r)
   order by (provider_transaction_id = p_provider_transaction_id) desc, recorded_at limit 1 for update;
  if not found then return jsonb_build_object('status','no_facts'); end if;
  update public.commission_purchase_facts
     set refunded_cents = greatest(coalesce(refunded_cents,0), p_refunded_cents), partial_refund_flagged_at = coalesce(partial_refund_flagged_at, now()), updated_at = now()
   where entitlement_id = f.entitlement_id;
  select * into c from public.commissions where entitlement_id = f.entitlement_id for update;
  if not found then return jsonb_build_object('status','recorded_no_commission'); end if;
  v_amt := greatest(coalesce(f.refunded_cents,0), p_refunded_cents);
  -- 217490: replay-safe after an owner RELEASE. The same (or a smaller) partial refund seen again (webhook replay / reordering) must not re-hold a released commission.
  -- A LARGER refunded amount than the one the owner reviewed is new information: it is held for review again (below).
  if c.state in ('pending','validated') and exists (
       select 1 from public.hc_partial_refund_resolutions r
        where r.commission_id = c.id and r.resolution = 'release'
          and r.id = (select max(r2.id) from public.hc_partial_refund_resolutions r2 where r2.commission_id = c.id)
          and r.refunded_cents_at_resolution >= v_amt) then
    return jsonb_build_object('status','already_resolved_released','state',c.state);
  end if;
  if c.state in ('pending','validated') then
    update public.commissions set state = 'held', reason = 'partial_refund_review', state_changed_at = now() where id = c.id;
    perform public.hc_log_event(c.id, c.state, 'held', 'partial_refund_review', 'system');
    return jsonb_build_object('status','held_for_review');
  end if;
  perform public.hc_log_event(c.id, c.state, c.state, 'partial_refund_review_flag', 'system');
  return jsonb_build_object('status','flagged','state',c.state);
end;
$function$;

CREATE OR REPLACE FUNCTION public.hc_commission_blocked(p_entitlement_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- same predicate the sweep uses to reverse (refunded, revoked for a reason other than ordinary cancellation, dispute lost) or hold (dispute open, partial refund under review)
  select exists (
    select 1 from public.gathering_entitlements e
      left join public.commission_purchase_facts f on f.entitlement_id = e.id
     where e.id = p_entitlement_id
       and (e.refunded_at is not null
            or (e.revoked_at is not null and coalesce(e.revoked_reason,'') <> 'subscription_deleted')
            or f.dispute_status in ('open','lost')
            or public.hc_partial_refund_open(e.id)));   -- 217470/217490: a partially refunded purchase under review is not payable either (unless the owner released it)
$function$;

-- grants: internal helpers are not API-callable; the two admin functions are for signed-in staff (the function bodies enforce owner / hc.payout)
revoke all on function public.hc_partial_refund_open(uuid) from public, anon, authenticated;
revoke all on function public.hc_partial_refund_release_blocker(uuid) from public, anon, authenticated;
revoke all on function public.hc_resolve_partial_refund_hold(uuid,text,text,boolean) from public, anon;
grant execute on function public.hc_resolve_partial_refund_hold(uuid,text,text,boolean) to authenticated, service_role;
revoke all on function public.hc_admin_list_partial_refund_holds(integer) from public, anon;
grant execute on function public.hc_admin_list_partial_refund_holds(integer) to authenticated, service_role;
revoke all on function public.hc_commission_blocked(uuid) from public, anon, authenticated;
revoke all on function public.hc_sweep_commissions_core(timestamptz) from public, anon, authenticated;
