CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('crm-lead-sync') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crm-lead-sync');

SELECT cron.schedule(
  'crm-lead-sync',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--ce3eb05c-3308-4ff2-9b94-650cb0170e82.lovable.app/api/public/crm/sync',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_yYU36XwHhVrFJEoUpdNuFQ_6eeoi77U"}'::jsonb,
    body := '{"trigger": "cron"}'::jsonb
  ) as request_id;
  $$
);