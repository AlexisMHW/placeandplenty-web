-- 20261114217240_growth_funnel_summary_r1.sql   (agent F, 2026-11-14)  PROPOSED, NOT APPLIED to any database.
-- Owner decision 3: the 211001 r1 variant (staff with growth.read may call it; service_role also), plus an ADDITIVE NULLABLE column gatherings.invitations_published_at.
-- (1) Column: ALTER TABLE public.gatherings ADD COLUMN IF NOT EXISTS invitations_published_at timestamptz. Production lacks it (catalog check 2026-11-14); it is defined today only
--     by the QA-only RSVP v2 work. Nullable, no default, NO backfill (no data is invented): existing rows stay NULL. If QA's RSVP v2 already added it, IF NOT EXISTS leaves it untouched.
-- (2) Function: body and grants of 20261111211001_growth_funnel_summary_r1.sql copied faithfully. The invitation_activity metric is NOT redefined (still: invitations_published_at set,
--     OR an invitation_parties.first_share_initiated_at, OR a sent communication_events row). Read-only counts, no ids or emails, 400-day window bound, search_path ''.
-- Auth (r1): service_role OR staff_has_permission('growth.read'), else P0001 not_authorized. Needs 210000 (staff_has_permission, growth.read) which precedes this step.
-- Idempotent. Rollback: ROLLBACK_217240.sql (drops the function; drops the column only if this file added it and it holds no values).

do $mig$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'gatherings' and column_name = 'invitations_published_at') then
    alter table public.gatherings add column invitations_published_at timestamptz;
    comment on column public.gatherings.invitations_published_at is 'pp:217240:created-by-repo-migration';
  end if;
end
$mig$;

create or replace function public.growth_funnel_summary(
  p_from timestamptz,
  p_to timestamptz,
  p_include_sandbox boolean default false
) returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_result jsonb;
begin
  -- r1 (CCHC phase 2): staff with growth.read may call it as themselves; the server-side Command Center then needs no service-role key.
  if auth.role() is distinct from 'service_role' and not coalesce(public.staff_has_permission('growth.read'), false) then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'invalid_window' using errcode = 'P0001';
  end if;

  with cohort as (
    select u.id, u.created_at, u.email_confirmed_at, u.last_sign_in_at
      from auth.users u
     where u.created_at >= p_from and u.created_at < p_to
       and coalesce(u.is_anonymous, false) = false
       and u.deleted_at is null
  ), g as (
    select distinct on (ga.owner_user_id) ga.owner_user_id as uid
      from public.gatherings ga
      join cohort c on c.id = ga.owner_user_id
  ), planning as (
    select distinct ga.owner_user_id as uid
      from public.gatherings ga
      join cohort c on c.id = ga.owner_user_id
     where exists (select 1 from public.menu_items m where m.gathering_id = ga.id)
        or exists (select 1 from public.shopping_items s where s.gathering_id = ga.id and s.source is distinct from 'menu_sync')
        or exists (select 1 from public.tasks t where t.gathering_id = ga.id and (t.user_modified or t.completed_at is not null) and coalesce(t.generated_by_ai,false) = false)
        or exists (select 1 from public.gathering_guests gg where gg.gathering_id = ga.id)
  ), invite as (
    select distinct ga.owner_user_id as uid
      from public.gatherings ga
      join cohort c on c.id = ga.owner_user_id
     where ga.invitations_published_at is not null
        or exists (select 1 from public.invitation_parties ip where ip.gathering_id = ga.id and ip.first_share_initiated_at is not null)
        or exists (select 1 from public.communication_events ce where ce.gathering_id = ga.id and ce.status::text = 'sent')
  ), rsvp as (
    select distinct ga.owner_user_id as uid
      from public.gatherings ga
      join cohort c on c.id = ga.owner_user_id
      join public.gathering_guests gg on gg.gathering_id = ga.id
     where gg.rsvp_status::text in ('yes','no','maybe')
  ), paid as (
    select distinct e.user_id as uid
      from public.gathering_entitlements e
      join cohort c on c.id = e.user_id
     where e.canonical_product_id in ('gathering_pass','multi_day_pass','multi_day_extension','plus_annual')
       and e.refunded_at is null and e.revoked_at is null
       and (p_include_sandbox or coalesce(e.environment,'production') = 'production')
  ), repeat_host as (
    select ga.owner_user_id as uid
      from public.gatherings ga
      join cohort c on c.id = ga.owner_user_id
     group by ga.owner_user_id
    having count(*) >= 2
  )
  select jsonb_build_object(
    'window', jsonb_build_object('from', p_from, 'to', p_to),
    'include_sandbox', p_include_sandbox,
    'registered',            (select count(*) from cohort),
    'email_confirmed',       (select count(*) from cohort where email_confirmed_at is not null),
    'signed_in_approx',      (select count(*) from cohort where last_sign_in_at is not null),
    'gathering_created',     (select count(*) from g),
    'planning_action',       (select count(*) from planning),
    'invitation_activity',   (select count(*) from invite),
    'rsvp_received',         (select count(*) from rsvp),
    'paid_conversion',       (select count(*) from paid),
    'repeat_host',           (select count(*) from repeat_host),
    'unconfirmed_older_than_7d', (select count(*) from cohort where email_confirmed_at is null and created_at < now() - interval '7 days'),
    'confirmed_never_created_gathering_older_than_14d', (select count(*) from cohort c where c.email_confirmed_at is not null and c.created_at < now() - interval '14 days' and not exists (select 1 from g where g.uid = c.id)),
    'notes', jsonb_build_array(
      'signed_in_approx uses last_sign_in_at (overwritten on each sign-in); true first sign-in needs lifecycle_events.first_sign_in',
      'paid_conversion excludes refunded/revoked and sandbox unless p_include_sandbox',
      'paid_conversion counts entitlement rows from any provider; web-only filtering is a separate cut',
      'no ids or emails are returned; flags are counts for review, nothing is deleted or blocked')
  ) into v_result;

  return v_result;
end;
$function$;

revoke execute on function public.growth_funnel_summary(timestamptz, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.growth_funnel_summary(timestamptz, timestamptz, boolean) to authenticated, service_role;   -- r1: authenticated reaches only the staff check above
