import { supabase } from '../lib/supabaseClient';

// Fallback values if the table doesn't exist yet or has no rows
const DEFAULTS = {
  gcash:  { image_url: '/images/gcash.jpg',  account_name: 'SYE SIMOLDE' },
  gotyme: { image_url: '/images/gotyme.jpg', account_name: 'SYE SIMOLDE' },
};

// Module-level cache
let qrCache = null;
let qrCacheTimestamp = null;
const QR_CACHE_TTL = 60_000; // 1 minute

export function invalidateQrCache() {
  qrCache = null;
  qrCacheTimestamp = null;
}

/**
 * Returns { gcash: { image_url, account_name }, gotyme: { image_url, account_name } }
 * Falls back to DEFAULTS on any error so the booking modal never breaks.
 */
export async function getQrCodes() {
  const now = Date.now();
  if (qrCache && qrCacheTimestamp && now - qrCacheTimestamp < QR_CACHE_TTL) {
    return qrCache;
  }

  try {
    const { data, error } = await supabase.from('qr_codes').select('*');
    if (error || !data || data.length === 0) return { ...DEFAULTS };

    const result = {
      gcash:  { ...DEFAULTS.gcash },
      gotyme: { ...DEFAULTS.gotyme },
    };
    for (const row of data) {
      if (row.id === 'gcash' || row.id === 'gotyme') {
        result[row.id] = {
          image_url:    row.image_url    || DEFAULTS[row.id].image_url,
          account_name: row.account_name || DEFAULTS[row.id].account_name,
        };
      }
    }

    qrCache = result;
    qrCacheTimestamp = now;
    return result;
  } catch {
    return { ...DEFAULTS };
  }
}

export const MAX_QR_FILE_SIZE_MB = 5;

/**
 * Compresses then uploads a QR image file to the `qr-images` bucket.
 * Rejects files over MAX_QR_FILE_SIZE_MB before compression.
 * Returns the public URL (with a cache-bust query param so browsers
 * don't serve a stale CDN copy of the previous QR for the same provider).
 */
export async function uploadQrImage(provider, file) {
  if (file.size > MAX_QR_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File is too large. Maximum size is ${MAX_QR_FILE_SIZE_MB} MB.`);
  }

  let fileToUpload = file;
  if (file.type.startsWith('image/')) {
    try {
      const { default: imageCompression } = await import('browser-image-compression');
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.3,          // Target ≤300 KB — plenty for a QR code
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
  // Always overwrite the same logical path per provider so the CDN
  // doesn't accumulate orphaned files, but append a timestamp as a
  // query-string cache-buster on the returned URL.
  const path = `${provider}_qr.${ext}`;
  const ts   = Date.now();

  const { error } = await supabase.storage
    .from('qr-images')
    .upload(path, fileToUpload, { upsert: true, contentType: fileToUpload.type });

  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage.from('qr-images').getPublicUrl(path);
  // Append cache-buster so the browser fetches the fresh image
  return `${urlData.publicUrl}?t=${ts}`;
}

/**
 * Upserts a QR code record (gcash or gotyme) in the `qr_codes` table.
 */
export async function updateQrCode(provider, { image_url, account_name }) {
  const { error } = await supabase.from('qr_codes').upsert({
    id: provider,
    image_url,
    account_name,
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Failed to save: ${error.message}`);
  invalidateQrCache();
}
