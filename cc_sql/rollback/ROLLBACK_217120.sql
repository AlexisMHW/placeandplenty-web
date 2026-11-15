-- Rollback of 217120 (agent D): restores the 217101 hc_admin_set_tier_benefits body and the 216100 hc_record_external_payment / hc_payout_transition_guard bodies exactly as in their files. No data is touched.

create or replace function public.hc_admin_set_tier_benefits(p_slug text, p_benefits jsonb, p_reason text)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
  if not public.staff_has_permission('hc.manage') then raise exception 'not_authorized' using errcode = 'P0001'; end if;
  if p_benefits is null or jsonb_typeof(p_benefits) <> 'array' or jsonb_array_length(p_benefits) > 12
     or exists (select 1 from jsonb_array_elements(p_benefits) b where jsonb_typeof(b) <> 'string' or char_length(b #>> '{}') > 120) then
    raise exception 'invalid_benefits' using errcode = 'P0001'; end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 3 and 200 then raise exception 'invalid_reason' using errcode = 'P0001'; end if;
  perform set_config('hc.audit_reason', left(btrim(p_reason), 200), true);
  update public.hc_tiers set benefits = p_benefits where slug = p_slug;
  if not found then raise exception 'tier_not_found' using errcode = 'P0001'; end if;
  return jsonb_build_object('status', 'updated');
end $function$;

create or replace function public.hc_record_external_payment(p_payout_id uuid, p_external_ref text, p_paid_on date, p_method text,
                                                              p_confirm_external_payment boolean)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare v_p public.payouts; v_ref text := btrim(coalesce(p_external_ref, ''));
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
  if char_length(v_ref) < 4 or char_length(v_ref) > 120 then raise exception 'external_reference_required' using errcode = 'P0001'; end if;
  if p_paid_on is null or p_paid_on > current_date then raise exception 'invalid_paid_on' using errcode = 'P0001'; end if;
  if exists (select 1 from public.payouts x where x.status = 'paid' and lower(btrim(x.external_ref)) = lower(v_ref)) then
    raise exception 'external_reference_already_used' using errcode = 'P0001';
  end if;
  update public.payouts set status = 'paid', paid_at = now(), paid_on = p_paid_on, external_ref = v_ref, external_method = left(btrim(p_method), 60),
         confirmed_by = auth.uid(), confirmed_at = now() where id = p_payout_id;
  update public.commissions set state = 'paid', paid_at = now(), state_changed_at = now() where payout_id = p_payout_id and state = 'payable';
  insert into public.commission_events (commission_id, from_state, to_state, reason, actor)
    select id, 'payable', 'paid', 'external_payment_recorded', 'staff:' || auth.uid()::text from public.commissions where payout_id = p_payout_id and state = 'paid';
  insert into public.payout_events (payout_id, actor, event, detail)
  values (p_payout_id, auth.uid(), 'payment_recorded', jsonb_build_object('external_ref', v_ref, 'paid_on', p_paid_on, 'method', left(btrim(p_method), 60), 'total_cents', v_p.total_cents));
  insert into public.admin_audit_log (actor_user_id, action, target_type, target_id, detail)
  values (auth.uid(), 'hc.payout_payment_recorded', 'payout', p_payout_id::text, jsonb_build_object('paid_on', p_paid_on, 'moved_money_here', false));
  return jsonb_build_object('status','paid_recorded','paid_on',p_paid_on);
end;
$function$;

create or replace function public.hc_payout_transition_guard()
 returns trigger language plpgsql set search_path to ''
as $function$
begin
  if new.partner_id is distinct from old.partner_id or new.total_cents is distinct from old.total_cents then
    raise exception 'payout_amount_and_partner_are_immutable' using errcode = 'P0001';
  end if;
  if new.status = old.status then
    if old.status in ('paid','void','reversed') and (new.external_ref is distinct from old.external_ref or new.paid_on is distinct from old.paid_on
         or new.confirmed_at is distinct from old.confirmed_at) then
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
  return new;
end;
$function$;
