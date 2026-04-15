import { startOfToday, format } from 'date-fns';
import { useEffect, useState } from 'react';
import { BookingModal } from '../components/BookingModal';
import { BookingSlotModal } from '../components/BookingSlotModal';
import { Contact } from '../components/Contact';
import { Offers } from '../components/Offers';
import { Parking } from '../components/Parking';
import { CourtCard } from '../components/CourtCard';
import { Footer } from '../components/Footer';
import { Hero } from '../components/Hero';
import { Navbar } from '../components/Navbar';
import { orderCourtsForHomepage } from '../lib/courtDisplayOrder';
import { listCourts, subscribeToCourts } from '../services/courts';
import { subscribeToBookings } from '../services/booking';

const BOOKING_CACHE_TTL = 30_000;
const bookingCache = {};
const blockedCache = {};
const monthlyCache = {};

function getCached(cache, key) {
    const entry = cache[key];
    if (entry && Date.now() - entry.timestamp < BOOKING_CACHE_TTL) return entry.data;
    return null;
}

function setCache(cache, key, data) {
    cache[key] = { data, timestamp: Date.now() };
}

function invalidateBookingCaches() {
    Object.keys(bookingCache).forEach((key) => delete bookingCache[key]);
    Object.keys(blockedCache).forEach((key) => delete blockedCache[key]);
    Object.keys(monthlyCache).forEach((key) => delete monthlyCache[key]);
}

