-- Rollback of 217101 (A3 217001). Run AFTER ROLLBACK_217110. Refuses if any tier has benefits (that text would be lost). Audit rows in hc_config_audit are append-only and stay.
do $$ begin
  if exists (select 1 from public.hc_tiers where jsonb_array_length(benefits) > 0) then raise exception 'rollback_refused: tiers carry benefits'; end if;
end $$;
drop function if exists public.hc_admin_list_tiers(), public.hc_admin_set_tier_benefits(text,jsonb,text), public.hc_admin_assign_tier(uuid,text,text),
  public.hc_admin_set_partner_status(uuid,text,text), public.hc_admin_terms_history();
alter table public.hc_tiers drop column if exists benefits;
