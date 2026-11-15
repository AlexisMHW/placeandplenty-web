-- Rollback of 217230 (agent F): neither the function nor the table existed before (absent on production and QA). Audit rows in the table are discarded.
drop function if exists public.record_invitation_share_initiated(uuid, uuid, text, text);
drop table if exists public.invitation_share_events;
