-- Allow any authenticated admin (listed in public.admin_users) to update any court.
-- Run this in Supabase SQL Editor.

alter table public.courts enable row level security;

-- Remove existing UPDATE policies on courts (including owner-only policies)
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'courts'
      and cmd = 'UPDATE'
  loop
    execute format('drop policy if exists %I on public.courts', pol.policyname);
  end loop;
end
$$;

-- Create broad admin UPDATE policy
create policy "admin_users_can_update_any_court"
  on public.courts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users au
      where au.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users au
      where au.id = auth.uid()
    )
  );
