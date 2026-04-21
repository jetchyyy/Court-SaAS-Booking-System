create table if not exists public.tenant_site_content (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists tenant_site_content_touch_updated_at on public.tenant_site_content;
create trigger tenant_site_content_touch_updated_at
before update on public.tenant_site_content
for each row execute function public.touch_updated_at();

alter table public.tenant_site_content enable row level security;

drop policy if exists "public_read_active_tenant_site_content" on public.tenant_site_content;
create policy "public_read_active_tenant_site_content"
  on public.tenant_site_content for select
  to anon, authenticated
  using (public.tenant_is_active(tenant_id) or public.can_manage_tenant(tenant_id));

drop policy if exists "tenant_managers_manage_site_content" on public.tenant_site_content;
create policy "tenant_managers_manage_site_content"
  on public.tenant_site_content for all
  to authenticated
  using (public.can_manage_tenant(tenant_id))
  with check (public.can_manage_tenant(tenant_id));

insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do update
set public = true;

insert into storage.buckets (id, name, public)
values ('court-images', 'court-images', true)
on conflict (id) do update
set public = true;

insert into storage.buckets (id, name, public)
values ('booking-proofs', 'booking-proofs', true)
on conflict (id) do update
set public = true;

insert into storage.buckets (id, name, public)
values ('qr-images', 'qr-images', true)
on conflict (id) do update
set public = true;

drop policy if exists "public_read_site_images" on storage.objects;
create policy "public_read_site_images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'site-images');

drop policy if exists "tenant_managers_insert_site_images" on storage.objects;
create policy "tenant_managers_insert_site_images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'site-images'
    and public.can_manage_tenant((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "tenant_managers_update_site_images" on storage.objects;
create policy "tenant_managers_update_site_images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'site-images'
    and public.can_manage_tenant((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'site-images'
    and public.can_manage_tenant((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "tenant_managers_delete_site_images" on storage.objects;
create policy "tenant_managers_delete_site_images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'site-images'
    and public.can_manage_tenant((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "public_read_court_images" on storage.objects;
create policy "public_read_court_images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'court-images');

drop policy if exists "tenant_managers_insert_court_images" on storage.objects;
create policy "tenant_managers_insert_court_images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'court-images'
    and public.can_manage_tenant((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "tenant_managers_update_court_images" on storage.objects;
create policy "tenant_managers_update_court_images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'court-images'
    and public.can_manage_tenant((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'court-images'
    and public.can_manage_tenant((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "tenant_managers_delete_court_images" on storage.objects;
create policy "tenant_managers_delete_court_images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'court-images'
    and public.can_manage_tenant((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "public_read_booking_proofs" on storage.objects;
create policy "public_read_booking_proofs"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'booking-proofs');

drop policy if exists "public_insert_booking_proofs" on storage.objects;
create policy "public_insert_booking_proofs"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'booking-proofs'
    and public.tenant_is_active((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "tenant_managers_delete_booking_proofs" on storage.objects;
create policy "tenant_managers_delete_booking_proofs"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'booking-proofs'
    and public.can_manage_tenant((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "public_read_qr_images" on storage.objects;
create policy "public_read_qr_images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'qr-images');

drop policy if exists "tenant_managers_insert_qr_images" on storage.objects;
create policy "tenant_managers_insert_qr_images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'qr-images'
    and public.can_manage_tenant((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "tenant_managers_update_qr_images" on storage.objects;
create policy "tenant_managers_update_qr_images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'qr-images'
    and public.can_manage_tenant((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'qr-images'
    and public.can_manage_tenant((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "tenant_managers_delete_qr_images" on storage.objects;
create policy "tenant_managers_delete_qr_images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'qr-images'
    and public.can_manage_tenant((storage.foldername(name))[1]::uuid)
  );

insert into public.tenant_site_content (tenant_id, content)
select
  t.id,
  jsonb_build_object(
    'brand', jsonb_build_object(
      'name', coalesce(nullif(t.name, ''), 'Pickleball Courts'),
      'logoUrl', coalesce(nullif(t.logo_url, ''), ''),
      'shortLocation', 'Mandaue City'
    ),
    'splash', jsonb_build_object(
      'enabled', true,
      'title', coalesce(nullif(t.name, ''), 'The Pickle Point'),
      'subtitle', 'Cebu',
      'logoUrl', coalesce(nullif(t.logo_url, ''), ''),
      'initials', 'PP',
      'backgroundColor', '#174034',
      'accentColor', '#f97316',
      'textColor', '#ffffff',
      'durationMs', 2000
    ),
    'sections', jsonb_build_array(
      jsonb_build_object('id', 'hero', 'label', 'Hero', 'enabled', true),
      jsonb_build_object('id', 'offers', 'label', 'Offers', 'enabled', true),
      jsonb_build_object('id', 'courts', 'label', 'Courts', 'enabled', true),
      jsonb_build_object('id', 'contact', 'label', 'Contact', 'enabled', true),
      jsonb_build_object('id', 'parking', 'label', 'Parking', 'enabled', true)
    ),
    'hero', jsonb_build_object(
      'eyebrow', 'New courts available in Mandaue City',
      'titlePrefix', 'Book your next',
      'titleHighlight', 'Pickle Point',
      'description', coalesce(nullif(t.description, ''), 'Experience premium pickleball courts, easy online booking, and a welcoming community.'),
      'primaryCta', 'Book a Court',
      'stats', jsonb_build_array(
        jsonb_build_object('label', '50+ Active Players', 'icon', 'Users'),
        jsonb_build_object('label', 'Open 7 Days a Week', 'icon', 'Calendar')
      ),
      'slides', jsonb_build_array(
        jsonb_build_object('src', coalesce(nullif(t.hero_image_url, ''), '/images/picklepoint.jpg'), 'title', 'Center Court', 'subtitle', 'Premium Surface - Lighting'),
        jsonb_build_object('src', '/images/court1.jpg', 'title', 'Pro-Grade Surface', 'subtitle', 'Optimized for Performance'),
        jsonb_build_object('src', '/images/court2.jpg', 'title', 'Vibrant Community', 'subtitle', 'Join the Club')
      )
    ),
    'offers', jsonb_build_object(
      'title', 'What This Place Offers',
      'description', 'Enjoy premium amenities designed for your comfort and entertainment before and after your game.',
      'items', jsonb_build_array(
        jsonb_build_object('id', 'changing-room', 'title', 'Toilet & Changing Room', 'icon', 'ShowerHead'),
        jsonb_build_object('id', 'lounge', 'title', 'Lounge Area', 'icon', 'Armchair'),
        jsonb_build_object('id', 'parking', 'title', 'Parking', 'icon', 'Car'),
        jsonb_build_object('id', 'ping-pong', 'title', 'Ping Pong', 'icon', 'Volleyball'),
        jsonb_build_object('id', 'billiards', 'title', 'Billiards', 'icon', 'Gamepad2')
      )
    ),
    'courts', jsonb_build_object(
      'title', 'Choose Your Court',
      'description', 'Select from our professional-grade courts. When you tap Book Now, we will open a booking modal where you can choose an available date and time before filling in your details.'
    ),
    'contact', jsonb_build_object(
      'title', 'Get in Touch',
      'description', 'Have questions about court availability, tournaments, or coaching? Reach out to us or pay us a visit!',
      'phones', jsonb_build_array('(0929) 119 1087', '(0929) 677 5914'),
      'hoursTitle', 'Mon-Sun, 24 Hours',
      'hoursNote', '12AM-5AM (Advance Booking Required. No Walk-ins)',
      'email', coalesce(nullif(t.contact_email, ''), 'thepicklepointcebu@yahoo.com'),
      'locationName', coalesce(nullif(t.name, ''), 'Pickle Point- Cebu'),
      'address', coalesce(nullif(t.address, ''), '8WGV+J46 Centro, Mandaue, Cebu, Philippines'),
      'mapEmbedUrl', 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d307.9333774424817!2d123.94258601627138!3d10.326493210451394!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a999007b7ab781%3A0xa291446a335dd76e!2sPickle%20Point-%20Cebu!5e1!3m2!1sen!2sph!4v1769687613671!5m2!1sen!2sph',
      'socialText', 'For private event reservations, please feel free to contact us to discuss further details.',
      'facebookUrl', 'https://www.facebook.com/profile.php?id=61586304389627',
      'instagramUrl', 'https://www.instagram.com/thepicklepointcebu/'
    ),
    'parking', jsonb_build_object(
      'title', 'Parking Availability',
      'description', 'Secure parking options available nearby depending on your playing time.',
      'items', jsonb_build_array(
        jsonb_build_object('timeLabel', '6:00 AM - 8:00 PM', 'title', 'Mandaue City Parking Building', 'description', 'Located just a short walk from the courts.', 'mapEmbedUrl', 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1231.7332439194204!2d123.94227780570394!3d10.326561079742241!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a999b23fbbda97%3A0x873ce5859e106bfd!2sMandaue%20City%20Parking%20Building!5e1!3m2!1sen!2sph!4v1769845352536!5m2!1sen!2sph'),
        jsonb_build_object('timeLabel', '8:00 PM - 6:00 AM', 'title', 'Mandaue City Hall', 'description', 'Safe and secure parking at the City Hall grounds.', 'mapEmbedUrl', 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d615.8653893176781!2d123.94299730826987!3d10.327190424017024!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a999b240f0bd77%3A0xbfe6ac0f099de4a4!2sLANDBANK%20-%20Mandaue%20City%20Hall!5e1!3m2!1sen!2sph!4v1769845543147!5m2!1sen!2sph')
      )
    ),
    'footer', jsonb_build_object(
      'copyright', '(c) 2026 ' || coalesce(nullif(t.name, ''), 'The Pickle Point Cebu') || '. All rights reserved.',
      'creditLabel', 'Odyssey',
      'creditUrl', 'https://www.facebook.com/profile.php?id=61587269647950'
    )
  )
from public.tenants t
on conflict (tenant_id) do nothing;

grant all on public.tenant_site_content to authenticated;
grant select on public.tenant_site_content to anon, authenticated;
