-- Complete feed setup: tables + RLS policies
-- Safe to run multiple times (uses IF NOT EXISTS / DROP IF EXISTS)

-- 1. feed_posts table
create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  caption text,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  created_at timestamptz default now()
);

alter table public.feed_posts enable row level security;

drop policy if exists "Anyone authenticated can read feed posts" on public.feed_posts;
create policy "Anyone authenticated can read feed posts"
  on public.feed_posts for select
  to authenticated using (true);

drop policy if exists "Users can insert own feed posts" on public.feed_posts;
create policy "Users can insert own feed posts"
  on public.feed_posts for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can delete own feed posts" on public.feed_posts;
create policy "Users can delete own feed posts"
  on public.feed_posts for delete
  to authenticated using (auth.uid() = user_id);

-- 2. feed_likes table
create table if not exists public.feed_likes (
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  primary key (post_id, user_id)
);

alter table public.feed_likes enable row level security;

drop policy if exists "Anyone authenticated can read feed likes" on public.feed_likes;
create policy "Anyone authenticated can read feed likes"
  on public.feed_likes for select
  to authenticated using (true);

drop policy if exists "Users can insert own likes" on public.feed_likes;
create policy "Users can insert own likes"
  on public.feed_likes for insert
  to authenticated with check (auth.uid() = user_id);

drop policy if exists "Users can delete own likes" on public.feed_likes;
create policy "Users can delete own likes"
  on public.feed_likes for delete
  to authenticated using (auth.uid() = user_id);

-- 3. Storage buckets (run separately if these error — bucket creation via SQL isn't always available)
insert into storage.buckets (id, name, public)
  values ('feed-media', 'feed-media', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('checkin-photos', 'checkin-photos', true)
  on conflict (id) do nothing;

-- Storage policies for feed-media
drop policy if exists "Public read feed-media" on storage.objects;
create policy "Public read feed-media"
  on storage.objects for select using (bucket_id = 'feed-media');

drop policy if exists "Auth upload feed-media" on storage.objects;
create policy "Auth upload feed-media"
  on storage.objects for insert
  to authenticated with check (bucket_id = 'feed-media');

drop policy if exists "Auth delete own feed-media" on storage.objects;
create policy "Auth delete own feed-media"
  on storage.objects for delete
  to authenticated using (bucket_id = 'feed-media' and auth.uid()::text = (storage.foldername(name))[1]);
