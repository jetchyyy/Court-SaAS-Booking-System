create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  custom_domain text unique,
  contact_email text,
  contact_phone text,
  logo_url text,
  hero_image_url text,
  address text,
  description text,
  default_booking_fee_amount numeric(12, 2) not null default 5.00,
  default_booking_fee_currency text not null default 'PHP',
  is_active boolean not null default true,
  disabled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  role text not null default 'owner_admin' check (role in ('owner_admin')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists public.tenant_fee_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  fee_amount numeric(12, 2) not null default 5.00 check (fee_amount >= 0),
  currency text not null default 'PHP',
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.courts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  admin_id uuid references auth.users(id) on delete set null,
  name text not null,
  type text not null default 'Standard',
  price numeric(12, 2) not null default 0,
  description text,
  images jsonb not null default '[]'::jsonb,
  pricing_rules jsonb not null default '[]'::jsonb,
  max_players integer not null default 10,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete restrict,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  booking_date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  total_price numeric(12, 2) not null default 0,
  status text not null default 'Confirmed' check (status in ('Confirmed', 'Rescheduled', 'Cancelled')),
  notes text,
  proof_of_payment_url text,
  booked_times jsonb not null default '[]'::jsonb,
  rescheduled_from jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blocked_time_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  court_id uuid not null references public.courts(id) on delete cascade,
  blocked_date date not null,
  time_slot time without time zone not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (tenant_id, court_id, blocked_date, time_slot)
);

create table if not exists public.qr_codes (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text not null,
  image_url text,
  account_name text,
  label text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  action text not null,
  description text,
  user_id uuid references auth.users(id) on delete set null,
  user_email text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.owner_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  invoice_number text not null unique,
  period_start date not null,
  period_end date not null,
  booking_count integer not null default 0,
  total_amount numeric(12, 2) not null default 0,
  currency text not null default 'PHP',
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'void')),
  external_reference text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  paid_at timestamptz,
  voided_at timestamptz
);

create table if not exists public.booking_fee_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  invoice_id uuid references public.owner_invoices(id) on delete set null,
  fee_amount numeric(12, 2) not null,
  currency text not null default 'PHP',
  status text not null default 'unbilled' check (status in ('unbilled', 'invoiced', 'paid', 'void')),
  created_at timestamptz not null default now(),
  invoiced_at timestamptz,
  paid_at timestamptz,
  unique (booking_id)
);

