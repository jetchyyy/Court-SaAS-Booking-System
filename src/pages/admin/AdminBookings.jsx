import { format } from 'date-fns';
import { Calendar, CheckCircle, Clock, Eye, MoreVertical, Search, Trash2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge, Button, Pagination } from '../../components/ui';
import { BookingDetailsModal } from '../../components/admin/BookingDetailsModal';
import { RescheduleModal } from '../../components/admin/Reschedulemodal';
import { AdminActionModal } from '../../components/admin/AdminActionModal';
import { getAllBookings, updateBookingStatus, subscribeToBookings, rescheduleBooking, invalidateAllBookingsCache } from '../../services/booking';
import { supabase } from '../../lib/supabaseClient';

export function AdminBookings() {
    const [bookings, setBookings] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
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

        // Subscribe to real-time booking updates — force-refresh to bypass cache
        const subscription = subscribeToBookings((payload) => {
            loadBookings({ force: true });
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
    }, [searchTerm, filterStatus]);

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
            alert('Failed to reschedule booking: ' + error.message);
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

                    await loadBookings({ force: true });
                } catch (err) {
                    alert('Failed to delete booking: ' + err.message);
                    throw err;
                }
            }
        });
    };

    const filteredBookings = bookings.filter(b => {
        const matchesSearch = b.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.customer_email?.toLowerCase().includes(searchTerm.toLowerCase());

        if (filterStatus === 'All') return matchesSearch;
        return matchesSearch && b.status === filterStatus;
    }).sort((a, b) => {
        // Sort by booking date (newest first)
        return new Date(b.booking_date) - new Date(a.booking_date);
    });

    // Calculate pagination logic
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-display text-brand-green-dark">Booking Management</h1>
                    <p className="text-gray-500">View and manage customer bookings</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        {['All', 'Confirmed', 'Rescheduled', 'Cancelled'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={`
                                    px-4 py-2 text-sm font-medium rounded-lg transition-all
                                    ${filterStatus === status
                                        ? 'bg-white text-brand-green-dark shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                    }
                                `}
                            >
                                {status}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
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
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">ID</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Details</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        Loading bookings...
                                    </td>
                                </tr>
                            ) : filteredBookings.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        No bookings found matching your search.
                                    </td>
                                </tr>
                            ) : (
                                currentBookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-xs font-medium text-gray-600">{booking.id.substring(0, 8)}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-semibold text-gray-900">{booking.customer_name}</p>
                                                <p className="text-xs text-gray-500">{booking.customer_email}</p>
                                                <p className="text-xs text-gray-500">{booking.customer_phone}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <p className="text-sm font-medium text-gray-800">{booking.courts?.name || 'Court'}</p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={12} />
                                                        {booking.booking_date ? format(new Date(booking.booking_date), 'MMM d, yyyy') : '-'}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} />
                                                        {booking.booked_times && Array.isArray(booking.booked_times) && booking.booked_times.length > 0
                                                            ? booking.booked_times.map(time => formatTime12Hour(time)).join(', ')
                                                            : `${formatTime12Hour(booking.start_time)} - ${formatTime12Hour(booking.end_time)}`
                                                        }
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant={getStatusColor(booking.status)}>{booking.status}</Badge>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button size="sm" variant="ghost" onClick={() => { setSelectedBooking(booking); setIsModalOpen(true); }} className="text-gray-500 hover:text-brand-green h-8 w-8 p-0 grid place-items-center" title="View Details">
                                                    <Eye size={16} />
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(booking)} className="text-gray-400 hover:text-red-500 h-8 w-8 p-0 grid place-items-center">
                                                    <Trash2 size={16} />
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