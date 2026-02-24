import { supabase } from '../lib/supabaseClient';

// --- In-memory cache for getAllBookings (admin) ---
const ALL_BOOKINGS_CACHE_TTL = 30_000; // 30 seconds
let allBookingsCache = null; // { data, timestamp } | null

export function invalidateAllBookingsCache() {
  allBookingsCache = null;
}

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
export async function uploadProofOfPayment(file, bookingId) {
  try {
    if (!file) {
      throw new Error('No file provided for upload');
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${bookingId}-${Date.now()}.${fileExt}`;
    const filePath = `booking-proofs/${fileName}`;

    const { error: uploadError, data: uploadData } = await supabase.storage
      .from('booking-proofs')
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(`Failed to upload proof of payment: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('booking-proofs')
      .getPublicUrl(filePath);

    const publicUrl = urlData?.publicUrl;

    if (!publicUrl) {
      throw new Error('Failed to generate public URL for uploaded file');
    }

    return publicUrl;
  } catch (err) {
    console.error('Upload proof of payment error:', err);
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
    .in('status', ['Confirmed', 'Rescheduled']);

  if (error) {
    console.error('Error fetching court bookings:', error);
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

// Check for time slot conflicts before booking
export async function checkTimeSlotConflicts(courtId, bookingDate, bookedTimes) {
  try {
    // Get all confirmed bookings for this court and date
    const { data: existingBookings, error } = await supabase
      .from('bookings')
      .select('booked_times, start_time, end_time, id')
      .eq('court_id', courtId)
      .eq('booking_date', bookingDate)
      .in('status', ['Confirmed', 'Rescheduled']);

    if (error) {
      console.error('Conflict check error:', error);
      throw new Error(`Failed to check conflicts: ${error.message}`);
    }

    if (!existingBookings || existingBookings.length === 0) {
      return { hasConflict: false, conflicts: [] };
    }

    // Check for overlapping time slots
    const conflicts = [];
    for (const booking of existingBookings) {
      const existingTimes = booking.booked_times || [];

      for (const requestedTime of bookedTimes) {
        if (existingTimes.includes(requestedTime)) {
          conflicts.push(requestedTime);
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts: conflicts
    };
  } catch (err) {
    console.error('Error checking time slot conflicts:', err);
    throw err;
  }
}

// Create booking with conflict prevention and verification
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
  // Retry logic for race conditions
  const maxRetries = 1;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt} after race condition...`);
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      }

      console.log('Starting booking creation...', { courtId, bookingDate, bookedTimes });

      // Step 1: Validate required fields
      if (!courtId || !customerName || !customerEmail || !customerPhone || !bookingDate) {
        throw new Error('Missing required booking information. Please fill in all fields.');
      }

      // Step 2: Check for conflicts BEFORE attempting to book
      console.log('Checking for conflicts...');
      const conflictCheck = await checkTimeSlotConflicts(courtId, bookingDate, bookedTimes);

      if (conflictCheck.hasConflict) {
        const conflictTimes = conflictCheck.conflicts.join(', ');
        throw new Error(
          `❌ Time slot conflict! The following times are already booked: ${conflictTimes}. Please refresh and select different time slots.`
        );
      }

      console.log('No conflicts found. Proceeding with booking...');

      // Step 3: Attempt to insert the booking
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
        console.error('Database insert error:', error);

        // Handle specific Supabase errors
        if (error.code === '23505') {
          // Race condition - someone booked between our check and insert
          if (attempt < maxRetries) {
            lastError = new Error('❌ Time slot conflict! Someone else just booked this time slot. Retrying...');
            continue; // Retry
          }
          throw new Error('❌ Time slot conflict! Someone else just booked this time slot. Please refresh the page and select a different time.');
        }
        if (error.code === 'PGRST116') {
          throw new Error('❌ Database connection failed. Please check your internet connection and try again.');
        }
        if (error.code === '42501') {
          throw new Error('❌ Permission denied. Please contact support if this issue persists.');
        }

        throw new Error(`❌ Booking failed: ${error.message}`);
      }

      // Step 4: Verify the booking was actually created
      if (!data || data.length === 0) {
        console.error('No data returned from insert operation');
        throw new Error('❌ Booking was not created. No data returned from database. Please try again or contact support.');
      }

      const bookingId = data[0].id;
      console.log('Booking inserted with ID:', bookingId);

      // Step 5: Double-check the booking exists in the database (verification)
      console.log('Verifying booking was saved...');
      const { data: verifyData, error: verifyError } = await supabase
        .from('bookings')
        .select('*, courts(name, type)')
        .eq('id', bookingId)
        .single();

      if (verifyError) {
        console.error('Verification error:', verifyError);
        throw new Error('⚠️ Booking was created but verification failed. Please check your bookings or contact support.');
      }

      if (!verifyData) {
        console.error('Verification returned no data');
        throw new Error('⚠️ Booking verification failed. The booking may not have been saved properly. Please contact support with booking ID: ' + bookingId);
      }

      console.log('Booking verified successfully:', verifyData);
      invalidateAllBookingsCache();
      return verifyData;

    } catch (err) {
      lastError = err;
      // If it's not a race condition (23505), throw immediately
      if (!err.message.includes('Time slot conflict') || attempt === maxRetries) {
        console.error('Create booking error:', err);
        throw err;
      }
      // Otherwise continue to retry
    }
  }

  // If we exhausted retries
  console.error('Create booking error after retries:', lastError);
  throw lastError;
}

// Get all bookings (admin) — cached
export async function getAllBookings({ force = false } = {}) {
  const now = Date.now();
  if (!force && allBookingsCache && now - allBookingsCache.timestamp < ALL_BOOKINGS_CACHE_TTL) {
    console.log('[getAllBookings] Returning cached data');
    return allBookingsCache.data;
  }

  const { data, error } = await supabase
    .from('bookings')
    .select('*, courts(name, type, price, pricing_rules)')
    .order('booking_date', { ascending: false });

  if (error) {
    console.error('Error fetching all bookings:', error);
    return [];
  }

  allBookingsCache = { data, timestamp: now };
  return data;
}

// Update booking status (admin)
export async function updateBookingStatus(bookingId, status) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', bookingId)
    .select();

  if (error) {
    console.error('Error updating booking status:', error);
    throw error;
  }

  invalidateAllBookingsCache();
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
      .select('id, status, booking_date, booked_times, total_price, court_id')
      .eq('id', bookingId)
      .single();

    if (checkError) {
      throw new Error(`Failed to verify booking: ${checkError.message}`);
    }

    if (!checkData) {
      throw new Error(`Booking with ID ${bookingId} not found`);
    }

    // Check for conflicts on the new date/time
    const conflictCheck = await checkTimeSlotConflicts(checkData.court_id, newDate, newBookedTimes);

    if (conflictCheck.hasConflict) {
      throw new Error(
        `Time slot conflict on new date. The following times are already booked: ${conflictCheck.conflicts.join(', ')}.`
      );
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
        original_total_price: checkData.total_price,
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
      throw new Error('Reschedule update returned no data. Please verify the booking was updated.');
    }

    invalidateAllBookingsCache();
    return data[0];
  } catch (err) {
    console.error('Reschedule booking error:', err);
    throw err;
  }
}