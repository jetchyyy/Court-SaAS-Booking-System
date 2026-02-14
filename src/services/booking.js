import { supabase } from '../lib/supabaseClient';

// Calculate price based on time-based pricing rules
export function calculatePriceForSlots(timeSlots, court) {
  if (!timeSlots || timeSlots.length === 0) return court.price;

  const pricingRules = court.pricing_rules || [];
  if (pricingRules.length === 0) {
    // No pricing rules, use default rate
    return court.price * timeSlots.length;
  }

  let totalPrice = 0;

  for (const slot of timeSlots) {
    // Parse slot time (e.g., "10:00" or "10:00-11:00")
    const startTimeStr = slot.includes('-') ? slot.split('-')[0].trim() : slot.trim();
    const [hours] = startTimeStr.split(':').map(Number);

    // Find matching pricing rule
    let slotPrice = court.price; // Default to base price
    for (const rule of pricingRules) {
      const startHour = rule.startHour;
      const endHour = rule.endHour;

      // Check if hour falls within this pricing rule
      if (startHour <= endHour) {
        // Normal range (e.g., 6-15)
        if (hours >= startHour && hours < endHour) {
          slotPrice = rule.price;
          break;
        }
      } else {
        // Wrapping range (e.g., 16-6 for 4pm-6am)
        if (hours >= startHour || hours < endHour) {
          slotPrice = rule.price;
          break;
        }
      }
    }

    totalPrice += slotPrice;
  }

  return totalPrice;
}

// Upload proof of payment image
// Upload proof of payment image
export async function uploadProofOfPayment(file, bookingId) {
  try {
    // Compress image before uploading
    let fileToUpload = file;

    // Only compress if it's an image
    if (file.type.startsWith('image/')) {
      try {
        const { default: imageCompression } = await import('browser-image-compression');
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true
        };

        console.log(`Original file size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
        const compressedFile = await imageCompression(file, options);
        console.log(`Compressed file size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

        fileToUpload = compressedFile;
      } catch (compressionError) {
        console.error('Image compression failed, falling back to original file:', compressionError);
        // Fallback to original file if compression fails
      }
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${bookingId}-${Date.now()}.${fileExt}`;
    const filePath = `booking-proofs/${fileName}`;

    const { error: uploadError, data: uploadData } = await supabase.storage
      .from('booking-proofs')
      .upload(filePath, fileToUpload);

    if (uploadError) {
      throw new Error(`Failed to upload proof of payment: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('booking-proofs')
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl;

    return publicUrl;
  } catch (err) {
    throw err;
  }
}

// Get bookings for a court on a specific date
export async function getCourtBookings(courtId, date) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('court_id', courtId)
    .eq('booking_date', date)
    .eq('status', 'Confirmed');

  if (error) {
    return [];
  }

  return data;
}

// Get ALL bookings for a specific date (for conflict checks)
export async function getDailyBookings(date) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, courts(id, name, type)')
    .eq('booking_date', date)
    .in('status', ['Confirmed', 'Rescheduled']);

  if (error) {
    console.error('getDailyBookings error:', error);
    return [];
  }

  return data;
}

// Create booking
export async function createBooking({
  courtId,
  customerName,
  customerEmail,
  customerPhone,
  bookingDate,
  startTime,
  endTime,
  totalPrice,
  notes,
  proofOfPaymentUrl,
  bookedTimes = []
}) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .insert([{
        court_id: courtId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        total_price: totalPrice || 0,
        status: 'Confirmed',
        notes: notes || '',
        proof_of_payment_url: proofOfPaymentUrl || null,
        booked_times: bookedTimes.length > 0 ? bookedTimes : null
      }])
      .select();

    if (error) {
      throw new Error(`Booking failed: ${error.message}`);
    }

    return data?.[0];
  } catch (err) {
    throw err;
  }
}

// Get all bookings (admin)
export async function getAllBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, courts(name, type, price, pricing_rules)')
    .order('booking_date', { ascending: false });

  if (error) {
    return [];
  }

  return data;
}

// Update booking status (admin)
export async function updateBookingStatus(bookingId, status) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select();

  if (error) throw error;

  return data?.[0];
}

// Subscribe to bookings (real-time)
export function subscribeToBookings(callback) {
  return supabase
    .channel('bookings')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, callback)
    .subscribe();
}

// Reschedule booking
export async function rescheduleBooking({
  bookingId,
  newDate,
  newStartTime,
  newEndTime,
  newBookedTimes,
  newTotalPrice,
  reason,
  originalDate,
  originalStartTime,
  originalEndTime,
  originalBookedTimes
}) {
  try {
    // First, verify the booking exists and get its current total_price
    const { data: checkData, error: checkError } = await supabase
      .from('bookings')
      .select('id, status, booking_date, booked_times, total_price')
      .eq('id', bookingId);

    if (checkError) {
      throw new Error(`Failed to verify booking: ${checkError.message}`);
    }

    if (!checkData || checkData.length === 0) {
      throw new Error(`Booking with ID ${bookingId} not found`);
    }

    // Update the booking with new details and preserve original info
    const updatePayload = {
      booking_date: newDate,
      start_time: newStartTime,
      end_time: newEndTime,
      booked_times: newBookedTimes,
      total_price: newTotalPrice,
      status: 'Rescheduled',
      rescheduled_from: {
        original_date: originalDate,
        original_start_time: originalStartTime,
        original_end_time: originalEndTime,
        original_booked_times: originalBookedTimes,
        original_total_price: checkData[0].total_price,
        reason: reason,
        rescheduled_at: new Date().toISOString()
      }
    };

    const { data, error } = await supabase
      .from('bookings')
      .update(updatePayload)
      .eq('id', bookingId)
      .select('*, courts(name, type, price, pricing_rules)');

    if (error) {
      throw new Error(`Reschedule failed: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error('Update query returned no rows. Check RLS policies or booking permissions.');
    }

    return data[0];
  } catch (err) {
    throw err;
  }
}