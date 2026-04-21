import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.93.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function createSlug(value: string) {
  return String(value || 'tenant')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || `tenant-${Date.now()}`;
}

function generatePassword() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const token = btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 14);
  return `${token}Aa1!`;
}

function buildDefaultSiteContent(tenant: {
  name: string;
  contactEmail: string;
  contactPhone: string;
}) {
  const currentYear = new Date().getFullYear();

  return {
    brand: {
      name: tenant.name,
      logoUrl: '',
      shortLocation: 'Your Location',
    },
    sections: [
      { id: 'hero', label: 'Hero', enabled: true },
      { id: 'offers', label: 'Offers', enabled: true },
      { id: 'courts', label: 'Courts', enabled: true },
      { id: 'contact', label: 'Contact', enabled: true },
      { id: 'parking', label: 'Parking', enabled: true },
    ],
    hero: {
      eyebrow: 'Courts now open for booking',
      titlePrefix: 'Book your next',
      titleHighlight: tenant.name,
      description: 'Reserve a court online, choose your preferred time, and enjoy a smooth visit from arrival to game time.',
      primaryCta: 'Book a Court',
      stats: [
        { label: 'Easy Online Booking', icon: 'Calendar' },
        { label: 'Open for Groups', icon: 'Users' },
      ],
      slides: [
        { src: '/images/court1.jpg', title: 'Featured Court', subtitle: 'Ready for your next game' },
        { src: '/images/court2.jpg', title: 'Quality Play', subtitle: 'Comfortable court experience' },
      ],
    },
    offers: {
      title: 'What This Place Offers',
      description: 'Show guests the amenities and extras they can enjoy before and after their booking.',
      items: [
        { id: 'parking', title: 'Parking', icon: 'Car' },
        { id: 'lounge', title: 'Lounge Area', icon: 'Armchair' },
        { id: 'changing-room', title: 'Changing Room', icon: 'ShowerHead' },
      ],
    },
    courts: {
      title: 'Choose Your Court',
      description: 'Select a court, choose an available date and time, then submit your booking details.',
    },
    contact: {
      title: 'Get in Touch',
      description: 'Questions about availability, events, or group reservations? Reach out or visit the venue.',
      phones: tenant.contactPhone ? [tenant.contactPhone] : [],
      hoursTitle: 'Open daily',
      hoursNote: 'Update operating hours in the admin editor.',
      email: tenant.contactEmail,
      locationName: tenant.name,
      address: '',
      mapEmbedUrl: '',
      socialText: 'Follow us for updates and private event announcements.',
      facebookUrl: '',
      instagramUrl: '',
    },
    parking: {
      title: 'Parking Availability',
      description: 'Add nearby parking options so guests know where to go before their game.',
      items: [
        { timeLabel: 'Day Parking', title: 'Main Parking Area', description: 'Add directions or notes for guests.', mapEmbedUrl: '' },
      ],
    },
    footer: {
      copyright: `(c) ${currentYear} ${tenant.name}. All rights reserved.`,
      creditLabel: 'Odyssey',
      creditUrl: 'https://www.facebook.com/profile.php?id=61587269647950',
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[onboard-tenant-owner] Missing Supabase function secrets.');
    return jsonResponse({ error: 'Missing Supabase function secrets. Set SUPABASE_SERVICE_ROLE_KEY for the Edge Function.' }, 500);
  }

  const authorization = req.headers.get('Authorization') || '';
  const jwt = authorization.replace(/^Bearer\s+/i, '');

  if (!jwt) {
    return jsonResponse({ error: 'Missing authorization token.' }, 401);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser(jwt);
  const requester = authData?.user;

  if (authError || !requester) {
    console.error('[onboard-tenant-owner] Invalid requester token:', authError?.message);
    return jsonResponse({ error: 'Invalid authorization token.' }, 401);
  }

  const { data: platformAdmin, error: platformError } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', requester.id)
    .maybeSingle();

  if (platformError) {
    console.error('[onboard-tenant-owner] Platform admin check failed:', platformError.message);
    return jsonResponse({ error: platformError.message }, 500);
  }

  if (!platformAdmin) {
    console.error('[onboard-tenant-owner] Requester is not platform admin:', requester.id);
    return jsonResponse({ error: 'Only platform superadmins can onboard clients.' }, 403);
  }

  const body = await req.json().catch(() => null);
  const name = String(body?.name || '').trim();
  const customDomain = String(body?.customDomain || '').trim().toLowerCase();
  const ownerEmail = String(body?.ownerEmail || body?.contactEmail || '').trim().toLowerCase();
  const contactPhone = String(body?.contactPhone || '').trim();
  const feeAmount = Number(body?.defaultBookingFeeAmount ?? 5);
  const currency = String(body?.defaultBookingFeeCurrency || 'PHP').trim() || 'PHP';
  const suppliedPassword = String(body?.ownerPassword || '').trim();
  const temporaryPassword = suppliedPassword || generatePassword();

  if (!name || !customDomain || !ownerEmail) {
    return jsonResponse({ error: 'Business name, custom domain, and owner email are required.' }, 400);
  }

  if (temporaryPassword.length < 8) {
    return jsonResponse({ error: 'Owner password must be at least 8 characters.' }, 400);
  }

  let createdUserId: string | null = null;

  try {
    const { data: userData, error: createUserError } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        role: 'owner_admin',
        tenant_name: name,
      },
    });

    if (createUserError || !userData?.user) {
      throw createUserError || new Error('Owner account was not created.');
    }

    createdUserId = userData.user.id;

    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert([{
        name,
        slug: createSlug(name || customDomain),
        custom_domain: customDomain,
        contact_email: ownerEmail,
        contact_phone: contactPhone || null,
        default_booking_fee_amount: Number.isFinite(feeAmount) ? feeAmount : 5,
        default_booking_fee_currency: currency,
        is_active: true,
      }])
      .select()
      .single();

    if (tenantError || !tenant) {
      throw tenantError || new Error('Tenant was not created.');
    }

    const { error: feeError } = await supabase
      .from('tenant_fee_settings')
      .upsert({
        tenant_id: tenant.id,
        fee_amount: Number.isFinite(feeAmount) ? feeAmount : 5,
        currency,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

    if (feeError) throw feeError;

    const { error: memberError } = await supabase
      .from('tenant_members')
      .insert([{
        tenant_id: tenant.id,
        user_id: createdUserId,
        email: ownerEmail,
        role: 'owner_admin',
      }]);

    if (memberError) throw memberError;

    const { error: contentError } = await supabase
      .from('tenant_site_content')
      .insert([{
        tenant_id: tenant.id,
        content: buildDefaultSiteContent({
          name,
          contactEmail: ownerEmail,
          contactPhone,
        }),
      }]);

    if (contentError) throw contentError;

    return jsonResponse({
      tenant,
      owner: {
        id: createdUserId,
        email: ownerEmail,
        temporaryPassword,
        generatedPassword: !suppliedPassword,
      },
    });
  } catch (error) {
    console.error('[onboard-tenant-owner] Onboarding failed:', error);

    if (createdUserId) {
      await supabase.auth.admin.deleteUser(createdUserId).catch(() => null);
    }

    return jsonResponse({
      error: error instanceof Error ? error.message : 'Onboarding failed.',
    }, 400);
  }
});
