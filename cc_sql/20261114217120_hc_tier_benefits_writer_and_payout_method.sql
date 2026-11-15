-- 20261114217120_hc_tier_benefits_writer_and_payout_method.sql   (agent D, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- D3: hc_admin_set_tier_benefits used to UPDATE public.hc_tiers directly (audited only by the table triggers). It now validates exactly as before and then
--     writes through the single tier writer public.hc_tier_write (217110), so hc_tier_write is the ONLY function that writes public.hc_tiers.
--     Signature, permission (hc.manage), error codes (not_authorized, invalid_benefits, invalid_reason, tier_not_found) and return shape ({status:'updated'}) are unchanged.
--     Every other tier field is passed through unchanged (paid_referrals_eligible included, so no owner escalation is triggered and paid referrals stay default off).
--     Audit: hc_config_audit (A7, with the reason) and hc_tier_audit (A2) triggers fire on the update inside hc_tier_write.
-- D5: payment method is validated in the database.
--     hc_record_external_payment raises invalid_method for a null / blank / placeholder ("unknown", "n/a", "none", "null", "undefined", "tbd", "?") / over-long / non-alphanumeric method.
--     The method is stored whitespace-normalised. The payout transition guard now also requires a valid method for approved -> paid (error invalid_method), in addition to
--     the existing external reference (>= 4 chars), paid_on, confirmer, confirmed_at and approver, and a recorded paid method cannot be altered afterwards.
--     draft -> approved -> paid remains the only path; paid is final. The method stays free text (the web form is free text, 2-60 chars); nothing else about payouts changes.
-- Depends on: 216100, 217101, 217110. Rollback: ROLLBACK_217120.sql (restores the 217101 and 216100 bodies exactly).
do $$ begin
  if to_regprocedure('public.hc_tier_write(text,text,text,text,integer,boolean,boolean,jsonb,boolean,text)') is null
     or to_regprocedure('public.hc_admin_set_tier_benefits(text,jsonb,text)') is null
     or to_regprocedure('public.hc_record_external_payment(uuid,text,date,text,boolean)') is null
     or to_regprocedure('public.hc_payout_transition_guard()') is null then
    raise exception 'dependency_missing: 216100, 217101 and 217110 must be applied first';
  end if;
end $$;

-- ---------- D3: benefits edits go through the one tier writer ----------
create or replace function public.hc_admin_set_tier_benefits(p_slug text, p_benefits jsonb, p_reason text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_old public.hc_tiers;
begin
  if not public.staff_has_permission('hc.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if p_benefits is null or jsonb_typeof(p_benefits) <> 'array' or jsonb_array_length(p_benefits) > 12
     or exists (select 1 from jsonb_array_elements(p_benefits) b where jsonb_typeof(b) <> 'string' or char_length(b #>> '{}') > 120) then
    raise exception 'invalid_benefits' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 200 then raise exception 'invalid_reason' using errcode = 'P0001'; end if;
  select * into v_old from public.hc_tiers where slug = p_slug for update;
  if not found then raise exception 'tier_not_found' using errcode = 'P0001'; end if;
  -- everything except benefits is passed through unchanged; hc_tier_write sets hc.audit_reason and the table audit triggers record the change
  perform public.hc_tier_write(v_old.slug, v_old.label, v_old.description, v_old.eligibility_notes, v_old.sort_order, v_old.active,
                               coalesce(v_old.paid_referrals_eligible, false), p_benefits, v_old.assignments_enabled, btrim(p_reason));
  return jsonb_build_object('status', 'updated');
end $function$;

-- ---------- D5: payment method validation (record function + transition guard) ----------
create or replace function public.hc_payout_transition_guard()
 returns trigger language plpgsql set search_path to ''
as $function$
declare v_m text;
begin
  if new.partner_id is distinct from old.partner_id or new.total_cents is distinct from old.total_cents then
    raise exception 'payout_amount_and_partner_are_immutable' using errcode = 'P0001';
  end if;
  if new.status = old.status then
    if old.status in ('paid','void','reversed') and (new.external_ref is distinct from old.external_ref or new.paid_on is distinct from old.paid_on
         or new.confirmed_at is distinct from old.confirmed_at
         or (old.external_method is not null and new.external_method is distinct from old.external_method)) then
      raise exception 'payout_record_is_final' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if not ((old.status = 'draft' and new.status in ('approved','void'))
       or (old.status = 'approved' and new.status in ('paid','void'))
       or (old.status = 'paid' and new.status = 'reversed')) then
    raise exception 'illegal_payout_transition: % -> %', old.status, new.status using errcode = 'P0001';
  end if;
  if new.status = 'paid' and (new.confirmed_at is null or new.confirmed_by is null or nullif(btrim(new.external_ref), '') is null
        or char_length(btrim(new.external_ref)) < 4 or new.paid_on is null or new.approved_at is null) then
    raise exception 'external_payment_confirmation_required' using errcode = 'P0001';
  end if;
  if new.status = 'paid' then
    v_m := btrim(regexp_replace(coalesce(new.external_method, ''), '\s+', ' ', 'g'));
    if char_length(v_m) not between 2 and 60 or v_m !~ '[[:alnum:]]' or v_m ~ '[[:cntrl:]]'
       or lower(v_m) in ('unknown', 'n/a', 'na', 'none', 'null', 'undefined', 'tbd', '?') then
      raise exception 'invalid_method' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.hc_record_external_payment(p_payout_id uuid, p_external_ref text, p_paid_on date, p_method text,
                                                              p_confirm_external_payment boolean)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_p public.payouts; v_ref text := btrim(coalesce(p_external_ref, '')); v_m text := btrim(regexp_replace(coalesce(p_method, ''), '\s+', ' ', 'g'));
begin
  if not public.staff_has_permission('hc.payout') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  select * into v_p from public.payouts where id = p_payout_id for update;
  if not found then raise exception 'payout_not_found' using errcode = 'P0001'; end if;
  if v_p.status = 'paid' then
    if lower(btrim(coalesce(v_p.external_ref, ''))) = lower(v_ref) then return jsonb_build_object('status','already_recorded'); end if;
    raise exception 'payout_already_paid_with_different_reference' using errcode = 'P0001';
  end if;
  if v_p.status <> 'approved' then raise exception 'payout_not_approved' using errcode = 'P0001'; end if;
  if p_confirm_external_payment is distinct from true then raise exception 'confirmation_required' using errcode = 'P0001'; end if;
  if char_length(v_m) not between 2 and 60 or v_m !~ '[[:alnum:]]' or v_m ~ '[[:cntrl:]]'
     or lower(v_m) in ('unknown', 'n/a', 'na', 'none', 'null', 'undefined', 'tbd', '?') then
    raise exception 'invalid_method' using errcode = 'P0001';
  end if;
  if char_length(v_ref) < 4 or char_length(v_ref) > 120 then raise exception 'external_reference_required' using errcode = 'P0001'; end if;
  if p_paid_on is null or p_paid_on > current_date then raise exception 'invalid_paid_on' using errcode = 'P0001'; end if;
  if exists (select 1 from public.payouts x where x.status = 'paid' and lower(btrim(x.external_ref)) = lower(v_ref)) then
    raise exception 'external_reference_already_used' using errcode = 'P0001';
  end if;
  update public.payouts set status = 'paid', paid_at = now(), paid_on = p_paid_on, external_ref = v_ref, external_method = v_m,
         confirmed_by = auth.uid(), confirmed_at = now() where id = p_payout_id;
  update public.commissions set state = 'paid', paid_at = now(), state_changed_at = now() where payout_id = p_payout_id and state = 'payable';
  insert into public.commission_events (commission_id, from_state, to_state, reason, actor)
    select id, 'payable', 'paid', 'external_payment_recorded', 'staff:' || auth.uid()::text from public.commissions where payout_id = p_payout_id and state = 'paid';
  insert into public.payout_events (payout_id, actor, event, detail)
  values (p_payout_id, auth.uid(), 'payment_recorded', jsonb_build_object('external_ref', v_ref, 'paid_on', p_paid_on, 'method', v_m, 'total_cents', v_p.total_cents));
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.payout_payment_recorded', 'payout', p_payout_id::text, jsonb_build_object('paid_on', p_paid_on, 'moved_money_here', false));
  return jsonb_build_object('status','paid_recorded','paid_on',p_paid_on);
end;
$function$;
