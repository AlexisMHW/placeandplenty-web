-- ROLLBACK_20261114145911_CORRECTED.sql  (follow-up J; replaces ROLLBACK_20261114145911.sql. QA ONLY: DO NOT run on production, which already carried this migration)
-- D4 of REPORT_r-rehearsal: on QA, normalize_entitlement_event_source() does not exist before this step (the shipped note assumed the 20260831224800 definition existed). The trigger AND its function
-- are removed; both were created by the step. Idempotent.
drop trigger if exists trg_normalize_entitlement_event_source on public.entitlement_events;
drop function if exists public.normalize_entitlement_event_source();
