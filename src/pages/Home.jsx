import { startOfToday, format } from 'date-fns';
import { useState, useEffect } from 'react';
import { BookingCalendar } from '../components/BookingCalendar';
import { BookingModal } from '../components/BookingModal';
import { Button } from '../components/ui';
import { Contact } from '../components/Contact';
import { Offers } from '../components/Offers';
import { Parking } from '../components/Parking';
import { CourtCard } from '../components/CourtCard';
import { Footer } from '../components/Footer';
import { Hero } from '../components/Hero';
import { Navbar } from '../components/Navbar';
import { listCourts, subscribeToCourts } from '../services/courts';
import { getCourtBookings, subscribeToBookings } from '../services/booking';
import { orderCourtsForHomepage } from '../lib/courtDisplayOrder';

const ACTIVE_BOOKING_STATUSES = new Set(['Confirmed', 'Rescheduled']);

// --- Simple in-memory caches for booking data ---
const BOOKING_CACHE_TTL = 30_000; // 30 seconds
const bookingCache = {};   // key: `daily-${courtId}-${date}` => { data, timestamp }
const blockedCache = {};   // key: `blocked-${courtId}-${date}` => { data, timestamp }
const monthlyCache = {};   // key: `monthly-${courtId}-${yyyy-MM}` => { data, timestamp }

function getCached(cache, key) {
    const entry = cache[key];
    if (entry && Date.now() - entry.timestamp < BOOKING_CACHE_TTL) return entry.data;
    return null;
}

function setCache(cache, key, data) {
    cache[key] = { data, timestamp: Date.now() };
}

function invalidateBookingCaches() {
    Object.keys(bookingCache).forEach(k => delete bookingCache[k]);
    Object.keys(blockedCache).forEach(k => delete blockedCache[k]);
    Object.keys(monthlyCache).forEach(k => delete monthlyCache[k]);
}

