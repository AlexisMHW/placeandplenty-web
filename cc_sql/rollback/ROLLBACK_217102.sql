-- Rollback of 217102 (A3 217002, notifications). Run AFTER ROLLBACK_217110. DESTROYS inbox rows, settings (incl. verified destination) and delivery history: export first if needed.
drop trigger if exists cc_owner_event_notify on public.hc_owner_notifications;
drop trigger if exists cc_application_status_notify on public.creator_applications;
drop trigger if exists cc_payout_notify on public.payouts;
drop function if exists public.cc_trg_owner_event(), public.cc_trg_application_status(), public.cc_trg_payout();
drop function if exists public.admin_list_notifications(text,integer), public.admin_notification_counts(), public.admin_set_notification_state(bigint,text),
  public.admin_get_notification_settings(), public.admin_get_notification(bigint), public.admin_set_notification_destination(text), public.admin_verify_notification_destination(text),
  public.admin_set_notification_email_enabled(boolean,text), public.admin_set_notification_thresholds(integer,integer),
  public.admin_list_notification_deliveries(text,integer), public.admin_retry_notification_delivery(bigint),
  public.cc_claim_email_deliveries(integer), public.cc_record_delivery_result(bigint,text,text,text), public.cc_sweep_notifications(timestamptz),
  public.cc_raise_notification(text,text,text,text,text,text,text,text), public.cc_resolve_by_dedup(text), public.cc_require_staff(),
  public.cc_sev_rank(text), public.cc_mask_email(text);
drop table if exists public.cc_notification_deliveries, public.cc_notifications, public.cc_notification_settings;