create index if not exists idx_tenants_custom_domain on public.tenants (lower(custom_domain));
create index if not exists idx_tenant_members_user_id on public.tenant_members (user_id);
create index if not exists idx_courts_tenant_id on public.courts (tenant_id);
create index if not exists idx_bookings_tenant_date on public.bookings (tenant_id, booking_date);
create index if not exists idx_bookings_court_date on public.bookings (court_id, booking_date);
create index if not exists idx_blocked_time_slots_tenant_date on public.blocked_time_slots (tenant_id, blocked_date);
create index if not exists idx_booking_fee_ledger_tenant_status on public.booking_fee_ledger (tenant_id, status, invoice_id);
create index if not exists idx_owner_invoices_tenant_status on public.owner_invoices (tenant_id, status);
create index if not exists idx_admin_audit_logs_tenant_created_at on public.admin_audit_logs (tenant_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tenants_touch_updated_at on public.tenants;
create trigger tenants_touch_updated_at
before update on public.tenants
for each row execute function public.touch_updated_at();

drop trigger if exists courts_touch_updated_at on public.courts;
create trigger courts_touch_updated_at
before update on public.courts
for each row execute function public.touch_updated_at();

drop trigger if exists bookings_touch_updated_at on public.bookings;
create trigger bookings_touch_updated_at
before update on public.bookings
for each row execute function public.touch_updated_at();

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.platform_admins pa
    where pa.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_tenant(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.tenant_members tm
      where tm.tenant_id = p_tenant_id
        and tm.user_id = auth.uid()
    );
$$;

create or replace function public.tenant_is_active(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
      and t.is_active = true
  );
$$;

create or replace view public.public_booking_slots as
select
  b.tenant_id,
  b.id,
  b.court_id,
  b.booking_date,
  b.start_time,
  b.end_time,
  b.booked_times,
  b.status
from public.bookings b
where b.status in ('Confirmed', 'Rescheduled');

alter table public.tenants enable row level security;
alter table public.platform_admins enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_fee_settings enable row level security;
alter table public.courts enable row level security;
alter table public.bookings enable row level security;
alter table public.blocked_time_slots enable row level security;
alter table public.qr_codes enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.owner_invoices enable row level security;
alter table public.booking_fee_ledger enable row level security;

create policy "public_can_read_active_tenants"
  on public.tenants for select
  to anon, authenticated
  using (is_active = true or public.can_manage_tenant(id));

create policy "platform_admins_manage_tenants"
  on public.tenants for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "platform_admins_read_platform_admins"
  on public.platform_admins for select
  to authenticated
  using (public.is_platform_admin());

create policy "platform_admins_manage_platform_admins"
  on public.platform_admins for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "members_can_read_their_memberships"
  on public.tenant_members for select
  to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

create policy "platform_admins_manage_memberships"
  on public.tenant_members for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "managers_read_fee_settings"
  on public.tenant_fee_settings for select
  to authenticated
  using (public.can_manage_tenant(tenant_id));

create policy "platform_admins_manage_fee_settings"
  on public.tenant_fee_settings for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "public_read_active_courts"
  on public.courts for select
  to anon, authenticated
  using ((is_active = true and public.tenant_is_active(tenant_id)) or public.can_manage_tenant(tenant_id));

create policy "tenant_managers_manage_courts"
  on public.courts for all
  to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

create policy "tenant_managers_read_bookings"
  on public.bookings for select
  to authenticated
  using (public.can_manage_tenant(tenant_id));

create policy "tenant_managers_update_bookings"
  on public.bookings for update
  to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

create policy "tenant_managers_delete_bookings"
  on public.bookings for delete
  to authenticated
  using (public.can_manage_tenant(tenant_id));

create policy "public_read_blocked_slots"
  on public.blocked_time_slots for select
  to anon, authenticated
  using (public.tenant_is_active(tenant_id) or public.can_manage_tenant(tenant_id));

create policy "tenant_managers_manage_blocked_slots"
  on public.blocked_time_slots for all
  to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

create policy "public_read_active_qr_codes"
  on public.qr_codes for select
  to anon, authenticated
  using ((is_active = true and public.tenant_is_active(tenant_id)) or public.can_manage_tenant(tenant_id));

create policy "tenant_managers_manage_qr_codes"
  on public.qr_codes for all
  to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

create policy "tenant_managers_read_audit_logs"
  on public.admin_audit_logs for select
  to authenticated
  using (tenant_id is not null and public.can_manage_tenant(tenant_id));

create policy "tenant_managers_insert_audit_logs"
  on public.admin_audit_logs for insert
  to authenticated
  with check (tenant_id is not null and public.can_manage_tenant(tenant_id));

create policy "tenant_managers_delete_audit_logs"
  on public.admin_audit_logs for delete
  to authenticated
  using (tenant_id is not null and public.can_manage_tenant(tenant_id));

create policy "platform_admins_manage_invoices"
  on public.owner_invoices for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "tenant_managers_read_invoices"
  on public.owner_invoices for select
  to authenticated
  using (public.can_manage_tenant(tenant_id));

create policy "platform_admins_manage_fee_ledger"
  on public.booking_fee_ledger for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "tenant_managers_read_fee_ledger"
  on public.booking_fee_ledger for select
  to authenticated
  using (public.can_manage_tenant(tenant_id));

create or replace function public.get_tenant_by_domain(p_hostname text)
returns public.tenants
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.tenants
  where lower(custom_domain) = lower(regexp_replace(coalesce(p_hostname, ''), ':\d+$', ''))
     or (
       regexp_replace(coalesce(p_hostname, ''), ':\d+$', '') in ('localhost', '127.0.0.1')
       and slug = 'demo'
     )
  order by case when lower(custom_domain) = lower(regexp_replace(coalesce(p_hostname, ''), ':\d+$', '')) then 0 else 1 end
  limit 1;
$$;

create or replace function public.current_booking_fee(p_tenant_id uuid)
returns table (fee_amount numeric, currency text)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(tfs.fee_amount, t.default_booking_fee_amount, 5.00) as fee_amount,
    coalesce(tfs.currency, t.default_booking_fee_currency, 'PHP') as currency
  from public.tenants t
  left join public.tenant_fee_settings tfs
    on tfs.tenant_id = t.id
   and tfs.is_active = true
  where t.id = p_tenant_id
  limit 1;
$$;

create or replace function public.create_booking_atomic(
  p_tenant_id uuid,
  p_court_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_booking_date date,
  p_start_time time without time zone,
  p_end_time time without time zone,
  p_total_price numeric,
  p_notes text,
  p_proof_of_payment_url text,
  p_booked_times text[],
  p_court_type text default ''
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_fee record;
  v_is_exclusive boolean := coalesce(p_court_type, '') ilike '%exclusive%' or coalesce(p_court_type, '') ilike '%whole%';
  v_requested_slots text[];
  v_conflicts text[];
begin
  if not public.tenant_is_active(p_tenant_id) then
    raise exception 'TENANT_DISABLED'
      using errcode = 'P0001',
            detail = p_tenant_id::text;
  end if;

  if not exists (
    select 1
    from public.courts c
    where c.id = p_court_id
      and c.tenant_id = p_tenant_id
      and c.is_active = true
  ) then
    raise exception 'COURT_NOT_AVAILABLE'
      using errcode = 'P0001',
            detail = p_court_id::text;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_booking_date::text, 0));

  v_requested_slots := array(
    select distinct left(trim(slot), 5)
    from unnest(coalesce(p_booked_times, array[]::text[])) as slot
    where trim(slot) <> ''
    order by left(trim(slot), 5)
  );

  if coalesce(array_length(v_requested_slots, 1), 0) = 0 then
    raise exception 'NO_TIME_SLOTS_SELECTED'
      using errcode = 'P0001',
            detail = 'No time slots were supplied for this booking.';
  end if;

  select array_agg(distinct left(bts.time_slot::text, 5) order by left(bts.time_slot::text, 5))
  into v_conflicts
  from public.blocked_time_slots bts
  where bts.tenant_id = p_tenant_id
    and bts.blocked_date = p_booking_date
    and (
      (not v_is_exclusive and bts.court_id = p_court_id)
      or v_is_exclusive
    )
    and left(bts.time_slot::text, 5) = any(v_requested_slots);

  if coalesce(array_length(v_conflicts, 1), 0) > 0 then
    raise exception 'ADMIN_BLOCKED'
      using errcode = 'P0001',
            detail = array_to_string(v_conflicts, ',');
  end if;

  with existing_bookings as (
    select
      b.id,
      b.court_id,
      coalesce(c.type, '') as court_type,
      case
        when jsonb_typeof(b.booked_times) = 'array' and jsonb_array_length(b.booked_times) > 0 then (
          select array_agg(distinct left(trim(slot), 5) order by left(trim(slot), 5))
          from jsonb_array_elements_text(b.booked_times) as slot
          where trim(slot) <> ''
        )
        else (
          select array_agg(lpad(hour_slot::text, 2, '0') || ':00' order by hour_slot)
          from generate_series(
            extract(hour from b.start_time)::int,
            greatest(extract(hour from b.end_time)::int - 1, extract(hour from b.start_time)::int),
            1
          ) as hour_slot
        )
      end as slots
    from public.bookings b
    left join public.courts c on c.id = b.court_id
    where b.tenant_id = p_tenant_id
      and b.booking_date = p_booking_date
      and b.status in ('Confirmed', 'Rescheduled')
      and (
        b.court_id = p_court_id
        or v_is_exclusive
        or coalesce(c.type, '') ilike '%exclusive%'
        or coalesce(c.type, '') ilike '%whole%'
      )
  )
  select array_agg(distinct requested.slot order by requested.slot)
  into v_conflicts
  from existing_bookings eb
  cross join lateral unnest(v_requested_slots) as requested(slot)
  where requested.slot = any(coalesce(eb.slots, array[]::text[]));

  if coalesce(array_length(v_conflicts, 1), 0) > 0 then
    raise exception 'ALREADY_BOOKED'
      using errcode = 'P0001',
            detail = array_to_string(v_conflicts, ',');
  end if;

  insert into public.bookings (
    tenant_id,
    court_id,
    customer_name,
    customer_email,
    customer_phone,
    booking_date,
    start_time,
    end_time,
    total_price,
    status,
    notes,
    proof_of_payment_url,
    booked_times
  )
  values (
    p_tenant_id,
    p_court_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_booking_date,
    p_start_time,
    p_end_time,
    coalesce(p_total_price, 0),
    'Confirmed',
    coalesce(p_notes, ''),
    p_proof_of_payment_url,
    to_jsonb(v_requested_slots)
  )
  returning * into v_booking;

  select * into v_fee
  from public.current_booking_fee(p_tenant_id);

  insert into public.booking_fee_ledger (
    tenant_id,
    booking_id,
    fee_amount,
    currency,
    status
  )
  values (
    p_tenant_id,
    v_booking.id,
    coalesce(v_fee.fee_amount, 5.00),
    coalesce(v_fee.currency, 'PHP'),
    'unbilled'
  );

  return v_booking;