export function Home() {
    const [selectedCourt, setSelectedCourt] = useState(null);
    const [selectedDate, setSelectedDate] = useState(startOfToday());
    const [selectedTimes, setSelectedTimes] = useState([]);
    const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeCourts, setActiveCourts] = useState([]);
    const [courtBookings, setCourtBookings] = useState([]);
    const [blockedSlots, setBlockedSlots] = useState([]);
    const [monthlyBookings, setMonthlyBookings] = useState([]);
    const [validationError, setValidationError] = useState('');

    const visibleCourts = orderCourtsForHomepage(
        (activeCourts || []).filter((court) => court.is_active !== false)
    );

    const isExclusiveCourtType = (courtType = '') => {
        return courtType.includes('Exclusive') || courtType.includes('Whole');
    };

    useEffect(() => {
        loadCourts();

        const subscription = subscribeToCourts((payload) => {
            const { eventType, new: newRecord, old: oldRecord } = payload;
            if (eventType === 'INSERT') {
                setActiveCourts((prev) => [newRecord, ...prev]);
            } else if (eventType === 'UPDATE') {
                setActiveCourts((prev) => prev.map((court) => (court.id === newRecord.id ? newRecord : court)));
            } else if (eventType === 'DELETE') {
                setActiveCourts((prev) => prev.filter((court) => court.id !== oldRecord.id));
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

    useEffect(() => {
        if (!selectedCourt) return undefined;

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
                    .filter((court) => isExclusiveCourtType(court?.type || ''))
                    .map((court) => court.id)
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
                loadBlockedSlots({ force: true });
            }

            if (touchesSelectedMonth) {
                loadMonthlyBookings({ force: true });
            }
        });

        const handleBookingConflict = () => {
            invalidateBookingCaches();
            loadBookings({ force: true });
            loadBlockedSlots({ force: true });
            loadMonthlyBookings({ force: true });
            setSelectedTimes([]);
            setIsModalOpen(false);
            setIsSlotModalOpen(true);
            setValidationError('Please choose a different available time slot.');
        };

        window.addEventListener('bookingConflict', handleBookingConflict);

        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
            window.removeEventListener('bookingConflict', handleBookingConflict);
        };
    }, [selectedCourt, selectedDate, activeCourts]);

    const loadBookings = async ({ force = false } = {}) => {
        if (!selectedCourt) return;

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const cacheKey = `daily-${selectedCourt.id}-${dateStr}`;

        if (!force) {
            const cached = getCached(bookingCache, cacheKey);
            if (cached) {
                setCourtBookings(cached);
                return;
            }
        }

        try {
            const { getDailyBookings } = await import('../services/booking');
            const bookings = await getDailyBookings(dateStr);
            const result = bookings || [];
            setCache(bookingCache, cacheKey, result);
            setCourtBookings(result);
        } catch (err) {
            setCourtBookings([]);
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
                setBlockedSlots(cached);
                return;
            }
        }

        try {
            const { supabase } = await import('../lib/supabaseClient');

            let query = supabase
                .from('blocked_time_slots')
                .select('time_slot')
                .eq('blocked_date', dateStr);

            if (isExclusive && activeCourts.length > 0) {
                query = query.in('court_id', activeCourts.map((court) => court.id));
            } else {
                query = query.eq('court_id', selectedCourt.id);
            }

            const { data, error } = await query;

            if (error) {
                setBlockedSlots([]);
            } else {
                const result = [...new Set(data?.map((item) => item.time_slot) || [])];
                setCache(blockedCache, cacheKey, result);
                setBlockedSlots(result);
            }
        } catch (err) {
            setBlockedSlots([]);
        }
    };

    const loadMonthlyBookings = async ({ force = false } = {}) => {
        if (!selectedCourt) return;

        const monthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
        const cacheKey = `monthly-${selectedCourt.id}-${monthKey}`;

        if (!force) {
            const cached = getCached(monthlyCache, cacheKey);
            if (cached) {
                setMonthlyBookings(cached);
                return;
            }
        }

        try {
            const startOfMonthDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            const endOfMonthDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

            const { supabase } = await import('../lib/supabaseClient');
            const { data, error } = await supabase
                .from('bookings')
                .select('id, court_id, booking_date, start_time, end_time, booked_times, status, courts(id, type)')
                .gte('booking_date', format(startOfMonthDate, 'yyyy-MM-dd'))
                .lte('booking_date', format(endOfMonthDate, 'yyyy-MM-dd'))
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
            setValidationError('This court is currently unavailable for booking.');
            return;
        }

        setSelectedCourt(court);
        setSelectedDate(startOfToday());
        setSelectedTimes([]);
        setValidationError('');
        setIsModalOpen(false);
        setIsSlotModalOpen(true);
    };

    const handleDateSelect = (date) => {
        setSelectedDate(date);
        setSelectedTimes([]);
        setValidationError('');
    };

    const handleTimeSelect = (time) => {
        if (!selectedCourt) {
            setValidationError('Please select a court first.');
            return;
        }

        const newTimes = selectedTimes.includes(time)
            ? selectedTimes.filter((selectedTime) => selectedTime !== time)
            : [...selectedTimes, time];

        setSelectedTimes(newTimes);
        if (newTimes.length > 0) {
            setValidationError('');
        }
    };

    const handleSlotModalClose = () => {
        setIsSlotModalOpen(false);
        setSelectedTimes([]);
        setValidationError('');
    };

    const handleProceedToDetails = () => {
        if (selectedTimes.length === 0) {
            setValidationError('Please select at least one time slot.');
            return;
        }

        setValidationError('');
        setIsSlotModalOpen(false);
        setIsModalOpen(true);
    };

    const getBookedTimes = () => {
        const bookedSlots = new Set();

        blockedSlots.forEach((slot) => {
            bookedSlots.add(slot.substring(0, 5));
        });

        const today = startOfToday();
        const isToday = format(selectedDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

        if (isToday) {
            const now = new Date();
            const currentHour = now.getHours();

            for (let hour = 0; hour <= currentHour; hour += 1) {
                bookedSlots.add(`${hour.toString().padStart(2, '0')}:00`);
            }
        }

        if (!courtBookings || courtBookings.length === 0) {
            return Array.from(bookedSlots);
        }

        const isExclusiveSelected = selectedCourt?.type?.includes('Exclusive') || selectedCourt?.type?.includes('Whole');

        courtBookings.forEach((booking) => {
            let isConflict = false;

            if (booking.court_id === selectedCourt.id) {
                isConflict = true;
            } else if (isExclusiveSelected) {
                isConflict = true;
            } else if (booking.courts?.type?.includes('Exclusive') || booking.courts?.type?.includes('Whole')) {
                isConflict = true;
            }

            if (isConflict && booking.start_time && booking.end_time) {
                if (booking.booked_times && Array.isArray(booking.booked_times) && booking.booked_times.length > 0) {
                    booking.booked_times.forEach((time) => {
                        if (time && typeof time === 'string') {
                            bookedSlots.add(time.substring(0, 5));
                        }
                    });
                } else {
                    const [startHour] = booking.start_time.substring(0, 5).split(':').map(Number);
                    const [endHour] = booking.end_time.substring(0, 5).split(':').map(Number);

                    for (let hour = startHour; hour < endHour; hour += 1) {
                        bookedSlots.add(`${hour.toString().padStart(2, '0')}:00`);
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

        monthlyBookings.forEach((booking) => {
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
                booking.booked_times.forEach((time) => {
                    if (time && typeof time === 'string') {
                        bookingsByDate[bookingDate].add(time.substring(0, 5));
                    }
                });
            } else if (booking.start_time && booking.end_time) {
                const [startHour] = booking.start_time.substring(0, 5).split(':').map(Number);
                const [endHour] = booking.end_time.substring(0, 5).split(':').map(Number);

                for (let hour = startHour; hour < endHour; hour += 1) {
                    bookingsByDate[bookingDate].add(`${hour.toString().padStart(2, '0')}:00`);
                }
            }
        });

        const dateStatuses = [];
        Object.keys(bookingsByDate).forEach((date) => {
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
                const endHour = parseInt(hours, 10) + 1;
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
                startTime,
                endTime,
                totalPrice: bookingData.totalPrice || 0,
                notes: bookingData.reference || '',
                proofOfPaymentUrl,
                bookedTimes: sortedSlots,
                courtType: selectedCourt.type
            });

            invalidateBookingCaches();
            await loadBookings({ force: true });

            return newBooking;
        } catch (err) {
            invalidateBookingCaches();
            await loadBookings({ force: true });
            await loadBlockedSlots({ force: true });
            await loadMonthlyBookings({ force: true });
            throw err;
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
                        <p className="text-gray-600">
                            Select from our professional-grade courts. When you tap Book Now, we&apos;ll open a booking modal where you can choose an available date and time before filling in your details.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {visibleCourts.map((court) => (
                            <CourtCard key={court.id} court={court} onBook={handleBookClick} />
                        ))}
                    </div>

                    {validationError && !isSlotModalOpen && (
                        <div className="mt-6 max-w-xl mx-auto text-center bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                            <p className="text-sm font-medium text-red-600">{validationError}</p>
                        </div>
                    )}

                    {selectedCourt && !isSlotModalOpen && !isModalOpen && (
                        <div className="mt-8 max-w-2xl mx-auto bg-white border border-gray-100 rounded-3xl shadow-lg px-6 py-5 text-center">
                            <p className="text-xs font-bold uppercase tracking-wider text-brand-orange">Last Selected Court</p>
                            <h3 className="mt-2 text-2xl font-display font-bold text-brand-green-dark">{selectedCourt.name}</h3>
                            <p className="mt-2 text-sm text-gray-600">
                                Ready to continue? Use the Book Now button again to choose a fresh date and time.
                            </p>
                        </div>
                    )}
                </section>
            </main>

            <Contact />
            <Parking />
            <Footer />

            <BookingSlotModal
                isOpen={isSlotModalOpen}
                onClose={handleSlotModalClose}
                onProceed={handleProceedToDetails}
                selectedCourt={selectedCourt}
                selectedDate={selectedDate}
                selectedTimes={selectedTimes}
                bookedTimes={bookedTimes}
                fullyBookedDates={fullyBookedDates}
                onDateSelect={handleDateSelect}
                onTimeSelect={handleTimeSelect}
                validationError={validationError}
            />

            <BookingModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedTimes([]);
                    setValidationError('');
                }}
                bookingData={{ court: selectedCourt, date: selectedDate, times: selectedTimes }}
                onConfirm={handleBookingConfirm}
            />
        </div>
    );
}
