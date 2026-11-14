-- ROLLBACK for 20261114215003. Drops only objects created by it. Event + tier-audit history is LOST. Run only on a database where 215003 was applied.
drop trigger if exists hc_assignment_guard on public.hc_content_assignments;
drop trigger if exists hc_payout_event on public.payouts;
drop trigger if exists hc_tier_audit_trg on public.hc_tiers;
drop trigger if exists hc_partner_change on public.partners;
drop trigger if exists hc_application_status_event on public.creator_applications;
drop trigger if exists hc_owner_notification_event on public.hc_owner_notifications;
drop table if exists public.hc_event_deliveries, public.hc_notification_destinations, public.hc_events, public.hc_tier_audit;
drop function if exists public.hc_emit_awaiting_review(integer), public.hc_record_delivery_result(bigint, text, text, text),
  public.hc_delivery_recipient(bigint), public.hc_claim_deliveries(integer, text), public.hc_mark_destination_verified(uuid),
  public.hc_admin_set_destination_active(uuid, boolean), public.hc_admin_add_destination(text, text), public.hc_admin_list_destinations(),
  public.hc_admin_delivery_health(), public.hc_admin_ack_event(bigint), public.hc_admin_list_events(boolean, integer),
  public.creator_withdraw_application(), public.creator_program_status(), public.hc_my_application_id(),
  public.hc_partner_referral_eligible(uuid), public.hc_partner_referral_state(uuid), public.hc_admin_tier_audit(integer), public.hc_admin_set_member_tier(uuid, text),
  public.hc_admin_upsert_tier(text, text, text, text, jsonb, boolean, boolean, integer, boolean), public.hc_admin_list_tiers(),
  public.hc_tg_assignment_guard(), public.hc_tg_payout_event(), public.hc_tg_tier_audit(), public.hc_tg_partner_change(),
  public.hc_tg_application_status_event(), public.hc_tg_owner_notification_event(), public.hc_emit_event(text, text, text, text, text, boolean),
  public.hc_events_guard();
alter table public.hc_tiers drop constraint if exists hc_tiers_benefits_shape;
alter table public.hc_tiers drop column if exists benefits, drop column if exists referral_eligible, drop column if exists assignments_enabled, drop column if exists updated_at;
