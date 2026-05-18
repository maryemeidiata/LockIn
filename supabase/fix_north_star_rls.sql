-- Fix North Star update policy — ensures users can update their own row
drop policy if exists "Users can update own row" on public.users;

create policy "Users can update own row"
  on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
