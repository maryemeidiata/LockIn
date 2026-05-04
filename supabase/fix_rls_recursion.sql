-- Fix: infinite recursion in group_members RLS policy
-- The original policy queried group_members from within a group_members policy.
-- Solution: use a security definer function that bypasses RLS to check membership.

-- 1. Create a bypass function (runs as superuser, skips RLS)
create or replace function public.get_my_group_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select group_id from public.group_members where user_id = auth.uid()
$$;

-- 2. Drop the recursive policy
drop policy if exists "Members can read group_members" on public.group_members;

-- 3. Replace with a non-recursive version
create policy "Members can read group_members" on public.group_members for select
  using (group_id = any(array(select public.get_my_group_ids())));

-- 4. Also fix the commitments policy (same recursion risk via group_members join)
drop policy if exists "Members can read group commitments" on public.commitments;
create policy "Members can read group commitments" on public.commitments for select
  using (group_id = any(array(select public.get_my_group_ids())));

-- 5. Fix checkins policy
drop policy if exists "Members can read checkins" on public.checkins;
create policy "Members can read checkins" on public.checkins for select
  using (
    commitment_id in (
      select id from public.commitments
      where group_id = any(array(select public.get_my_group_ids()))
    )
  );

-- 6. Fix missed_submissions policy
drop policy if exists "Members can read missed_submissions" on public.missed_submissions;
create policy "Members can read missed_submissions" on public.missed_submissions for select
  using (
    commitment_id in (
      select id from public.commitments
      where group_id = any(array(select public.get_my_group_ids()))
    )
  );

-- 7. Fix votes policy
drop policy if exists "Members can read votes after close" on public.votes;
create policy "Members can read votes after close" on public.votes for select
  using (
    missed_submission_id in (
      select ms.id from public.missed_submissions ms
      join public.commitments c on c.id = ms.commitment_id
      where c.group_id = any(array(select public.get_my_group_ids()))
    )
  );

-- 8. Fix groups policy
drop policy if exists "Members can read their groups" on public.groups;
create policy "Members can read their groups" on public.groups for select
  using (id = any(array(select public.get_my_group_ids())));
