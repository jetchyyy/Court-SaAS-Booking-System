drop function if exists public.create_booking_atomic(
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
);

drop function if exists public.reschedule_booking_atomic(
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
);