end;
$$;

create or replace function public.reschedule_booking_atomic(
  p_tenant_id uuid,
  p_booking_id uuid,
  p_new_date date,
  p_new_start_time time without time zone,
  p_new_end_time time without time zone,
  p_new_booked_times text[],
  p_new_total_price numeric,
  p_reason text,
  p_original_date date,
  p_original_start_time time without time zone,
  p_original_end_time time without time zone,
  p_original_booked_times text[]
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_booking public.bookings;
  v_updated_booking public.bookings;
  v_court_type text := '';
  v_is_exclusive boolean;
  v_requested_slots text[];
  v_conflicts text[];
begin
  if not public.can_manage_tenant(p_tenant_id) then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  select *
  into v_existing_booking
  from public.bookings
  where id = p_booking_id
    and tenant_id = p_tenant_id;

  if not found then
    raise exception 'BOOKING_NOT_FOUND'
      using errcode = 'P0001',
            detail = p_booking_id::text;
  end if;

  select coalesce(type, '')
  into v_court_type
  from public.courts
  where id = v_existing_booking.court_id
    and tenant_id = p_tenant_id;

  v_is_exclusive := v_court_type ilike '%exclusive%' or v_court_type ilike '%whole%';

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_new_date::text, 0));

  v_requested_slots := array(
    select distinct left(trim(slot), 5)
    from unnest(coalesce(p_new_booked_times, array[]::text[])) as slot
    where trim(slot) <> ''
    order by left(trim(slot), 5)
  );

  if coalesce(array_length(v_requested_slots, 1), 0) = 0 then
    raise exception 'NO_TIME_SLOTS_SELECTED'
      using errcode = 'P0001',
            detail = 'No time slots were supplied for this reschedule.';
  end if;

  select array_agg(distinct left(bts.time_slot::text, 5) order by left(bts.time_slot::text, 5))
  into v_conflicts
  from public.blocked_time_slots bts
  where bts.tenant_id = p_tenant_id
    and bts.blocked_date = p_new_date
    and (
      (not v_is_exclusive and bts.court_id = v_existing_booking.court_id)
      or v_is_exclusive
    )
    and left(bts.time_slot::text, 5) = any(v_requested_slots);

  if coalesce(array_length(v_conflicts, 1), 0) > 0 then
    raise exception 'ADMIN_BLOCKED'
      using errcode = 'P0001',
            detail = array_to_string(v_conflicts, ',');
  end if;

  with existing_bookings as (
    select
      b.id,
      b.court_id,
      coalesce(c.type, '') as court_type,
      case
        when jsonb_typeof(b.booked_times) = 'array' and jsonb_array_length(b.booked_times) > 0 then (
          select array_agg(distinct left(trim(slot), 5) order by left(trim(slot), 5))
          from jsonb_array_elements_text(b.booked_times) as slot
          where trim(slot) <> ''
        )
        else (
          select array_agg(lpad(hour_slot::text, 2, '0') || ':00' order by hour_slot)
          from generate_series(
            extract(hour from b.start_time)::int,
            greatest(extract(hour from b.end_time)::int - 1, extract(hour from b.start_time)::int),
            1
          ) as hour_slot
        )
      end as slots
    from public.bookings b
    left join public.courts c on c.id = b.court_id
    where b.tenant_id = p_tenant_id
      and b.booking_date = p_new_date
      and b.status in ('Confirmed', 'Rescheduled')
      and b.id <> p_booking_id
      and (
        b.court_id = v_existing_booking.court_id
        or v_is_exclusive
        or coalesce(c.type, '') ilike '%exclusive%'
        or coalesce(c.type, '') ilike '%whole%'
      )
  )
  select array_agg(distinct requested.slot order by requested.slot)
  into v_conflicts
  from existing_bookings eb
  cross join lateral unnest(v_requested_slots) as requested(slot)
  where requested.slot = any(coalesce(eb.slots, array[]::text[]));

  if coalesce(array_length(v_conflicts, 1), 0) > 0 then
    raise exception 'ALREADY_BOOKED'
      using errcode = 'P0001',
            detail = array_to_string(v_conflicts, ',');
  end if;

  update public.bookings
  set
    booking_date = p_new_date,
    start_time = p_new_start_time,
    end_time = p_new_end_time,
    booked_times = to_jsonb(v_requested_slots),
    total_price = p_new_total_price,
    status = 'Rescheduled',
    rescheduled_from = jsonb_build_object(
      'original_date', p_original_date,
      'original_start_time', p_original_start_time,
      'original_end_time', p_original_end_time,
      'original_booked_times', p_original_booked_times,
      'original_total_price', v_existing_booking.total_price,
      'reason', p_reason,
      'rescheduled_at', now()
    )
  where id = p_booking_id
    and tenant_id = p_tenant_id
  returning * into v_updated_booking;

  return v_updated_booking;