export function Home() {
    const [selectedCourt, setSelectedCourt] = useState(null);
    const [selectedDate, setSelectedDate] = useState(startOfToday());
    const [selectedTimes, setSelectedTimes] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeCourts, setActiveCourts] = useState([]);
    const [courtBookings, setCourtBookings] = useState([]);
    const [blockedSlots, setBlockedSlots] = useState([]);
    const [validationError, setValidationError] = useState('');
    const [loading, setLoading] = useState(false);

    const visibleCourts = orderCourtsForHomepage(
        (activeCourts || []).filter((court) => court.is_active !== false)
    );

    const isExclusiveCourtType = (courtType = '') => {
        return courtType.includes('Exclusive') || courtType.includes('Whole');
    };

    // Load courts from Supabase (uses listCourts cache from courts.js)
    useEffect(() => {
        loadCourts();

        // Patch local state directly from real-time payload instead of re-fetching
        const subscription = subscribeToCourts((payload) => {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            if (eventType === 'INSERT') {
                setActiveCourts(prev => [newRecord, ...prev]);
            } else if (eventType === 'UPDATE') {
                setActiveCourts(prev => prev.map(c => c.id === newRecord.id ? newRecord : c));
            } else if (eventType === 'DELETE') {
                setActiveCourts(prev => prev.filter(c => c.id !== oldRecord.id));
            }
        });

        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, []);

    const loadCourts = async () => {
        try {
            const courts = await listCourts();
            setActiveCourts(courts || []);
        } catch (err) {
            setActiveCourts([]);
        }
    };

    // Load bookings when court or date changes
    useEffect(() => {
        if (selectedCourt) {
            loadBookings();
            loadBlockedSlots();
            loadMonthlyBookings();

            const subscription = subscribeToBookings((payload) => {
                const eventType = payload?.eventType;
                const records = [payload?.new, payload?.old].filter(Boolean);
                if (records.length === 0) return;

                const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
                const selectedMonth = selectedDate.getMonth();
                const selectedYear = selectedDate.getFullYear();
                const selectedIsExclusive = isExclusiveCourtType(selectedCourt?.type || '');
                const exclusiveCourtIds = new Set(
                    (activeCourts || [])
                        .filter(c => isExclusiveCourtType(c?.type || ''))
                        .map(c => c.id)
                );

                const touchesSelectedCourtContext = records.some((record) => {
                    if (selectedIsExclusive) return true;
                    return record.court_id === selectedCourt.id || exclusiveCourtIds.has(record.court_id);
                });

                if (!touchesSelectedCourtContext) return;

                const touchesSelectedDay = records.some((record) => {
                    if (!record?.booking_date) return false;
                    if (eventType === 'DELETE') return record.booking_date === selectedDateStr;
                    return record.booking_date === selectedDateStr;
                });

                const touchesSelectedMonth = records.some((record) => {
                    if (!record?.booking_date) return false;
                    const [y, m] = record.booking_date.split('-').map(Number);
                    if (!y || !m) return false;
                    return y === selectedYear && m - 1 === selectedMonth;
                });

                if (touchesSelectedDay) {
                    loadBookings({ force: true });
                }
                if (touchesSelectedMonth) {
                    loadMonthlyBookings({ force: true });
                }
            });

            // Listen for booking conflict events from the modal
            const handleBookingConflict = () => {
                console.log('⚠️ Booking conflict detected - refreshing time slots...');
                invalidateBookingCaches();
                loadBookings({ force: true });
                loadMonthlyBookings({ force: true });
                setSelectedTimes([]);
            };

            window.addEventListener('bookingConflict', handleBookingConflict);

            return () => {
                if (subscription) {
                    subscription.unsubscribe();
                }
                window.removeEventListener('bookingConflict', handleBookingConflict);
            };
        }
    }, [selectedCourt, selectedDate, activeCourts]);

    const loadBookings = async ({ force = false } = {}) => {
        if (!selectedCourt) return;

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const cacheKey = `daily-${selectedCourt.id}-${dateStr}`;

        if (!force) {
            const cached = getCached(bookingCache, cacheKey);
            if (cached) {
                console.log('[Home] Returning cached daily bookings');
                setCourtBookings(cached);
                return;
            }
        }

        try {
            setLoading(true);
            const { getDailyBookings } = await import('../services/booking');
            const bookings = await getDailyBookings(dateStr);
            const result = bookings || [];
            setCache(bookingCache, cacheKey, result);
            setCourtBookings(result);
        } catch (err) {
            setCourtBookings([]);
        } finally {
            setLoading(false);
        }
    };

    const loadBlockedSlots = async ({ force = false } = {}) => {
        if (!selectedCourt) return;

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const isExclusive = selectedCourt.type === 'Exclusive / Whole Court';
        const cacheKey = isExclusive
            ? `blocked-all-${dateStr}`
            : `blocked-${selectedCourt.id}-${dateStr}`;

        if (!force) {
            const cached = getCached(blockedCache, cacheKey);
            if (cached) {
                console.log('[Home] Returning cached blocked slots');
                setBlockedSlots(cached);
                return;
            }
        }

        try {
            const { supabase } = await import('../lib/supabaseClient');

            let q = supabase
                .from('blocked_time_slots')
                .select('time_slot')
                .eq('blocked_date', dateStr);

            if (isExclusive && activeCourts.length > 0) {
                // For exclusive courts, a block on ANY court blocks this slot
                q = q.in('court_id', activeCourts.map(c => c.id));
            } else {
                q = q.eq('court_id', selectedCourt.id);
            }

            const { data, error } = await q;

            if (error) {
                console.error('Error loading blocked slots:', error);
                setBlockedSlots([]);
            } else {
                // Deduplicate — multiple courts may have the same slot blocked
                const result = [...new Set(data?.map(item => item.time_slot) || [])];
                setCache(blockedCache, cacheKey, result);
                setBlockedSlots(result);
            }
        } catch (err) {
            console.error('Error loading blocked slots:', err);
            setBlockedSlots([]);
        }
    };

    const [monthlyBookings, setMonthlyBookings] = useState([]);

    const loadMonthlyBookings = async ({ force = false } = {}) => {
        if (!selectedCourt) return;

        const monthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
        const cacheKey = `monthly-${selectedCourt.id}-${monthKey}`;

        if (!force) {
            const cached = getCached(monthlyCache, cacheKey);
            if (cached) {
                console.log('[Home] Returning cached monthly bookings');
                setMonthlyBookings(cached);
                return;
            }
        }

        try {
            const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

            const { supabase } = await import('../lib/supabaseClient');
            const { data, error } = await supabase
                .from('bookings')
                .select('id, court_id, booking_date, start_time, end_time, booked_times, status, courts(id, type)')
                .gte('booking_date', format(startOfMonth, 'yyyy-MM-dd'))
                .lte('booking_date', format(endOfMonth, 'yyyy-MM-dd'))
                .in('status', ['Confirmed', 'Rescheduled']);

            if (error) {
                setMonthlyBookings([]);
            } else {
                const result = data || [];
                setCache(monthlyCache, cacheKey, result);
                setMonthlyBookings(result);
            }
        } catch (err) {
            setMonthlyBookings([]);
        }
    };

    const handleBookClick = (court) => {
        const isActive = court.is_active !== false;
        if (!isActive) {
            setValidationError("⚠️ This court is currently unavailable for booking.");
            return;
        }

        setSelectedCourt(court);
        setValidationError('');
        setSelectedTimes([]);
        document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleDateSelect = (date) => {
        setSelectedDate(date);
        setSelectedTimes([]);
        setValidationError('');
    };

    const getBookedTimes = () => {
        const bookedSlots = new Set();

        blockedSlots.forEach(slot => {
            bookedSlots.add(slot.substring(0, 5));
        });

        const today = startOfToday();
        const isToday = format(selectedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

        if (isToday) {
            const now = new Date();
            const currentHour = now.getHours();

            for (let hour = 0; hour <= currentHour; hour++) {
                const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
                bookedSlots.add(timeSlot);
            }
        }

        if (!courtBookings || courtBookings.length === 0) {
            return Array.from(bookedSlots);
        }

        const isExclusiveSelected = selectedCourt?.type?.includes('Exclusive') || selectedCourt?.type?.includes('Whole');

        courtBookings.forEach(booking => {
            let isConflict = false;

            if (booking.court_id === selectedCourt.id) {
                isConflict = true;
            } else if (isExclusiveSelected) {
                isConflict = true;
            } else if (booking.courts?.type?.includes('Exclusive') || booking.courts?.type?.includes('Whole')) {
                isConflict = true;
            }

            if (isConflict && booking.start_time && booking.end_time) {
                const startTime = booking.start_time.substring(0, 5);
                const endTime = booking.end_time.substring(0, 5);

                if (booking.booked_times && Array.isArray(booking.booked_times) && booking.booked_times.length > 0) {
                    booking.booked_times.forEach(time => {
                        if (time && typeof time === 'string') {
                            const normalizedTime = time.substring(0, 5);
                            bookedSlots.add(normalizedTime);
                        }
                    });
                } else {
                    const [startHour] = startTime.split(':').map(Number);
                    const [endHour] = endTime.split(':').map(Number);

                    for (let hour = startHour; hour < endHour; hour++) {
                        const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
                        bookedSlots.add(timeSlot);
                    }
                }
            }
        });
        return Array.from(bookedSlots);
    };

    const getFullyBookedDates = () => {
        if (!selectedCourt || !monthlyBookings || monthlyBookings.length === 0) return [];

        const isExclusiveSelected = selectedCourt?.type?.includes('Exclusive') || selectedCourt?.type?.includes('Whole');
        const allTimeSlots = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
        const totalSlots = allTimeSlots.length;
        const bookingsByDate = {};

        monthlyBookings.forEach(booking => {
            const bookingDate = booking.booking_date;
            let isConflict = false;

            if (booking.court_id === selectedCourt.id) {
                isConflict = true;
            } else if (isExclusiveSelected) {
                isConflict = true;
            } else if (booking.courts?.type?.includes('Exclusive') || booking.courts?.type?.includes('Whole')) {
                isConflict = true;
            }

            if (!isConflict) return;

            if (!bookingsByDate[bookingDate]) {
                bookingsByDate[bookingDate] = new Set();
            }

            if (booking.booked_times && Array.isArray(booking.booked_times) && booking.booked_times.length > 0) {
                booking.booked_times.forEach(time => {
                    if (time && typeof time === 'string') {
                        const normalizedTime = time.substring(0, 5);
                        bookingsByDate[bookingDate].add(normalizedTime);
                    }
                });
            } else if (booking.start_time && booking.end_time) {
                const startTime = booking.start_time.substring(0, 5);
                const endTime = booking.end_time.substring(0, 5);
                const [startHour] = startTime.split(':').map(Number);
                const [endHour] = endTime.split(':').map(Number);

                for (let hour = startHour; hour < endHour; hour++) {
                    const timeSlot = `${hour.toString().padStart(2, '0')}:00`;
                    bookingsByDate[bookingDate].add(timeSlot);
                }
            }
        });

        const dateStatuses = [];
        Object.keys(bookingsByDate).forEach(date => {
            const bookedSlotsCount = bookingsByDate[date].size;

            if (bookedSlotsCount >= totalSlots) {
                dateStatuses.push({ date, status: 'fully-booked' });
            } else if (bookedSlotsCount > 0) {
                dateStatuses.push({ date, status: 'partially-booked' });
            }
        });

        return dateStatuses;
    };

    const bookedTimes = getBookedTimes();
    const fullyBookedDates = getFullyBookedDates();

    const handleBookingConfirm = async (bookingData) => {
        try {
            const { createBooking, uploadProofOfPayment } = await import('../services/booking');

            const timeSlots = bookingData.times && bookingData.times.length > 0
                ? bookingData.times
                : [bookingData.time];

            if (!timeSlots || timeSlots.length === 0) {
                throw new Error('No time slots selected');
            }

            const sortedSlots = [...timeSlots].sort();
            const firstSlot = sortedSlots[0];
            const lastSlot = sortedSlots[sortedSlots.length - 1];

            let startTime = '08:00';
            if (firstSlot && typeof firstSlot === 'string') {
                if (firstSlot.includes('-')) {
                    startTime = firstSlot.split('-')[0].trim();
                } else {
                    startTime = firstSlot.trim();
                }
            }

            let endTime = '09:00';
            if (lastSlot && typeof lastSlot === 'string') {
                let lastSlotTime = lastSlot.trim();
                if (lastSlot.includes('-')) {
                    lastSlotTime = lastSlot.split('-')[0].trim();
                }
                const [hours, minutes] = lastSlotTime.split(':');
                const endHour = parseInt(hours) + 1;
                endTime = `${endHour.toString().padStart(2, '0')}:${minutes}`;
            }

            let proofOfPaymentUrl = null;
            if (bookingData.paymentProof) {
                try {
                    const tempId = `temp-${Date.now()}`;
                    proofOfPaymentUrl = await uploadProofOfPayment(bookingData.paymentProof, tempId);

                    if (!proofOfPaymentUrl) {
                        throw new Error('Failed to get upload URL');
                    }
                } catch (uploadErr) {
                    throw new Error('Failed to upload proof of payment. Please try again.');
                }
            }

            const newBooking = await createBooking({
                courtId: selectedCourt.id,
                customerName: bookingData.name,
                customerEmail: bookingData.email,
                customerPhone: bookingData.phone,
                bookingDate: format(selectedDate, 'yyyy-MM-dd'),
                startTime: startTime,
                endTime: endTime,
                totalPrice: bookingData.totalPrice || 0,
                notes: bookingData.reference || '',
                proofOfPaymentUrl: proofOfPaymentUrl,
                bookedTimes: sortedSlots,
                courtType: selectedCourt.type
            });

            // ✅ FIXED: Don't close modal here - let modal show success screen first!
            invalidateBookingCaches();
            await loadBookings({ force: true });
            // NOTE: setSelectedTimes([]) is intentionally NOT here.
            // Clearing times here would wipe bookingData.times before step 5 renders,
            // causing the receipt to show '-' for time. Times are cleared in onClose instead.

            return newBooking; // Return booking so modal can display it

        } catch (err) {
            invalidateBookingCaches();
            await loadBookings({ force: true }); // Refresh on error
            throw err; // Re-throw so modal can display the error
        }
    };

    return (
        <div className="min-h-screen bg-bg-user font-sans text-brand-green-dark selection:bg-brand-orange-light selection:text-brand-orange">
            <Navbar />
            <Hero />
            <Offers />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24 pb-20">

                <section id="courts">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Choose Your Court</h2>
                        <p className="text-gray-600">Select from our professional-grade courts. Whether you prefer center court action or a casual game, we have the perfect spot for you.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {visibleCourts.map((court) => (
                            <CourtCard key={court.id} court={court} onBook={handleBookClick} />
                        ))}
                    </div>
                </section>

                <section id="booking-section" className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 flex flex-col lg:flex-row gap-12">
                    <div className="lg:w-1/3 space-y-6">
                        <div className="inline-block px-3 py-1 bg-brand-orange-light text-brand-orange text-xs font-bold uppercase tracking-wider rounded-full">
                            Step 1 & 2
                        </div>
                        <h2 className="text-3xl font-display font-bold">Plan Your Game</h2>
                        <p className="text-gray-600 leading-relaxed">
                            Select a date and time that works for you. Our real-time availability ensures you get the slot you want.
                            <br /><br />
                            {selectedCourt ? (
                                <span className="block p-4 bg-brand-green-light rounded-xl border border-brand-green/20">
                                    You are booking: <span className="font-bold block text-lg">{selectedCourt.name}</span>
                                </span>
                            ) : (
                                <span className="block p-4 bg-red-50 rounded-xl border border-red-100 text-red-600 text-sm">
                                    Please select a court in the section above to proceed.
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="lg:w-2/3">
                        <BookingCalendar
                            selectedDate={selectedDate}
                            onDateSelect={handleDateSelect}
                            selectedTimes={selectedTimes}
                            bookedTimes={bookedTimes}
                            fullyBookedDates={fullyBookedDates}
                            onTimeSelect={(time) => {
                                if (!selectedCourt) {
                                    setValidationError("⚠️ Please select a court first before choosing time slots!");
                                    document.getElementById('courts')?.scrollIntoView({ behavior: 'smooth' });
                                    return;
                                }

                                const newTimes = selectedTimes.includes(time)
                                    ? selectedTimes.filter(t => t !== time)
                                    : [...selectedTimes, time];

                                setSelectedTimes(newTimes);
                                if (newTimes.length > 0) setValidationError('');
                            }}
                        />
                        <div className="mt-6 flex flex-col items-end gap-2">
                            {validationError && (
                                <p className="text-sm font-medium text-red-500 animate-bounce">
                                    {validationError}
                                </p>
                            )}
                            <Button
                                size="lg"
                                className="text-white"
                                onClick={() => {
                                    setValidationError('');
                                    if (!selectedCourt) {
                                        setValidationError("⚠️ Please select a court first!");
                                        document.getElementById('courts')?.scrollIntoView({ behavior: 'smooth' });
                                        return;
                                    }
                                    if (selectedTimes.length === 0) {
                                        setValidationError("⚠️ Please select at least one time slot.");
                                        return;
                                    }
                                    setIsModalOpen(true);
                                }}
                            >
                                Book Selected Slots ({selectedTimes.length})
                            </Button>
                        </div>
                    </div>
                </section>

            </main>

            <Contact />
            <Parking />
            <Footer />

            <BookingModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedTimes([]); // Clear after modal closes so receipt has times
                }}
                bookingData={{ court: selectedCourt, date: selectedDate, times: selectedTimes }}
                onConfirm={handleBookingConfirm}
            />
        </div>
    );
}