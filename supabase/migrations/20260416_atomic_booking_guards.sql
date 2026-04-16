create or replace function public.create_booking_atomic(
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
  v_is_exclusive boolean := coalesce(p_court_type, '') ilike '%exclusive%' or coalesce(p_court_type, '') ilike '%whole%';
  v_requested_slots text[];
  v_conflicts text[];
begin
  perform pg_advisory_xact_lock(hashtextextended(p_booking_date::text, 0));

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
  where bts.blocked_date = p_booking_date
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
        when coalesce(array_length(b.booked_times, 1), 0) > 0 then (
          select array_agg(distinct left(trim(slot), 5) order by left(trim(slot), 5))
          from unnest(b.booked_times) as slot
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
    where b.booking_date = p_booking_date
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
    v_requested_slots
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

create or replace function public.reschedule_booking_atomic(
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
  select *
  into v_existing_booking
  from public.bookings
  where id = p_booking_id;

  if not found then
    raise exception 'BOOKING_NOT_FOUND'
      using errcode = 'P0001',
            detail = p_booking_id::text;
  end if;

  select coalesce(type, '')
  into v_court_type
  from public.courts
  where id = v_existing_booking.court_id;

  v_is_exclusive := v_court_type ilike '%exclusive%' or v_court_type ilike '%whole%';

  perform pg_advisory_xact_lock(hashtextextended(p_new_date::text, 0));

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
  where bts.blocked_date = p_new_date
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
        when coalesce(array_length(b.booked_times, 1), 0) > 0 then (
          select array_agg(distinct left(trim(slot), 5) order by left(trim(slot), 5))
          from unnest(b.booked_times) as slot
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
    where b.booking_date = p_new_date
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
    booked_times = v_requested_slots,
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
  returning * into v_updated_booking;

  return v_updated_booking;
end;
$$;

grant execute on function public.create_booking_atomic(
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
) to anon, authenticated;
