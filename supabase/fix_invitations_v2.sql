-- Add user-id based invitations + status tracking
-- (invited_email stays for backwards compat with email-based flow)

alter table public.invitations
  add column if not exists invited_user_id uuid references public.users(id) on delete cascade,
  add column if not exists status text default 'pending';

-- make invited_email nullable so user-id-based invites don't need it
alter table public.invitations
  alter column invited_email drop not null;

-- backfill status from old accepted boolean
update public.invitations set status = 'accepted' where accepted = true and status is null;
update public.invitations set status = 'pending'  where status is null;

-- tighten status values (safe, only valid values exist after backfill)
alter table public.invitations
  drop constraint if exists invitations_status_check;
alter table public.invitations
  add constraint invitations_status_check
    check (status in ('pending','accepted','declined','cancelled'));

-- refresh RLS so invited_user_id can also read/respond
drop policy if exists "Invited users and senders can read invitations" on public.invitations;
create policy "Invited users and senders can read invitations" on public.invitations for select
  using (
    invited_by = auth.uid()
    or invited_user_id = auth.uid()
    or (invited_email is not null
        and invited_email = (select email from auth.users where id = auth.uid()))
  );

drop policy if exists "Invited user can accept" on public.invitations;
drop policy if exists "Invited user can update status" on public.invitations;
create policy "Invited user can update status" on public.invitations for update
  using (
    invited_user_id = auth.uid()
    or invited_by = auth.uid()
    or (invited_email is not null
        and invited_email = (select email from auth.users where id = auth.uid()))
  );
