-- Feed posts: let any authenticated user read all posts
-- (posts disappear after refresh because no SELECT policy exists)
alter table public.feed_posts enable row level security;

drop policy if exists "Authenticated users can read feed posts" on public.feed_posts;
create policy "Authenticated users can read feed posts"
  on public.feed_posts for select
  to authenticated
  using (true);

drop policy if exists "Users can insert own feed posts" on public.feed_posts;
create policy "Users can insert own feed posts"
  on public.feed_posts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own feed posts" on public.feed_posts;
create policy "Users can delete own feed posts"
  on public.feed_posts for delete
  to authenticated
  using (auth.uid() = user_id);

-- Feed likes: same pattern
alter table public.feed_likes enable row level security;

drop policy if exists "Authenticated users can read feed likes" on public.feed_likes;
create policy "Authenticated users can read feed likes"
  on public.feed_likes for select
  to authenticated
  using (true);

drop policy if exists "Users can insert own likes" on public.feed_likes;
create policy "Users can insert own likes"
  on public.feed_likes for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own likes" on public.feed_likes;
create policy "Users can delete own likes"
  on public.feed_likes for delete
  to authenticated
  using (auth.uid() = user_id);
