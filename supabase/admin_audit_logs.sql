-- Run this in Supabase SQL Editor to enable cross-device admin audit logs.

create extension if not exists pgcrypto;

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  description text,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created_at
  on public.admin_audit_logs (created_at desc);

create index if not exists idx_admin_audit_logs_action
  on public.admin_audit_logs (action);

create index if not exists idx_admin_audit_logs_user_id
  on public.admin_audit_logs (user_id);

alter table public.admin_audit_logs enable row level security;

-- Admin users can read all admin audit logs.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_audit_logs'
      and policyname = 'admin_users_can_select_audit_logs'
  ) then
    create policy "admin_users_can_select_audit_logs"
      on public.admin_audit_logs
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.admin_users au
          where au.id = auth.uid()
        )
      );
  end if;
end
$$;

-- Admin users can insert audit logs. user_id must be null or match auth user.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_audit_logs'
      and policyname = 'admin_users_can_insert_audit_logs'
  ) then
    create policy "admin_users_can_insert_audit_logs"
      on public.admin_audit_logs
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.admin_users au
          where au.id = auth.uid()
        )
        and (user_id is null or user_id = auth.uid())
      );
  end if;
end
$$;

-- Admin users can delete logs (used by tray clear action).
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_audit_logs'
      and policyname = 'admin_users_can_delete_audit_logs'
  ) then
    create policy "admin_users_can_delete_audit_logs"
      on public.admin_audit_logs
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.admin_users au
          where au.id = auth.uid()
        )
      );
  end if;
end
$$;
