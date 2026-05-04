-- LockIn full schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/wuzcaxpebbytmzcthrbn/sql/new

-- Users (extends auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  avatar_initials text not null,
  north_star text,
  created_at timestamptz default now()
);

-- Groups
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz default now()
);

-- Group members
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

-- Commitments
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  week_start date not null,
  commitment_text text not null,
  consequence_text text not null,
  status text not null default 'active' check (status in ('active','completed','missed')),
  created_at timestamptz default now()
);

-- Daily checkins
create table if not exists public.checkins (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid references public.commitments(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  checked_in_at timestamptz default now(),
  day_of_week integer not null check (day_of_week between 0 and 6),
  unique(commitment_id, day_of_week)
);

-- Missed submissions
create table if not exists public.missed_submissions (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid references public.commitments(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  excuse_text text not null,
  submitted_at timestamptz default now()
);

-- Votes
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  missed_submission_id uuid references public.missed_submissions(id) on delete cascade,
  voter_id uuid references public.users(id) on delete cascade,
  is_valid boolean not null,
  voted_at timestamptz default now(),
  unique(missed_submission_id, voter_id)
);

-- Weekly matches
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  user_id_1 uuid references public.users(id) on delete cascade,
  user_id_2 uuid references public.users(id) on delete cascade,
  week_start date not null,
  match_reason text,
  created_at timestamptz default now()
);

-- AI insights
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  insight_text text not null,
  insight_type text not null check (insight_type in ('pattern','drift','suggestion')),
  created_at timestamptz default now()
);

-- Monthly challenges
create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  month_start date not null,
  created_at timestamptz default now()
);

-- Challenge participants
create table if not exists public.challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references public.challenges(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  joined_at timestamptz default now(),
  unique(challenge_id, user_id)
);

-- North star history
create table if not exists public.north_star_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  north_star text not null,
  recorded_at timestamptz default now()
);

-- Invitations
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  invited_by uuid references public.users(id) on delete cascade,
  invited_email text not null,
  accepted boolean default false,
  created_at timestamptz default now()
);

-- RLS: enable on all tables
alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.commitments enable row level security;
alter table public.checkins enable row level security;
alter table public.missed_submissions enable row level security;
alter table public.votes enable row level security;
alter table public.matches enable row level security;
alter table public.ai_insights enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.north_star_history enable row level security;
alter table public.invitations enable row level security;

-- RLS policies

-- users: anyone authenticated can read; only own row can be written
create policy "Users can read all users" on public.users for select using (auth.role() = 'authenticated');
create policy "Users can insert own row" on public.users for insert with check (auth.uid() = id);
create policy "Users can update own row" on public.users for update using (auth.uid() = id);

-- groups: members can read their groups
create policy "Members can read their groups" on public.groups for select
  using (exists (select 1 from public.group_members where group_id = groups.id and user_id = auth.uid()));
create policy "Authenticated can create groups" on public.groups for insert with check (auth.role() = 'authenticated');
create policy "Creator can update group" on public.groups for update using (created_by = auth.uid());

-- group_members
create policy "Members can read group_members" on public.group_members for select
  using (exists (select 1 from public.group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid()));
create policy "Authenticated can join groups" on public.group_members for insert with check (auth.role() = 'authenticated');

-- commitments
create policy "Members can read group commitments" on public.commitments for select
  using (exists (select 1 from public.group_members where group_id = commitments.group_id and user_id = auth.uid()));
create policy "Users can create own commitments" on public.commitments for insert with check (user_id = auth.uid());
create policy "Users can update own commitments" on public.commitments for update using (user_id = auth.uid());

-- checkins
create policy "Members can read checkins" on public.checkins for select
  using (exists (
    select 1 from public.commitments c
    join public.group_members gm on gm.group_id = c.group_id
    where c.id = checkins.commitment_id and gm.user_id = auth.uid()
  ));
create policy "Users can insert own checkins" on public.checkins for insert with check (user_id = auth.uid());

-- missed_submissions
create policy "Members can read missed_submissions" on public.missed_submissions for select
  using (exists (
    select 1 from public.commitments c
    join public.group_members gm on gm.group_id = c.group_id
    where c.id = missed_submissions.commitment_id and gm.user_id = auth.uid()
  ));
create policy "Users can insert own missed_submissions" on public.missed_submissions for insert with check (user_id = auth.uid());

-- votes
create policy "Members can read votes after close" on public.votes for select
  using (exists (
    select 1 from public.missed_submissions ms
    join public.commitments c on c.id = ms.commitment_id
    join public.group_members gm on gm.group_id = c.group_id
    where ms.id = votes.missed_submission_id and gm.user_id = auth.uid()
  ));
create policy "Authenticated members can vote" on public.votes for insert
  with check (voter_id = auth.uid());

-- matches
create policy "Users can read own matches" on public.matches for select
  using (user_id_1 = auth.uid() or user_id_2 = auth.uid());
create policy "Service can insert matches" on public.matches for insert with check (auth.role() = 'authenticated');

-- ai_insights
create policy "Users can read own insights" on public.ai_insights for select using (user_id = auth.uid());
create policy "Service can insert insights" on public.ai_insights for insert with check (auth.role() = 'authenticated');

-- challenges: everyone can read
create policy "Anyone can read challenges" on public.challenges for select using (auth.role() = 'authenticated');
create policy "Authenticated can create challenges" on public.challenges for insert with check (auth.role() = 'authenticated');

-- challenge_participants
create policy "Anyone can read participants" on public.challenge_participants for select using (auth.role() = 'authenticated');
create policy "Users can join challenges" on public.challenge_participants for insert with check (user_id = auth.uid());

-- north_star_history
create policy "Users can read own history" on public.north_star_history for select using (user_id = auth.uid());
create policy "Users can insert own history" on public.north_star_history for insert with check (user_id = auth.uid());

-- invitations
create policy "Invited users and senders can read invitations" on public.invitations for select
  using (invited_by = auth.uid() or invited_email = (select email from public.users where id = auth.uid()));
create policy "Members can create invitations" on public.invitations for insert with check (invited_by = auth.uid());
create policy "Invited user can accept" on public.invitations for update using (
  invited_email = (select email from public.users where id = auth.uid())
);

-- Realtime
alter publication supabase_realtime add table public.checkins;
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.commitments;
alter publication supabase_realtime add table public.missed_submissions;

-- Trigger: auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  initials text;
  full_name text;
begin
  full_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  initials := upper(
    substring(split_part(full_name, ' ', 1), 1, 1) ||
    coalesce(substring(split_part(full_name, ' ', 2), 1, 1), substring(full_name, 2, 1))
  );
  insert into public.users (id, email, name, avatar_initials)
  values (new.id, new.email, full_name, initials)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Seed a sample monthly challenge
insert into public.challenges (title, description, month_start)
values (
  'Morning Momentum',
  'Complete your daily commitment check-in before 9am every day this month.',
  date_trunc('month', current_date)::date
) on conflict do nothing;
