do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'qr_codes'
      and column_name = 'tenant_id'
  ) then
    insert into public.qr_codes (tenant_id, id, label, image_url, account_name, is_active, sort_order, updated_at)
    values
      ('00000000-0000-0000-0000-000000000001', 'gcash', 'GCash', '/images/gcash.jpg', 'SYE SIMOLDE', true, 10, now()),
      ('00000000-0000-0000-0000-000000000001', 'gotyme', 'GoTyme', '/images/gotyme.jpg', 'SYE SIMOLDE', true, 20, now())
    on conflict (tenant_id, id) do update
    set
      label = coalesce(public.qr_codes.label, excluded.label),
      image_url = coalesce(nullif(public.qr_codes.image_url, ''), excluded.image_url),
      account_name = coalesce(nullif(public.qr_codes.account_name, ''), excluded.account_name),
      is_active = coalesce(public.qr_codes.is_active, excluded.is_active),
      sort_order = case
        when public.qr_codes.sort_order = 0 then excluded.sort_order
        else public.qr_codes.sort_order
      end,
      updated_at = public.qr_codes.updated_at;
  else
    create table if not exists public.qr_codes (
      id text primary key,
      image_url text,
      account_name text,
      label text,
      is_active boolean not null default true,
      sort_order integer not null default 0,
      updated_at timestamptz not null default now()
    );

    alter table public.qr_codes
      add column if not exists label text,
      add column if not exists is_active boolean not null default true,
      add column if not exists sort_order integer not null default 0,
      add column if not exists updated_at timestamptz not null default now();

    insert into public.qr_codes (id, label, image_url, account_name, is_active, sort_order, updated_at)
    values
      ('gcash', 'GCash', '/images/gcash.jpg', 'SYE SIMOLDE', true, 10, now()),
      ('gotyme', 'GoTyme', '/images/gotyme.jpg', 'SYE SIMOLDE', true, 20, now())
    on conflict (id) do update
    set
      label = coalesce(public.qr_codes.label, excluded.label),
      image_url = coalesce(nullif(public.qr_codes.image_url, ''), excluded.image_url),
      account_name = coalesce(nullif(public.qr_codes.account_name, ''), excluded.account_name),
      is_active = coalesce(public.qr_codes.is_active, excluded.is_active),
      sort_order = case
        when public.qr_codes.sort_order = 0 then excluded.sort_order
        else public.qr_codes.sort_order
      end,
      updated_at = public.qr_codes.updated_at;
  end if;
end;
$$;

grant select on public.qr_codes to anon, authenticated;
grant insert, update on public.qr_codes to authenticated;