end;
$$;

create or replace function public.create_owner_invoice(
  p_tenant_id uuid,
  p_period_start date,
  p_period_end date,
  p_external_reference text default null,
  p_notes text default null
)
returns public.owner_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.owner_invoices;
  v_count integer;
  v_total numeric(12, 2);
  v_currency text;
begin
  if not public.is_platform_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  select count(*), coalesce(sum(fee_amount), 0), coalesce(max(currency), 'PHP')
  into v_count, v_total, v_currency
  from public.booking_fee_ledger
  where tenant_id = p_tenant_id
    and invoice_id is null
    and status = 'unbilled'
    and created_at::date between p_period_start and p_period_end;

  insert into public.owner_invoices (
    tenant_id,
    invoice_number,
    period_start,
    period_end,
    booking_count,
    total_amount,
    currency,
    status,
    external_reference,
    notes,
    created_by
  )
  values (
    p_tenant_id,
    'INV-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || upper(substr(p_tenant_id::text, 1, 8)),
    p_period_start,
    p_period_end,
    coalesce(v_count, 0),
    coalesce(v_total, 0),
    coalesce(v_currency, 'PHP'),
    'draft',
    p_external_reference,
    p_notes,
    auth.uid()
  )
  returning * into v_invoice;

  update public.booking_fee_ledger
  set
    invoice_id = v_invoice.id,
    status = 'invoiced',
    invoiced_at = now()
  where tenant_id = p_tenant_id
    and invoice_id is null
    and status = 'unbilled'
    and created_at::date between p_period_start and p_period_end;

  return v_invoice;
