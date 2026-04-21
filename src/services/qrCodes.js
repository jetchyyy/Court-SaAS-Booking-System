import { supabase } from '../lib/supabaseClient';
import { appendAuditLog } from './auditLogs';

export const MAX_QR_FILE_SIZE_MB = 5;

export const DEFAULT_QR_OPTIONS = [
  {
    id: 'gcash',
    label: 'GCash',
    image_url: '/images/gcash.jpg',
    account_name: 'SYE SIMOLDE',
    is_active: true,
    sort_order: 10,
  },
  {
    id: 'gotyme',
    label: 'GoTyme',
    image_url: '/images/gotyme.jpg',
    account_name: 'SYE SIMOLDE',
    is_active: true,
    sort_order: 20,
  },
];

let qrCache = null;
let qrCacheTimestamp = null;
const QR_CACHE_TTL = 60_000;

function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return url.split('?')[0];
}

function normalizeQrCode(row, index = 0) {
  const fallback = DEFAULT_QR_OPTIONS.find(option => option.id === row?.id);
  const label = row?.label || fallback?.label || row?.id || 'Payment Option';

  return {
    id: row?.id || createQrOptionId(label),
    label,
    image_url: normalizeImageUrl(row?.image_url) || fallback?.image_url || '',
    account_name: row?.account_name || fallback?.account_name || '',
    is_active: row?.is_active !== false,
    sort_order: Number.isFinite(Number(row?.sort_order))
      ? Number(row.sort_order)
      : fallback?.sort_order || (index + 1) * 10,
  };
}

function sortQrCodes(options) {
  return [...options].sort((a, b) => {
    const orderDiff = (a.sort_order || 0) - (b.sort_order || 0);
    if (orderDiff !== 0) return orderDiff;
    return a.label.localeCompare(b.label);
  });
}

function filterOptions(options, activeOnly) {
  return activeOnly ? options.filter(option => option.is_active) : options;
}

export function createQrOptionId(label) {
  const slug = String(label || 'payment')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);

  return `${slug || 'payment'}-${Date.now()}`;
}

export function invalidateQrCache() {
  qrCache = null;
  qrCacheTimestamp = null;
}

export async function getQrCodes({ activeOnly = false } = {}) {
  const now = Date.now();
  if (qrCache && qrCacheTimestamp && now - qrCacheTimestamp < QR_CACHE_TTL) {
    return filterOptions(qrCache, activeOnly);
  }

  try {
    const { data, error } = await supabase
      .from('qr_codes')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (error || !data || data.length === 0) {
      qrCache = sortQrCodes(DEFAULT_QR_OPTIONS.map(normalizeQrCode));
      qrCacheTimestamp = now;
      return filterOptions(qrCache, activeOnly);
    }

    const normalized = sortQrCodes(data.map(normalizeQrCode));
    qrCache = normalized.length > 0
      ? normalized
      : sortQrCodes(DEFAULT_QR_OPTIONS.map(normalizeQrCode));
    qrCacheTimestamp = now;
    return filterOptions(qrCache, activeOnly);
  } catch {
    return filterOptions(sortQrCodes(DEFAULT_QR_OPTIONS.map(normalizeQrCode)), activeOnly);
  }
}

export async function uploadQrImage(provider, file) {
  if (file.size > MAX_QR_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File is too large. Maximum size is ${MAX_QR_FILE_SIZE_MB} MB.`);
  }

  let fileToUpload = file;
  if (file.type.startsWith('image/')) {
    try {
      const { default: imageCompression } = await import('browser-image-compression');
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        initialQuality: 0.85,
      });
      fileToUpload = new File([compressed], file.name, { type: compressed.type || file.type });
    } catch (err) {
      console.warn('[uploadQrImage] Compression failed, uploading original:', err);
    }
  }

  const ext = fileToUpload.name.split('.').pop() || 'jpg';
  const safeProvider = String(provider || 'payment').replace(/[^a-zA-Z0-9_-]/g, '-');
  const path = `${safeProvider}_qr.${ext}`;

  const { error } = await supabase.storage
    .from('qr-images')
    .upload(path, fileToUpload, {
      upsert: true,
      contentType: fileToUpload.type,
      cacheControl: '60',
    });

  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage.from('qr-images').getPublicUrl(path);
  return normalizeImageUrl(urlData.publicUrl);
}

export async function createQrCode({ label, image_url = '', account_name = '', sort_order = 0 }) {
  const id = createQrOptionId(label);
  await saveQrCode(id, {
    label,
    image_url,
    account_name,
    is_active: true,
    sort_order,
  }, 'created');

  return id;
}

export async function updateQrCode(provider, updates) {
  await saveQrCode(provider, updates, 'updated');
}

async function saveQrCode(provider, updates, actionLabel) {
  const payload = {
    id: provider,
    updated_at: new Date().toISOString(),
  };

  if ('label' in updates) payload.label = String(updates.label || '').trim();
  if ('image_url' in updates) payload.image_url = normalizeImageUrl(updates.image_url);
  if ('account_name' in updates) payload.account_name = String(updates.account_name || '').trim();
  if ('is_active' in updates) payload.is_active = updates.is_active !== false;
  if ('sort_order' in updates) payload.sort_order = Number(updates.sort_order) || 0;

  if (!payload.label && actionLabel === 'created') {
    throw new Error('Payment option name is required.');
  }

  const { error } = await supabase.from('qr_codes').upsert(payload);
  if (error) throw new Error(`Failed to save: ${error.message}`);

  const { data: authData } = await supabase.auth.getUser();
  appendAuditLog({
    action: 'admin.qr.update',
    description: `${actionLabel === 'created' ? 'Created' : 'Updated'} QR payment option`,
    userId: authData?.user?.id || null,
    userEmail: authData?.user?.email || null,
    metadata: {
      provider,
      label: payload.label,
      isActive: payload.is_active,
      hasImage: !!payload.image_url,
      hasAccountName: !!payload.account_name,
    },
  });

  invalidateQrCache();
}
