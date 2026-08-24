SELECT cron.unschedule('portal-backup-automatico');

SELECT cron.schedule(
  'portal-backup-automatico',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--ce3eb05c-3308-4ff2-9b94-650cb0170e82.lovable.app/api/public/backup/run',
    headers:='{"Content-Type": "application/json", "apikey": "sb_publishable_yYU36XwHhVrFJEoUpdNuFQ_6eeoi77U"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);