end;
$$;

create or replace function public.mark_owner_invoice_paid(p_invoice_id uuid)
returns public.owner_invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.owner_invoices;
begin
  if not public.is_platform_admin() then
    raise exception 'NOT_AUTHORIZED' using errcode = '42501';
  end if;

  update public.owner_invoices
  set
    status = 'paid',
    paid_at = coalesce(paid_at, now())
  where id = p_invoice_id
  returning * into v_invoice;

  if not found then
    raise exception 'INVOICE_NOT_FOUND'
      using errcode = 'P0001',
            detail = p_invoice_id::text;
  end if;

  update public.booking_fee_ledger
  set
    status = 'paid',
    paid_at = coalesce(paid_at, now())
  where invoice_id = p_invoice_id;

  return v_invoice;
end;
$$;

insert into public.tenants (
  id,
  name,
  slug,
  custom_domain,
  contact_email,
  contact_phone,
  logo_url,
  hero_image_url,
  address,
  description,
  default_booking_fee_amount,
  default_booking_fee_currency,
  is_active
)
values (
  '00000000-0000-0000-0000-000000000001',
  'Pickle Point Cebu',
  'demo',
  'localhost',
  'admin@example.com',
  '',
  '/images/picklepointnewlogo.jpg',
  '/images/court1.jpg',
  'Cebu, Philippines',
  'Premium pickleball courts and community booking.',
  5.00,
  'PHP',
  true
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  custom_domain = excluded.custom_domain,
  is_active = excluded.is_active;

insert into public.tenant_fee_settings (tenant_id, fee_amount, currency, is_active)
values ('00000000-0000-0000-0000-000000000001', 5.00, 'PHP', true)
on conflict (tenant_id) do nothing;

insert into public.courts (
  tenant_id,
  name,
  type,
  price,
  description,
  images,
  pricing_rules,
  max_players,
  is_active,
  sort_order
)
values
  (
    '00000000-0000-0000-0000-000000000001',
    'Court 1',
    'Standard',
    350,
    'Outdoor pickleball court with night lighting.',
    '[{"path":"court1.jpg","url":"/images/court1.jpg"}]'::jsonb,
    '[]'::jsonb,
    10,
    true,
    10
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Court 2',
    'Standard',
    350,
    'Outdoor pickleball court with premium surface.',
    '[{"path":"court2.jpg","url":"/images/court2.jpg"}]'::jsonb,
    '[]'::jsonb,
    10,
    true,
    20
  ),
  (
    '00000000-0000-0000-0000-000000000001',
    'Exclusive / Whole Court',
    'Exclusive / Whole Court',
    700,
    'Reserve the whole court area for your group.',
    '[{"path":"court1.jpg","url":"/images/court1.jpg"}]'::jsonb,
    '[]'::jsonb,
    20,
    true,
    30
  )
on conflict do nothing;

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

grant usage on schema public to anon, authenticated;
grant select on public.tenants to anon, authenticated;
grant select on public.courts to anon, authenticated;
grant select on public.blocked_time_slots to anon, authenticated;
grant select on public.qr_codes to anon, authenticated;
grant select on public.public_booking_slots to anon, authenticated;
grant all on public.tenants to authenticated;
grant all on public.platform_admins to authenticated;
grant all on public.tenant_members to authenticated;
grant all on public.tenant_fee_settings to authenticated;
grant all on public.courts to authenticated;
grant all on public.bookings to authenticated;
grant all on public.blocked_time_slots to authenticated;
grant all on public.qr_codes to authenticated;
grant all on public.admin_audit_logs to authenticated;
grant all on public.owner_invoices to authenticated;
grant all on public.booking_fee_ledger to authenticated;

grant execute on function public.get_tenant_by_domain(text) to anon, authenticated;
grant execute on function public.current_booking_fee(uuid) to anon, authenticated;
grant execute on function public.create_booking_atomic(
  uuid,
  uuid,
  text,
  text,
  text,
  date,
  time without time zone,
  time without time zone,
  numeric,
  text,
  text,
  text[],
  text
) to anon, authenticated;
grant execute on function public.reschedule_booking_atomic(
  uuid,
  uuid,
  date,
  time without time zone,
  time without time zone,
  text[],
  numeric,
  text,
  date,
  time without time zone,
  time without time zone,
  text[]
) to authenticated;
grant execute on function public.create_owner_invoice(uuid, date, date, text, text) to authenticated;
grant execute on function public.mark_owner_invoice_paid(uuid) to authenticated;
