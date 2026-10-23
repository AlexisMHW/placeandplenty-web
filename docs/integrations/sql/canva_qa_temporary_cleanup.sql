-- QA-only. Never run against production as part of this feature build.
-- Does not activate any copied reminder/communication jobs.
select cron.schedule(
  'canva-qa-temporary-record-cleanup',
  '*/15 * * * *',
  'select canva_private.cleanup_temporary_records();'
);
