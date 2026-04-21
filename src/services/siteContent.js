import { supabase } from '../lib/supabaseClient';
import { appendAuditLog } from './auditLogs';
import { getCurrentTenant, getCurrentTenantId } from './tenants';

export const SECTION_IDS = ['hero', 'offers', 'courts', 'contact', 'parking'];

export const AMENITY_ICONS = [
  'ShowerHead',
  'Armchair',
  'Car',
  'Volleyball',
  'Gamepad2',
  'Wifi',
  'Coffee',
  'Users',
  'Clock',
  'MapPin',
];

function defaultSections() {
  return [
    { id: 'hero', label: 'Hero', enabled: true },
    { id: 'offers', label: 'Offers', enabled: true },
    { id: 'courts', label: 'Courts', enabled: true },
    { id: 'contact', label: 'Contact', enabled: true },
    { id: 'parking', label: 'Parking', enabled: true },
  ];
}

export function buildDefaultSiteContent(tenant = {}) {
  const tenantName = tenant?.name || 'Pickleball Courts';
  const contactEmail = tenant?.contact_email || '';
  const contactPhone = tenant?.contact_phone || '';
  const address = tenant?.address || '';

  return {
    brand: {
      name: tenantName,
      logoUrl: tenant?.logo_url || '',
      shortLocation: address ? address.split(',')[0] : 'Your Location',
    },
    splash: {
      enabled: true,
      title: tenantName,
      subtitle: address ? address.split(',')[0] : 'Welcome',
      logoUrl: tenant?.logo_url || '',
      initials: tenantName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0])
        .join('')
        .toUpperCase() || 'PC',
      backgroundColor: '#174034',
      accentColor: '#f97316',
      textColor: '#ffffff',
      durationMs: 2000,
    },
    sections: defaultSections(),
    hero: {
      eyebrow: 'Courts now open for booking',
      titlePrefix: 'Book your next',
      titleHighlight: tenantName,
      description: tenant?.description || 'Reserve a court online, choose your preferred time, and enjoy a smooth visit from arrival to game time.',
      primaryCta: 'Book a Court',
      stats: [
        { label: 'Easy Online Booking', icon: 'Calendar' },
        { label: 'Open for Groups', icon: 'Users' },
      ],
      slides: [
        { src: tenant?.hero_image_url || '/images/court1.jpg', title: 'Featured Court', subtitle: 'Ready for your next game' },
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
      phones: contactPhone ? [contactPhone] : [],
      hoursTitle: 'Open daily',
      hoursNote: 'Update operating hours in the admin editor.',
      email: contactEmail,
      locationName: tenantName,
      address,
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
      copyright: `(c) ${new Date().getFullYear()} ${tenantName}. All rights reserved.`,
      creditLabel: 'Odyssey',
      creditUrl: 'https://www.facebook.com/profile.php?id=61587269647950',
    },
  };
}

function cleanArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function mergeSectionOrder(sections) {
  const incoming = cleanArray(sections);
  const byId = new Map(defaultSections().map((section) => [section.id, section]));
  const result = [];
  const used = new Set();

  incoming.forEach((section) => {
    if (!SECTION_IDS.includes(section?.id) || used.has(section.id)) return;
    result.push({
      ...byId.get(section.id),
      ...section,
      enabled: section.enabled !== false,
    });
    used.add(section.id);
  });

  defaultSections().forEach((section) => {
    if (!used.has(section.id)) result.push(section);
  });

  return result;
}

export function normalizeSiteContent(content, tenant = {}) {
  const defaults = buildDefaultSiteContent(tenant);
  const source = content && typeof content === 'object' ? content : {};

  return {
    ...defaults,
    ...source,
    brand: { ...defaults.brand, ...(source.brand || {}) },
    splash: { ...defaults.splash, ...(source.splash || {}) },
    sections: mergeSectionOrder(source.sections),
    hero: {
      ...defaults.hero,
      ...(source.hero || {}),
      stats: cleanArray(source.hero?.stats, defaults.hero.stats),
      slides: cleanArray(source.hero?.slides, defaults.hero.slides).filter((slide) => slide?.src || slide?.title),
    },
    offers: {
      ...defaults.offers,
      ...(source.offers || {}),
      items: cleanArray(source.offers?.items, defaults.offers.items).map((item, index) => ({
        id: item?.id || `offer-${index + 1}`,
        title: item?.title || '',
        icon: item?.icon || 'Car',
      })),
    },
    courts: { ...defaults.courts, ...(source.courts || {}) },
    contact: {
      ...defaults.contact,
      ...(source.contact || {}),
      phones: cleanArray(source.contact?.phones, defaults.contact.phones),
    },
    parking: {
      ...defaults.parking,
      ...(source.parking || {}),
      items: cleanArray(source.parking?.items, defaults.parking.items),
    },
    footer: { ...defaults.footer, ...(source.footer || {}) },
  };
}

export async function getSiteContent({ force = false } = {}) {
  const tenant = await getCurrentTenant({ force });
  if (!tenant?.id) return normalizeSiteContent(null, tenant);

  const { data, error } = await supabase
    .from('tenant_site_content')
    .select('content')
    .eq('tenant_id', tenant.id)
    .maybeSingle();

  if (error) {
    console.error('getSiteContent error:', error);
    return normalizeSiteContent(null, tenant);
  }

  return normalizeSiteContent(data?.content, tenant);
}

export async function updateSiteContent(content) {
  const tenantId = await getCurrentTenantId({ force: true });
  const current = await getSiteContent({ force: true });
  const normalized = normalizeSiteContent({
    ...content,
    splash: {
      ...(content?.splash || {}),
      durationMs: current.splash.durationMs,
    },
    footer: {
      ...(content?.footer || {}),
      creditLabel: current.footer.creditLabel,
      creditUrl: current.footer.creditUrl,
    },
  });

  const { data, error } = await supabase
    .from('tenant_site_content')
    .upsert({
      tenant_id: tenantId,
      content: normalized,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  const { data: authData } = await supabase.auth.getUser();
  appendAuditLog({
    action: 'admin.site_content.update',
    description: 'Updated homepage website content',
    userId: authData?.user?.id || null,
    userEmail: authData?.user?.email || null,
    metadata: { sections: normalized.sections.map((section) => section.id) },
  });

  return normalizeSiteContent(data?.content);
}

export async function uploadSiteImage(file) {
  const tenantId = await getCurrentTenantId();
  if (!file) throw new Error('No image selected.');

  let fileToUpload = file;
  if (file.type?.startsWith('image/')) {
    try {
      const { default: imageCompression } = await import('browser-image-compression');
      fileToUpload = await imageCompression(file, {
        maxSizeMB: 0.6,
        maxWidthOrHeight: 2200,
        useWebWorker: true,
        initialQuality: 0.82,
      });
    } catch (err) {
      console.warn('[uploadSiteImage] Compression failed, using original image:', err);
    }
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '_');
  const path = `${tenantId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from('site-images')
    .upload(path, fileToUpload, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });

  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const { data } = supabase.storage.from('site-images').getPublicUrl(path);
  return { path, url: data.publicUrl };
}
