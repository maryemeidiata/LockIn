-- Fix: "new row violates row-level security policy for table groups"
-- auth.role() can be unreliable; use auth.uid() is not null instead

drop policy if exists "Authenticated can create groups" on public.groups;
drop policy if exists "Creator can update group" on public.groups;

create policy "Authenticated can create groups" on public.groups
  for insert with check (auth.uid() is not null and created_by = auth.uid());

create policy "Creator can update group" on public.groups
  for update using (created_by = auth.uid());

-- Same fix for group_members insert
drop policy if exists "Authenticated can join groups" on public.group_members;
create policy "Authenticated can join groups" on public.group_members
  for insert with check (auth.uid() is not null);

-- Same fix for invitations insert
drop policy if exists "Members can create invitations" on public.invitations;
create policy "Members can create invitations" on public.invitations
  for insert with check (invited_by = auth.uid());
