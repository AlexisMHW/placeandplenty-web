-- Rollback of 217320 (agent S): drops the paid-record CHECK and the BEFORE INSERT guard trigger and restores the 217120 hc_payout_transition_guard body exactly. No data is touched.
drop trigger if exists payouts_insert_guard on public.payouts;
alter table public.payouts drop constraint if exists payouts_paid_requires_record_chk;
CREATE OR REPLACE FUNCTION public.hc_payout_transition_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
