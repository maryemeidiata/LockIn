-- Push notification subscriptions
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade not null,
  subscription jsonb not null,
  created_at timestamptz default now(),
  unique(user_id)
);

alter table push_subscriptions enable row level security;

create policy "Users manage own subscription"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Allow edge functions (service role) to read all subscriptions for sending
create policy "Service role reads all"
  on push_subscriptions for select
  using (auth.role() = 'service_role');

-- Nudge notifications log (so we can prevent spam)
create table if not exists nudge_log (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid references users(id) on delete cascade not null,
  to_user_id uuid references users(id) on delete cascade not null,
  message text,
  sent_at timestamptz default now()
);

alter table nudge_log enable row level security;

create policy "Users insert own nudges"
  on nudge_log for insert
  with check (auth.uid() = from_user_id);

create policy "Service role reads nudge log"
  on nudge_log for select
  using (auth.role() = 'service_role');
