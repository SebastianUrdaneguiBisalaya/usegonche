-- Reminders processor: every minute, Supabase calls POST /v1/internal/reminders/process on the API.
-- Applied MANUALLY by the user (SQL editor); never run by the API, Prisma or the agent. Re-runnable.
--
-- Before running, replace the two placeholders below:
--   <API_URL>  public base URL of the deployed API, no trailing slash (e.g. https://api.example.com)
--   <SECRET>   the same value as the API's INTERNAL_CRON_SECRET env var
--
-- Note: the secret ends up in cron.job (readable by the postgres role). It is a single-user setup; rotate it by re-running this script.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Re-runnable: drop the job first if it exists.
select cron.unschedule(jobid) from cron.job where jobname = 'process-reminders';

select cron.schedule(
  'process-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := '<API_URL>/v1/internal/reminders/process',
    headers := '{"Content-Type": "application/json", "x-internal-secret": "<SECRET>"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

-- Inspect:  select * from cron.job where jobname = 'process-reminders';
--           select * from cron.job_run_details order by start_time desc limit 10;
--           select * from net._http_response order by created desc limit 10;
-- Stop:     select cron.unschedule('process-reminders');
