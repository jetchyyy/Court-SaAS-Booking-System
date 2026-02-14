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

export function Home() {
    const [selectedCourt, setSelectedCourt] = useState(null);
    const [selectedDate, setSelectedDate] = useState(startOfToday());
    const [selectedTimes, setSelectedTimes] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeCourts, setActiveCourts] = useState([]);
    const [courtBookings, setCourtBookings] = useState([]);
    const [blockedSlots, setBlockedSlots] = useState([]); // **NEW: Admin-blocked slots**
    const [validationError, setValidationError] = useState('');
    const [loading, setLoading] = useState(false);

    // Load courts from Supabase
    useEffect(() => {
        loadCourts();

        // Subscribe to court updates
        const subscription = subscribeToCourts((payload) => {
            // Reload courts immediately when any change occurs
            loadCourts();
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
            // Show all courts (including disabled ones)
            setActiveCourts(courts || []);
        } catch (err) {
            // Fallback to empty array
            setActiveCourts([]);
        }
    };

    // Load bookings when court or date changes
    useEffect(() => {
        if (selectedCourt) {
            loadBookings();
            loadBlockedSlots(); // **NEW: Load blocked slots**
            loadMonthlyBookings(); // Load bookings for entire month for legend

            // Subscribe to booking updates for this court
            const subscription = subscribeToBookings((payload) => {
                loadBookings();
                loadMonthlyBookings();
            });

            // **NEW: Listen for booking conflict events from the modal**
            const handleBookingConflict = () => {
                console.log('⚠️ Booking conflict detected - refreshing time slots...');
                loadBookings();
                loadMonthlyBookings();
                // Also clear the selected times since they're now taken
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
    }, [selectedCourt, selectedDate]);

    const loadBookings = async () => {
        if (!selectedCourt) return;

        try {
            setLoading(true);
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const { getDailyBookings } = await import('../services/booking');
            const bookings = await getDailyBookings(dateStr);
            setCourtBookings(bookings || []);
        } catch (err) {
            setCourtBookings([]);
        } finally {
            setLoading(false);
        }
    };

    // **NEW: Load admin-blocked slots**
    const loadBlockedSlots = async () => {
        if (!selectedCourt) return;

        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const { supabase } = await import('../lib/supabaseClient');

            const { data, error } = await supabase
                .from('blocked_time_slots')
                .select('time_slot')
                .eq('court_id', selectedCourt.id)
                .eq('blocked_date', dateStr);

            if (error) {
                console.error('Error loading blocked slots:', error);
                setBlockedSlots([]);
            } else {
                setBlockedSlots(data?.map(item => item.time_slot) || []);
            }
        } catch (err) {
            console.error('Error loading blocked slots:', err);
            setBlockedSlots([]);
        }
    };

    // Load bookings for the entire month to calculate legend
    const [monthlyBookings, setMonthlyBookings] = useState([]);

    const loadMonthlyBookings = async () => {
        if (!selectedCourt) return;

        try {
            const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
            const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

            const { supabase } = await import('../lib/supabaseClient');
            const { data, error } = await supabase
                .from('bookings')
                .select('*, courts(id, name, type)')
                .gte('booking_date', format(startOfMonth, 'yyyy-MM-dd'))
                .lte('booking_date', format(endOfMonth, 'yyyy-MM-dd'))
                .in('status', ['Confirmed', 'Rescheduled']);

            if (error) {
                setMonthlyBookings([]);
            } else {
                setMonthlyBookings(data || []);
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
        setSelectedTimes([]); // Clear times when switching courts
        document.getElementById('booking-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleDateSelect = (date) => {
        setSelectedDate(date);
        setSelectedTimes([]); // Clear times when date changes
        setValidationError('');
    };

    // Get booked time slots for the selected date
    const getBookedTimes = () => {
        const bookedSlots = new Set();

        // **NEW: Add admin-blocked slots**
        blockedSlots.forEach(slot => {
            bookedSlots.add(slot.substring(0, 5)); // Normalize to HH:MM
        });

        // Block past time slots if selected date is today
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

        // Continue with existing booking conflict logic
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
                        const normalizedTime = time.substring(0, 5);
                        bookedSlots.add(normalizedTime);
                    });
                } else {
                    const [startHour, startMin] = startTime.split(':').map(Number);
                    const [endHour, endMin] = endTime.split(':').map(Number);

                    for (let hour = startHour; hour < endHour; hour++) {
                        const timeSlot = `${hour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
                        bookedSlots.add(timeSlot);
                    }
                }
            }
        });
        return Array.from(bookedSlots);
    };

    // Get list of fully booked and partially booked dates
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
                    const normalizedTime = time.substring(0, 5);
                    bookingsByDate[bookingDate].add(normalizedTime);
                });
            } else if (booking.start_time && booking.end_time) {
                const startTime = booking.start_time.substring(0, 5);
                const endTime = booking.end_time.substring(0, 5);
                const [startHour, startMin] = startTime.split(':').map(Number);
                const [endHour, endMin] = endTime.split(':').map(Number);

                for (let hour = startHour; hour < endHour; hour++) {
                    const timeSlot = `${hour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`;
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

            // **IMPORTANT: Return the booking result to the modal**
            await loadBookings();
            setSelectedTimes([]);
            setIsModalOpen(false);
            
            return newBooking; // <-- Return the booking!
            
        } catch (err) {
            // Refresh bookings to show updated availability
            await loadBookings();

            let userFriendlyMessage = 'Failed to create booking. Please try again.';

            if (err.message) {
                userFriendlyMessage = `⚠️ ${err.message}`;
            }

            setValidationError(userFriendlyMessage);
            setIsModalOpen(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg-user font-sans text-brand-green-dark selection:bg-brand-orange-light selection:text-brand-orange">
            <Navbar />
            <Hero />
            <Offers />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24 pb-20">

                {/* Courts Section */}
                <section id="courts">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">Choose Your Court</h2>
                        <p className="text-gray-600">Select from our professional-grade courts. Whether you prefer center court action or a casual game, we have the perfect spot for you.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {activeCourts.map((court) => (
                            <CourtCard key={court.id} court={court} onBook={handleBookClick} />
                        ))}
                    </div>
                </section>

                {/* Booking Section */}
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
                onClose={() => setIsModalOpen(false)}
                bookingData={{ court: selectedCourt, date: selectedDate, times: selectedTimes }}
                onConfirm={handleBookingConfirm}
            />
        </div>
    );
}