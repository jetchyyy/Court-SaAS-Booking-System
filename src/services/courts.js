import { supabase } from '../lib/supabaseClient';

// --- Simple in-memory cache for listCourts ---
const CACHE_TTL_MS = 30_000; // 30 seconds
let courtsCache = null;      // { data: [], timestamp: number } | null

export function invalidateCourtsCache() {
  courtsCache = null;
}

// Upload images to storage
export async function uploadCourtImages(files) {
  const results = [];

  console.log(`[uploadCourtImages] Starting upload for ${files.length} file(s)`);

  for (const file of files) {
    let fileToUpload = file;
    const originalType = file.type;

    // Compress image if it's an image file
    if (originalType.startsWith('image/')) {
      try {
        const { default: imageCompression } = await import('browser-image-compression');
        const options = {
          maxSizeMB: 0.4, // Target 400KB
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          initialQuality: 0.8
        };

        console.log(`[uploadCourtImages] Original: ${file.name} (${(file.size / 1024).toFixed(0)} KB, type: ${originalType})`);
        const compressedFile = await imageCompression(file, options);
        console.log(`[uploadCourtImages] Compressed: ${(compressedFile.size / 1024).toFixed(0)} KB`);
        fileToUpload = compressedFile;
      } catch (err) {
        console.error('[uploadCourtImages] Compression failed, using original:', err);
      }
    }

    const unique = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    console.log(`[uploadCourtImages] Uploading as: ${unique}, contentType: ${originalType || 'image/jpeg'}`);

    const { error } = await supabase.storage
      .from('court-images')
      .upload(unique, fileToUpload, {
        contentType: originalType || 'image/jpeg',
      });

    if (error) {
      console.error('[uploadCourtImages] Supabase upload error:', error);
      throw new Error(`Image upload failed: ${error.message}`);
    }

    console.log(`[uploadCourtImages] Uploaded successfully: ${unique}`);

    const { data: urlData } = supabase.storage
      .from('court-images')
      .getPublicUrl(unique);

    results.push({
      path: unique,
      url: urlData.publicUrl
    });
  }

  console.log(`[uploadCourtImages] Done. ${results.length} image(s) uploaded.`);
  return results;
}

// List all courts (cached)
export async function listCourts({ force = false } = {}) {
  const now = Date.now();
  if (!force && courtsCache && now - courtsCache.timestamp < CACHE_TTL_MS) {
    console.log('[listCourts] Returning cached data');
    return courtsCache.data;
  }

  const { data, error } = await supabase
    .from('courts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('listCourts error:', error);
    return [];
  }

  courtsCache = { data, timestamp: now };
  return data;
}

// Get single court with bookings
export async function getCourt(courtId) {
  const { data, error } = await supabase
    .from('courts')
    .select('*, bookings(*)')
    .eq('id', courtId)
    .single();

  if (error) {
    console.error('getCourt error:', error);
    return null;
  }

  return data;
}

// Create court (admin only)
export async function createCourt({ name, type, price, description, imageFiles, pricingRules, maxPlayers }) {
  const images = await uploadCourtImages(Array.from(imageFiles || []));

  const { data: user } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('courts')
    .insert([{
      name,
      type,
      price,
      description,
      admin_id: user.user.id,
      images, // store array of { path, url }
      pricing_rules: pricingRules || [], // store time-based pricing rules
      max_players: maxPlayers || 10 // store max players capacity
    }])
    .select();

  if (error) {
    console.error('createCourt error:', error);
    throw error;
  }

  invalidateCourtsCache();
  return data?.[0];
}

// Update court (admin only)
export async function updateCourt(courtId, { name, type, price, description, imageFiles, pricingRules, maxPlayers }) {
  // Upload new images if provided
  let newImages = [];
  const filesArray = imageFiles ? Array.from(imageFiles) : [];

  console.log(`[updateCourt] courtId=${courtId}, filesCount=${filesArray.length}`);

  if (filesArray.length > 0) {
    // Fetch old images before uploading new ones
    const { data: currentCourt } = await supabase
      .from('courts')
      .select('images')
      .eq('id', courtId)
      .single();

    newImages = await uploadCourtImages(filesArray);

    // Remove old images from storage after successful upload
    if (newImages.length > 0 && currentCourt?.images?.length > 0) {
      const pathsToDelete = currentCourt.images.map(img => img.path);
      console.log(`[updateCourt] Deleting old images:`, pathsToDelete);
      await supabase.storage.from('court-images').remove(pathsToDelete);
    }
  }

  const updateData = {
    name,
    type,
    price,
    description
  };

  // Only update images if new ones were uploaded successfully
  if (newImages.length > 0) {
    updateData.images = newImages;
  }

  // Update pricing rules if provided
  if (pricingRules) {
    updateData.pricing_rules = pricingRules;
  }

  // Update max players if provided
  if (maxPlayers !== undefined) {
    updateData.max_players = maxPlayers;
  }

  console.log(`[updateCourt] Sending updateData to DB:`, JSON.stringify(updateData));

  const { data, error } = await supabase
    .from('courts')
    .update(updateData)
    .eq('id', courtId)
    .select();

  if (error) {
    console.error('[updateCourt] DB update error:', error);
    throw error;
  }

  invalidateCourtsCache();
  console.log(`[updateCourt] DB update result:`, JSON.stringify(data));
  return data?.[0];
}

// Toggle court active status (admin only)
export async function toggleCourtStatus(courtId, isActive) {
  const { data, error } = await supabase
    .from('courts')
    .update({ is_active: isActive })
    .eq('id', courtId)
    .select();

  if (error) {
    console.error('toggleCourtStatus error:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.error('No data returned from update - court may not exist or update failed silently');
    throw new Error('Failed to update court status');
  }

  invalidateCourtsCache();
  return data?.[0];
}

// Delete court (admin only)
export async function deleteCourt(courtId) {
  const { data: court } = await supabase
    .from('courts')
    .select('images')
    .eq('id', courtId)
    .single();

  // Delete images from storage
  if (court?.images?.length) {
    const paths = court.images.map(img => img.path);
    await supabase.storage.from('court-images').remove(paths);
  }

  const { error } = await supabase
    .from('courts')
    .delete()
    .eq('id', courtId);

  if (error) throw error;
  invalidateCourtsCache();
}

// Subscribe to court changes (real-time)
export function subscribeToCourts(callback) {
  return supabase
    .channel('courts')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'courts' }, callback)
    .subscribe();
}