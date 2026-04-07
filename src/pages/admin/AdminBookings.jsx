import { format } from 'date-fns';
import { Calendar, CheckCircle, Clock, Eye, MoreVertical, RefreshCw, Search, Trash2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Pagination } from '../../components/ui';
import { BookingDetailsModal } from '../../components/admin/BookingDetailsModal';
import { RescheduleModal } from '../../components/admin/Reschedulemodal';
import { AdminActionModal } from '../../components/admin/AdminActionModal';
import { getAllBookings, getSingleBooking, updateBookingStatus, subscribeToBookings, rescheduleBooking, invalidateAllBookingsCache } from '../../services/booking';
import { supabase } from '../../lib/supabaseClient';

export function AdminBookings() {
    const [bookings, setBookings] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterDate, setFilterDate] = useState('today');
    const [sortOrder, setSortOrder] = useState('newest');
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

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

    // Philippine timezone helpers
    const MANILA_TZ = 'Asia/Manila';
    // Normalize Supabase timestamps to UTC — Supabase may return "2026-04-05T13:32:00"
    // without a Z/offset suffix, which browsers parse as LOCAL time. Appending Z forces UTC.
    const toUTC = (isoStr) => {
        if (!isoStr) return new Date(NaN);
        const s = isoStr.trim();
        // Already has timezone info (Z, +, or -)
        if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
        return new Date(s + 'Z');
    };
    const getManilaDateStr = (date) =>
        new Intl.DateTimeFormat('en-CA', { timeZone: MANILA_TZ }).format(date);
    const formatManilaDate = (isoStr) =>
        new Intl.DateTimeFormat('en-US', { timeZone: MANILA_TZ, month: 'short', day: 'numeric', year: 'numeric' }).format(toUTC(isoStr));
    const formatManilaTime = (isoStr) =>
        new Intl.DateTimeFormat('en-US', { timeZone: MANILA_TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(toUTC(isoStr));
    const formatManilaShort = (isoStr) =>
        new Intl.DateTimeFormat('en-US', { timeZone: MANILA_TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(toUTC(isoStr));

    // Helper function to convert 24-hour time to 12-hour format
    const formatTime12Hour = (timeString) => {
        if (!timeString) return '';

        // Handle time format with or without seconds (e.g., "14:00" or "14:00:00")
        const [hours, minutes] = timeString.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);

        return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
    };

    useEffect(() => {
        loadBookings();

        // Subscribe to real-time booking updates — update state incrementally to minimise egress
        const subscription = subscribeToBookings(async (payload) => {
            invalidateAllBookingsCache();
            if (payload.eventType === 'DELETE') {
                setBookings(prev => prev.filter(b => b.id !== payload.old.id));
            } else if (payload.eventType === 'INSERT') {
                const newBooking = await getSingleBooking(payload.new.id);
                if (newBooking) setBookings(prev => [newBooking, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
                const updatedBooking = await getSingleBooking(payload.new.id);
                if (updatedBooking) setBookings(prev => prev.map(b => b.id === updatedBooking.id ? updatedBooking : b));
            }
        });

        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, []);

    // Reset pagination when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, filterDate, sortOrder]);

    const loadBookings = async ({ force = false } = {}) => {
        try {
            setLoading(true);
            const bookingsData = await getAllBookings({ force });
            setBookings(bookingsData || []);
        } catch (err) {
            console.error('Error loading bookings:', err);
            setBookings([]);
        } finally {
            setLoading(false);
        }
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
                    await loadBookings({ force: true });
                }
            });
            return;
        }

        try {
            await updateBookingStatus(id, newStatus);
            await loadBookings({ force: true });
        } catch (err) {
            console.error('Error updating booking status:', err);
            alert('Failed to update booking status');
        }
    };

    // Handle reschedule button click
    const handleReschedule = (booking) => {
        setSelectedBooking(booking);
        setIsModalOpen(false); // Close details modal
        setIsRescheduleModalOpen(true); // Open reschedule modal
    };

    // Handle reschedule confirmation
    const handleRescheduleConfirm = async (rescheduleData) => {
        try {
            const result = await rescheduleBooking(rescheduleData);

            if (!result) {
                throw new Error('Reschedule returned no data');
            }

            await loadBookings({ force: true });

            // Show success message
            setActionModal({
                isOpen: true,
                title: 'Booking Rescheduled',
                description: 'The booking has been successfully rescheduled. Don\'t forget to send the SMS message to the customer!',
                variant: 'success',
                confirmLabel: 'OK',
                successTitle: 'Success',
                successDescription: 'Booking rescheduled.',
                action: async () => {
                    // Just close the modal
                }
            });

            setIsRescheduleModalOpen(false);
            setSelectedBooking(null);
        } catch (error) {
            console.error('Reschedule failed:', error);
            throw error; // Let RescheduleModal display the error inline
        }
    };

    const handleDeleteClick = (booking) => {
        setActionModal({
            isOpen: true,
            title: 'Delete Booking',
            description: `Are you sure you want to delete the booking for ${booking.customer_name}? This action cannot be undone.`,
            variant: 'danger',
            confirmLabel: 'Delete',
            successTitle: 'Booking Deleted',
            successDescription: 'The booking has been successfully removed from the system.',
            action: async () => {
                try {
                    const { data, error } = await supabase
                        .from('bookings')
                        .delete()
                        .eq('id', booking.id)
                        .select();

                    if (error) {
                        throw new Error(`Delete failed: ${error.message}`);
                    }

                    if (!data || data.length === 0) {
                        throw new Error('Booking not found or delete permission denied. Check RLS policies.');
                    }

                    // Best-effort: delete the proof of payment image from storage.
                    // We do this after the DB delete succeeds so we never block the user action.
                    const proofUrl = data[0]?.proof_of_payment_url;
                    if (proofUrl) {
                        const marker = '/object/public/booking-proofs/';
                        const idx = proofUrl.indexOf(marker);
                        if (idx !== -1) {
                            const storagePath = decodeURIComponent(
                                proofUrl.substring(idx + marker.length).split('?')[0]
                            );
                            await supabase.storage.from('booking-proofs').remove([storagePath]).catch((e) => {
                                console.warn('[handleDeleteClick] Could not remove proof from storage:', e);
                            });
                        }
                    }

                    await loadBookings({ force: true });
                } catch (err) {
                    alert('Failed to delete booking: ' + err.message);
                    throw err;
                }
            }
        });
    };

    const todayStr = getManilaDateStr(new Date());
    const yesterdayStr = getManilaDateStr(new Date(Date.now() - 86400000));

    const filteredBookings = bookings.filter(b => {
        const matchesSearch = b.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());

        const createdDate = b.created_at ? getManilaDateStr(toUTC(b.created_at)) : null;
        const matchesDate = filterDate === 'today'
            ? createdDate === todayStr
            : filterDate === 'yesterday'
            ? createdDate === yesterdayStr
            : true;

        const matchesStatus = filterStatus === 'All' || b.status === filterStatus;

        return matchesSearch && matchesDate && matchesStatus;
    }).sort((a, b) => {
        const aTime = a.created_at ? toUTC(a.created_at).getTime() : 0;
        const bTime = b.created_at ? toUTC(b.created_at).getTime() : 0;
        if (sortOrder === 'oldest') return aTime - bTime;
        // Default: newest first
        return bTime - aTime;
    });

    // Calculate pagination logic
    const mostRecentId = filteredBookings.length > 0
        ? filteredBookings.reduce((max, b) =>
            (b.created_at && toUTC(b.created_at).getTime() > (max.created_at ? toUTC(max.created_at).getTime() : 0)) ? b : max
          , filteredBookings[0]).id
        : null;

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentBookings = filteredBookings.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);

    useEffect(() => {
        if (totalPages === 0 && currentPage !== 1) {
            setCurrentPage(1);
            return;
        }

        if (totalPages > 0 && currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'Confirmed': return 'green';
            case 'Cancelled': return 'red';
            case 'Rescheduled': return 'orange';
            default: return 'orange';
        }
    };

    return (
        <div className="space-y-6 w-full max-w-full">
            {/* Row 1: Title + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div>
                        <h1 className="text-2xl font-bold font-display text-brand-green-dark">Booking Management</h1>
                        <p className="text-gray-500">View and manage customer bookings</p>
                    </div>
                    <button
                        onClick={() => loadBookings({ force: true })}
                        disabled={loading}
                        title="Refresh bookings"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-green-dark bg-brand-green/10 hover:bg-brand-green/20 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search name, ref..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green/20 w-full"
                    />
                </div>
            </div>

            {/* Row 2: Filters */}
            <div className="flex flex-wrap gap-3">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        {[{ label: 'Newest to Oldest', value: 'newest' }, { label: 'Oldest to Newest', value: 'oldest' }].map(({ label, value }) => (
                            <button
                                key={value}
                                onClick={() => setSortOrder(value)}
                                className={`
                                    px-4 py-2 text-sm font-medium rounded-lg transition-all
                                    ${sortOrder === value
                                        ? 'bg-white text-brand-green-dark shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                    }
                                `}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        {[{ label: `Today (${new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' }).format(new Date())})`, value: 'today' }, { label: 'All Dates', value: 'all' }].map(({ label, value }) => (
                            <button
                                key={value}
                                onClick={() => setFilterDate(value)}
                                className={`
                                    px-4 py-2 text-sm font-medium rounded-lg transition-all
                                    ${filterDate === value
                                        ? value === 'today'
                                            ? 'bg-teal-100 text-teal-700 shadow-sm'
                                            : 'bg-slate-200 text-slate-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                    }
                                `}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        {['All', 'Confirmed', 'Rescheduled', 'Cancelled'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`
                                    px-4 py-2 text-sm font-medium rounded-lg transition-all
                                    ${filterStatus === status
                                        ? status === 'Confirmed'
                                            ? 'bg-teal-100 text-teal-700 shadow-sm'
                                            : status === 'Rescheduled'
                                            ? 'bg-orange-100 text-orange-600 shadow-sm'
                                            : status === 'Cancelled'
                                            ? 'bg-red-100 text-red-600 shadow-sm'
                                            : 'bg-slate-200 text-slate-700 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                    }
                                `}
                            >
                                {status}
                            </button>
                        ))}
                    </div>
            </div>

            {/* Today's booking summary label */}
            {(() => {
                const todayCount = bookings.filter(b => b.created_at && getManilaDateStr(toUTC(b.created_at)) === todayStr).length;
                const todayLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
                return !loading && (
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 bg-brand-green/10 text-brand-green-dark text-sm font-medium px-3 py-1.5 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
                            {todayCount === 0
                                ? `No new bookings today — ${todayLabel}`
                                : `${todayCount} new booking${todayCount > 1 ? 's' : ''} added today — ${todayLabel}`
                            }
                        </span>
                    </div>
                );
            })()}

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                {/* Mobile card list */}
                <div className="block sm:hidden divide-y divide-gray-100">
                    {loading ? (
                        <p className="px-4 py-8 text-center text-gray-500 text-sm">Loading bookings...</p>
                    ) : filteredBookings.length === 0 ? (
                        <p className="px-4 py-8 text-center text-gray-500 text-sm">No bookings found matching your search.</p>
                    ) : (
                        currentBookings.map((booking) => (
                            <div key={booking.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${booking.id === mostRecentId ? 'border-l-2 border-l-teal-400 bg-teal-50/30' : ''}`}>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-medium text-gray-900 text-sm leading-tight truncate">{booking.customer_name}</p>
                                        <Badge variant={getStatusColor(booking.status)}>{booking.status}</Badge>
                                        {booking.id === mostRecentId && (
                                            <span className="text-[10px] font-semibold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">Recent</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400 leading-tight">{booking.customer_phone}</p>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5 flex-wrap">
                                        <span className="font-medium text-gray-600">{booking.courts?.name || 'Court'}</span>
                                        <span className="flex items-center gap-1">
                                            <Calendar size={11} />
                                            {booking.booking_date ? format(new Date(booking.booking_date), 'MMM d, yyyy') : '-'}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={11} />
                                            {booking.booked_times && Array.isArray(booking.booked_times) && booking.booked_times.length > 0
                                                ? booking.booked_times.map(time => formatTime12Hour(time)).join(', ')
                                                : `${formatTime12Hour(booking.start_time)} - ${formatTime12Hour(booking.end_time)}`
                                            }
                                        </span>
                                        {booking.created_at && (
                                            <span className="flex items-center gap-1 text-gray-400">
                                                Booked: {formatManilaShort(booking.created_at)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Button size="sm" variant="ghost" onClick={() => { setSelectedBooking(booking); setIsModalOpen(true); }} className="text-gray-500 hover:text-brand-green h-8 w-8 p-0 grid place-items-center" title="View Details">
                                        <Eye size={15} />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(booking)} className="text-gray-400 hover:text-red-500 h-8 w-8 p-0 grid place-items-center">
                                        <Trash2 size={15} />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">ID</th>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Details</th>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Booked At</th>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                                        Loading bookings...
                                    </td>
                                </tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                                        No bookings found matching your search.
                                    </td>
                                </tr>
                            ) : (
                                currentBookings.map((booking) => (
                                    <tr key={booking.id} className={`hover:bg-gray-50/50 ${booking.id === mostRecentId ? 'border-l-2 border-l-teal-400 bg-teal-50/30' : ''}`}>
                                        <td className="px-4 py-2.5">
                                            <span className="font-mono text-xs font-medium text-gray-600">{booking.id.substring(0, 8)}</span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <p className="font-medium text-gray-900 leading-tight">{booking.customer_name}</p>
                                            <p className="text-xs text-gray-400 leading-tight">{booking.customer_phone}</p>
                                            {booking.id === mostRecentId && (
                                                <span className="inline-block mt-0.5 text-[10px] font-semibold bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">Recent</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <p className="font-medium text-gray-800 leading-tight">{booking.courts?.name || 'Court'}</p>
                                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                                <span className="flex items-center gap-1">
                                                    <Calendar size={11} />
                                                    {booking.booking_date ? format(new Date(booking.booking_date), 'MMM d, yyyy') : '-'}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock size={11} />
                                                    {booking.booked_times && Array.isArray(booking.booked_times) && booking.booked_times.length > 0
                                                        ? booking.booked_times.map(time => formatTime12Hour(time)).join(', ')
                                                        : `${formatTime12Hour(booking.start_time)} - ${formatTime12Hour(booking.end_time)}`
                                                    }
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                            {booking.created_at ? (
                                                <>
                                                    <p className="text-xs font-medium text-gray-700 leading-tight">{formatManilaDate(booking.created_at)}</p>
                                                    <p className="text-xs text-gray-400 leading-tight">{formatManilaTime(booking.created_at)}</p>
                                                </>
                                            ) : (
                                                <span className="text-xs text-gray-400">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <Badge variant={getStatusColor(booking.status)}>{booking.status}</Badge>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button size="sm" variant="ghost" onClick={() => { setSelectedBooking(booking); setIsModalOpen(true); }} className="text-gray-500 hover:text-brand-green h-7 w-7 p-0 grid place-items-center" title="View Details">
                                                    <Eye size={14} />
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(booking)} className="text-gray-400 hover:text-red-500 h-7 w-7 p-0 grid place-items-center">
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && filteredBookings.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                    />
                )}
            </div>

            {/* Booking Details Modal */}
            <BookingDetailsModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedBooking(null);
                }}
                booking={selectedBooking}
                onUpdateStatus={updateStatus}
                onReschedule={handleReschedule}
            />

            {/* Reschedule Modal */}
            <RescheduleModal
                isOpen={isRescheduleModalOpen}
                onClose={() => {
                    setIsRescheduleModalOpen(false);
                    setSelectedBooking(null);
                }}
                booking={selectedBooking}
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