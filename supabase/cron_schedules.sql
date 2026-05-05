-- Enable pg_cron and pg_net extensions (if not already enabled)
-- Run this in the Supabase SQL editor

-- Daily check-in reminder: 9am UTC every day
select cron.schedule(
  'daily-checkin-reminder',
  '0 9 * * *',
  $$
  select net.http_post(
    url := 'https://wuzcaxpebbytmzcthrbn.supabase.co/functions/v1/daily-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  )
  $$
);

-- Weekly goal reminder: Sunday 10am UTC
select cron.schedule(
  'weekly-goal-reminder',
  '0 10 * * 0',
  $$
  select net.http_post(
    url := 'https://wuzcaxpebbytmzcthrbn.supabase.co/functions/v1/weekly-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  )
  $$
);

-- Midweek nudge to friends: Wednesday 3pm UTC
select cron.schedule(
  'midweek-nudge',
  '0 15 * * 3',
  $$
  select net.http_post(
    url := 'https://wuzcaxpebbytmzcthrbn.supabase.co/functions/v1/midweek-nudge',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  )
  $$
);

-- To remove schedules if needed:
-- select cron.unschedule('daily-checkin-reminder');
-- select cron.unschedule('weekly-goal-reminder');
-- select cron.unschedule('midweek-nudge');

-- To view scheduled jobs:
-- select * from cron.job;
