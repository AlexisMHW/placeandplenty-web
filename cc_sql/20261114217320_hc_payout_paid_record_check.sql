-- 20261114217320_hc_payout_paid_record_check.sql   (agent S, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- E-D1 (MEDIUM): a PAID payout row with a null external reference could be INSERTED (the transition guard was BEFORE UPDATE only; verifier D8, service_role).
--   1. CHECK payouts_paid_requires_record_chk: status <> 'paid' OR (external_ref >= 3 chars after trim AND paid_on AND external_method AND confirmed_by all present).
--      Added NOT VALID, then VALIDATEd only if every existing row passes (otherwise it stays NOT VALID: it still binds every new insert and update, and a notice says so).
--   2. hc_payout_transition_guard() now also runs BEFORE INSERT (trigger payouts_insert_guard): an inserted row with status 'paid' must carry the same confirmation
--      the approved -> paid transition requires (external_payment_confirmation_required / invalid_method). Inserting draft rows (the normal path) is unaffected.
--      The existing BEFORE UPDATE behaviour is byte-for-byte unchanged. draft -> approved -> paid stays the only path; paid stays final.
-- Rollback: ROLLBACK_217320.sql (drops the check and the insert trigger, restores the 217120 guard body). No data is touched.
do $$ begin
  if to_regprocedure('public.hc_payout_transition_guard()') is null or to_regclass('public.payouts') is null then
    raise exception 'dependency_missing: 216100 / 217120 must be applied first';
  end if;
end $$;

create or replace function public.hc_payout_transition_guard()
 returns trigger language plpgsql set search_path to '' as $function$
declare v_m text;
begin
  if tg_op = 'INSERT' then
    -- 217320 (E-D1): no row may be born 'paid' without the full external-payment record.
    if new.status = 'paid' then
      if new.confirmed_at is null or new.confirmed_by is null or nullif(btrim(new.external_ref), '') is null
         or char_length(btrim(new.external_ref)) < 4 or new.paid_on is null or new.approved_at is null then
        raise exception 'external_payment_confirmation_required' using errcode = 'P0001';
      end if;
      v_m := btrim(regexp_replace(coalesce(new.external_method, ''), '\s+', ' ', 'g'));
      if char_length(v_m) not between 2 and 60 or v_m !~ '[[:alnum:]]' or v_m ~ '[[:cntrl:]]'
         or lower(v_m) in ('unknown', 'n/a', 'na', 'none', 'null', 'undefined', 'tbd', '?') then
        raise exception 'invalid_method' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;
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

drop trigger if exists payouts_insert_guard on public.payouts;
create trigger payouts_insert_guard before insert on public.payouts for each row execute function public.hc_payout_transition_guard();

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.payouts'::regclass and conname = 'payouts_paid_requires_record_chk') then
    alter table public.payouts add constraint payouts_paid_requires_record_chk
      check (status <> 'paid' or (external_ref is not null and char_length(btrim(external_ref)) >= 3 and paid_on is not null
                                  and external_method is not null and char_length(btrim(external_method)) >= 1 and confirmed_by is not null)) not valid;
  end if;
  if exists (select 1 from pg_constraint where conrelid = 'public.payouts'::regclass and conname = 'payouts_paid_requires_record_chk' and not convalidated) then
    if exists (select 1 from public.payouts where not (status <> 'paid' or (external_ref is not null and char_length(btrim(external_ref)) >= 3 and paid_on is not null
                                  and external_method is not null and char_length(btrim(external_method)) >= 1 and confirmed_by is not null))) then
      raise notice 'payouts_paid_requires_record_chk left NOT VALID: existing paid rows do not all carry the full record (new rows are still checked)';
    else
      alter table public.payouts validate constraint payouts_paid_requires_record_chk;
    end if;
  end if;
end $$;
