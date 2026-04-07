import { eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui';
import { getAllBookings, subscribeToBookings, updateBookingStatus, rescheduleBooking, invalidateAllBookingsCache } from '../../services/booking';
import { BookingDetailsModal } from '../../components/admin/BookingDetailsModal';
import { RescheduleModal } from '../../components/admin/Reschedulemodal';
import { AdminActionModal } from '../../components/admin/AdminActionModal';

export function AdminCalendar() {
    const navigate = useNavigate();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [bookings, setBookings] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [selectedBookingDetails, setSelectedBookingDetails] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
    const [actionModal, setActionModal] = useState({
        isOpen: false,
        title: '',
        description: '',
        action: null,
        variant: 'primary',
        confirmLabel: 'Confirm',
        successTitle: 'Success!',
        successDescription: 'Action completed successfully.'
    });

    useEffect(() => {
        loadBookings();

        // Subscribe to real-time updates
        const subscription = subscribeToBookings(() => {
            loadBookings();
        });

        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, []);

    const loadBookings = async () => {
        try {
            setLoading(true);
            const data = await getAllBookings();
            setBookings(data || []);
        } catch (err) {
            console.error('Error loading bookings:', err);
        } finally {
            setLoading(false);
        }
    };

    const firstDayNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const firstDayPrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const toUTC = (isoStr) => {
        if (!isoStr) return new Date(NaN);
        const s = isoStr.trim();
        if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
        return new Date(s + 'Z');
    };
    const getManilaDateStr = (date) =>
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
    const todayStr = getManilaDateStr(new Date());
    const todayCount = bookings.filter(b => b.created_at && getManilaDateStr(toUTC(b.created_at)) === todayStr).length;
    const todayLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());

    const getBookingsForDate = (date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        return bookings.filter(b => b.booking_date === dateStr && b.status !== 'Cancelled');
    };

    const selectedDayBookings = getBookingsForDate(selectedDate);

    const handleBookingClick = (booking) => {
        setSelectedBookingDetails(booking);
        setIsModalOpen(true);
    };

    const updateStatus = async (id, newStatus) => {
        if (newStatus === 'Cancelled') {
            setActionModal({
                isOpen: true,
                title: 'Cancel Booking',
                description: 'Are you sure you want to cancel this booking? This action will notify the customer.',
                variant: 'danger',
                confirmLabel: 'Cancel Booking',
                successTitle: 'Booking Cancelled',
                successDescription: 'The booking has been successfully cancelled.',
                action: async () => {
                    await updateBookingStatus(id, newStatus);
                    invalidateAllBookingsCache();
                    await loadBookings();
                }
            });
            return;
        }
        try {
            await updateBookingStatus(id, newStatus);
            invalidateAllBookingsCache();
            await loadBookings();
        } catch (err) {
            console.error('Error updating booking status:', err);
        }
    };

    const handleReschedule = (booking) => {
        setSelectedBookingDetails(booking);
        setIsModalOpen(false);
        setIsRescheduleModalOpen(true);
    };

    const handleRescheduleConfirm = async (rescheduleData) => {
        try {
            const result = await rescheduleBooking(rescheduleData);
            if (!result) throw new Error('Reschedule returned no data');
            invalidateAllBookingsCache();
            await loadBookings();
            setActionModal({
                isOpen: true,
                title: 'Booking Rescheduled',
                description: "The booking has been successfully rescheduled. Don't forget to send the SMS message to the customer!",
                variant: 'success',
                confirmLabel: 'OK',
                successTitle: 'Success',
                successDescription: 'Booking rescheduled.',
                action: async () => {}
            });
            setIsRescheduleModalOpen(false);
            setSelectedBookingDetails(null);
        } catch (error) {
            console.error('Reschedule failed:', error);
            throw error;
        }
    };

    return (
        <div className="space-y-6 w-full max-w-full">
            <div>
                <h1 className="text-2xl font-bold font-display text-brand-green-dark">Calendar Schedule</h1>
                <p className="text-gray-500">Overview of efficient court utilization</p>
            </div>

            {/* Today's bookings pill */}
            {!loading && (
                <button
                    onClick={() => navigate('/admin/bookings')}
                    className="inline-flex items-center gap-1.5 bg-brand-green/10 hover:bg-brand-green/20 text-brand-green-dark text-sm font-medium px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                >
                    <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
                    {todayCount === 0
                        ? `No new bookings today — ${todayLabel}`
                        : `${todayCount} new booking${todayCount > 1 ? 's' : ''} added today — ${todayLabel}`
                    }
                    <span className="text-xs opacity-60 ml-1">View →</span>
                </button>
            )}

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Calendar Grid */}
                <div className="lg:w-2/3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-xl font-bold text-gray-800">
                            {format(currentMonth, 'MMMM yyyy')}
                        </h2>
                        <div className="flex gap-2">
                            <button onClick={firstDayPrevMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <ChevronLeft size={20} />
                            </button>
                            <button onClick={firstDayNextMonth} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-4 mb-4">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                            <div key={day} className="text-center text-sm font-medium text-gray-400 py-2">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {calendarDays.map((day, dayIdx) => {
                            const dayBookings = getBookingsForDate(day);
                            const isSelected = isSameDay(day, selectedDate);
                            const isCurrentMonth = isSameMonth(day, currentMonth);
                            const count = dayBookings.length;

                            return (
                                <button
                                    key={day.toString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={`
                                        min-h-[64px] p-2 rounded-xl text-left transition-all relative flex flex-col
                                        ${isSelected ? 'ring-2 ring-brand-green bg-brand-green/5' : 'hover:bg-gray-50'}
                                        ${!isCurrentMonth ? 'opacity-40' : ''}
                                    `}
                                >
                                    <span className={`
                                        text-sm font-medium block
                                        ${isSelected ? 'text-brand-green-dark' : 'text-gray-700'}
                                    `}>
                                        {format(day, 'd')}
                                    </span>

                                    {/* Booking indicator */}
                                    {count > 0 && (
                                        <div className="mt-auto pt-1">
                                            {count <= 3 ? (
                                                <div className="flex flex-col gap-[3px]">
                                                    {Array.from({ length: count }).map((_, i) => (
                                                        <div key={i} className="h-1 rounded-full bg-brand-orange w-full opacity-80" />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <div className="flex flex-col gap-[3px] flex-1">
                                                        {Array.from({ length: 3 }).map((_, i) => (
                                                            <div key={i} className="h-1 rounded-full bg-brand-orange w-full opacity-80" />
                                                        ))}
                                                    </div>
                                                    <span className="text-[9px] font-bold text-brand-orange leading-none shrink-0">
                                                        {count}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Day Detail View */}
                <div className="lg:w-1/3 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-800">
                            Schedule for <span className="text-brand-green-dark">{format(selectedDate, 'MMM do')}</span>
                        </h2>
                        {selectedDayBookings.length > 0 && (
                            <span className="text-xs font-semibold bg-brand-green/10 text-brand-green-dark px-2 py-0.5 rounded-full">
                                {selectedDayBookings.length} booking{selectedDayBookings.length !== 1 ? 's' : ''}
                            </span>
                        )}
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col" style={{ maxHeight: '520px' }}>
                        {selectedDayBookings.length > 0 ? (
                            <div className="overflow-y-auto flex-1 p-3 space-y-2">
                                {selectedDayBookings
                                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                                    .map((booking) => (
                                        <div
                                            key={booking.id}
                                            onClick={() => handleBookingClick(booking)}
                                            className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 hover:border-brand-green/40 hover:bg-white hover:shadow-sm cursor-pointer transition-all flex items-center gap-3"
                                        >
                                            {/* Time block */}
                                            <div className="shrink-0 text-center bg-white border border-gray-200 rounded-lg px-2 py-1 min-w-[72px]">
                                                <p className="text-xs font-bold text-brand-green-dark leading-tight">{booking.start_time}</p>
                                                <p className="text-[10px] text-gray-400 leading-tight">{booking.end_time}</p>
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{booking.customer_name}</p>
                                                <p className="text-xs text-gray-400 truncate">{booking.courts?.name || 'N/A'} · ₱{booking.total_price}</p>
                                            </div>

                                            {/* Status badge */}
                                            <Badge variant={booking.status === 'Confirmed' ? 'green' : booking.status === 'Cancelled' ? 'red' : 'orange'} className="shrink-0 text-[10px]">
                                                {booking.status}
                                            </Badge>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-gray-400 py-16">
                                <Calendar size={40} className="mb-3 opacity-20" />
                                <p className="text-sm">{loading ? 'Loading bookings...' : 'No bookings for this date.'}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <BookingDetailsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                booking={selectedBookingDetails}
                onUpdateStatus={updateStatus}
                onReschedule={handleReschedule}
            />

            <RescheduleModal
                isOpen={isRescheduleModalOpen}
                onClose={() => {
                    setIsRescheduleModalOpen(false);
                    setSelectedBookingDetails(null);
                }}
                booking={selectedBookingDetails}
                onConfirm={handleRescheduleConfirm}
            />

            <AdminActionModal
                isOpen={actionModal.isOpen}
                onClose={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
                title={actionModal.title}
                description={actionModal.description}
                action={actionModal.action}
                variant={actionModal.variant}
                confirmLabel={actionModal.confirmLabel}
                successTitle={actionModal.successTitle}
                successDescription={actionModal.successDescription}
            />
        </div>
    );
}
