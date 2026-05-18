-- 1. Check-in photos: add photo_url to checkins
alter table public.checkins
  add column if not exists photo_url text;

-- 2. Feed posts table
create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade not null,
  caption text,
  media_url text,
  media_type text check (media_type in ('image', 'video')),
  created_at timestamptz default now()
);

alter table public.feed_posts enable row level security;

-- Friends + self can read feed posts
create policy "Friends can read feed posts" on public.feed_posts for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.friendships
      where user_id = auth.uid() and friend_id = feed_posts.user_id
    )
    or exists (
      select 1 from public.group_members gm1
      join public.group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = auth.uid() and gm2.user_id = feed_posts.user_id
    )
  );

create policy "Users can post to feed" on public.feed_posts for insert
  with check (user_id = auth.uid());

create policy "Users can delete own posts" on public.feed_posts for delete
  using (user_id = auth.uid());

-- 3. Storage bucket policies (run after creating buckets in dashboard)
-- Bucket: checkin-photos (public read, auth write)
-- Bucket: feed-media (public read, auth write)
-- These policies assume the buckets already exist in Supabase Storage.

insert into storage.buckets (id, name, public) values ('checkin-photos', 'checkin-photos', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('feed-media', 'feed-media', true) on conflict do nothing;

create policy "Authenticated can upload checkin photos" on storage.objects
  for insert with check (bucket_id = 'checkin-photos' and auth.role() = 'authenticated');
create policy "Public can read checkin photos" on storage.objects
  for select using (bucket_id = 'checkin-photos');

create policy "Authenticated can upload feed media" on storage.objects
  for insert with check (bucket_id = 'feed-media' and auth.role() = 'authenticated');
create policy "Public can read feed media" on storage.objects
  for select using (bucket_id = 'feed-media');

-- 4. Feed post likes (optional, simple)
create table if not exists public.feed_likes (
  post_id uuid references public.feed_posts(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);
alter table public.feed_likes enable row level security;
create policy "Anyone can read likes" on public.feed_likes for select using (auth.role() = 'authenticated');
create policy "Users can like" on public.feed_likes for insert with check (user_id = auth.uid());
create policy "Users can unlike" on public.feed_likes for delete using (user_id = auth.uid());
