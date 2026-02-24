import { format } from 'date-fns';
import { Calendar, Clock, CreditCard, Mail, MapPin, Phone, User, X, FileText, Download, RefreshCw, History, DollarSign, TrendingDown, TrendingUp, Loader } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Badge, Button } from '../ui';

// --- Module-level blob URL cache for proof-of-payment images ---
// Persists across modal open/close cycles so the same image is never re-downloaded
const imageBlobCache = new Map(); // url -> blobUrl

export function BookingDetailsModal({ isOpen, onClose, booking, onUpdateStatus, onReschedule }) {
    const [cachedImageUrl, setCachedImageUrl] = useState(null);
    const [imageLoading, setImageLoading] = useState(false);

    // Pre-fetch and cache the proof-of-payment image as a blob URL
    useEffect(() => {
        if (!isOpen || !booking?.proof_of_payment_url) {
            setCachedImageUrl(null);
            return;
        }

        const originalUrl = booking.proof_of_payment_url;

        // Check if already cached
        if (imageBlobCache.has(originalUrl)) {
            setCachedImageUrl(imageBlobCache.get(originalUrl));
            return;
        }

        // Fetch and cache as blob URL
        let cancelled = false;
        setImageLoading(true);

        fetch(originalUrl)
            .then(res => res.blob())
            .then(blob => {
                if (cancelled) return;
                const blobUrl = URL.createObjectURL(blob);
                imageBlobCache.set(originalUrl, blobUrl);
                setCachedImageUrl(blobUrl);
            })
            .catch(err => {
                console.error('[BookingDetailsModal] Image cache fetch failed:', err);
                if (!cancelled) setCachedImageUrl(originalUrl); // Fallback to original
            })
            .finally(() => {
                if (!cancelled) setImageLoading(false);
            });

        return () => { cancelled = true; };
    }, [isOpen, booking?.proof_of_payment_url]);

    if (!isOpen || !booking) return null;

    // Helper function to convert 24-hour time to 12-hour format
    const formatTime12Hour = (timeString) => {
        if (!timeString) return '';

        // Handle time format with or without seconds (e.g., "14:00" or "14:00:00")
        const [hours, minutes] = timeString.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHour = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);

        return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
    };

    // Calculate refund amount if rescheduled
    const calculateRefund = () => {
        if (!booking.rescheduled_from || !booking.rescheduled_from.original_total_price) {
            return null;
        }

        const originalPrice = parseFloat(booking.rescheduled_from.original_total_price) || 0;
        const newPrice = parseFloat(booking.total_price) || 0;
        const difference = originalPrice - newPrice;

        return {
            originalPrice,
            newPrice,
            difference,
            type: difference > 0 ? 'refund' : difference < 0 ? 'additional' : 'same'
        };
    };

    const refundInfo = calculateRefund();

    // Function to download the proof of payment
    const handleDownloadReceipt = async () => {
        if (!booking.proof_of_payment_url) {
            alert('No proof of payment available to download');
            return;
        }

        try {
            // Fetch the image
            const response = await fetch(booking.proof_of_payment_url);
            const blob = await response.blob();

            // Create a temporary URL for the blob
            const blobUrl = window.URL.createObjectURL(blob);

            // Create a temporary anchor element and trigger download
            const link = document.createElement('a');
            link.href = blobUrl;

            // Generate filename from booking details
            const fileName = `receipt_${booking.customer_name?.replace(/\s+/g, '_')}_${booking.booking_date}_${booking.id?.substring(0, 8)}.jpg`;
            link.download = fileName;

            // Append to body, click, and remove
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Clean up the blob URL
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            alert('Failed to download receipt. Please try again or view the image in a new tab.');
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Booking Details</h2>
                        <p className="text-sm text-gray-500 font-mono">ID: {booking.id?.substring(0, 8)}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 grid md:grid-cols-2 gap-8 overflow-y-auto">
                    {/* Left Column: Booking Info */}
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Customer Information</h3>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <User size={18} className="text-brand-green mt-0.5" />
                                    <div>
                                        <p className="font-semibold text-gray-900">{booking.customer_name}</p>
                                        <p className="text-xs text-gray-500">Customer Name</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Mail size={18} className="text-brand-green mt-0.5" />
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">{booking.customer_email}</p>
                                        <p className="text-xs text-gray-500">Email Address</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Phone size={18} className="text-brand-green mt-0.5" />
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">{booking.customer_phone}</p>
                                        <p className="text-xs text-gray-500">Phone Number</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <FileText size={18} className="text-brand-green mt-0.5" />
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm font-mono">{booking.notes || '-'}</p>
                                        <p className="text-xs text-gray-500">Reference Number</p>
                                    </div>
                                </div>

                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Booking Details</h3>
                            <div className="bg-brand-green-light/30 rounded-xl p-4 border border-brand-green/10 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-brand-green-dark">
                                        <MapPin size={16} />
                                        <span className="font-semibold text-sm">{booking.courts?.name || 'Court'}</span>
                                    </div>
                                    <Badge variant={booking.status === 'Confirmed' ? 'green' : booking.status === 'Cancelled' ? 'red' : 'orange'}>{booking.status}</Badge>
                                </div>
                                <div className="flex gap-4 text-sm text-gray-700">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar size={14} className="text-gray-400" />
                                        <span>{booking.booking_date ? format(new Date(booking.booking_date), 'MMMM d, yyyy') : '-'}</span>
                                    </div>
                                </div>
                                {/* Display individual time slots as ranges */}
                                {booking.booked_times && booking.booked_times.length > 0 && (
                                    <div className="mt-2">
                                        <div className="flex items-start gap-1.5">
                                            <Clock size={14} className="text-gray-400 mt-0.5" />
                                            <div className="flex flex-wrap gap-2">
                                                {booking.booked_times.map((time, idx) => {
                                                    // Calculate end time (1 hour after start)
                                                    const [hours, minutes] = time.split(':').map(Number);
                                                    const endHour = hours + 1;
                                                    const endTime = `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

                                                    return (
                                                        <span key={idx} className="text-sm font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                                                            {formatTime12Hour(time)} - {formatTime12Hour(endTime)}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="pt-2 border-t border-brand-green/10 flex justify-between items-center">
                                    <span className="text-xs text-gray-500">Total Amount</span>
                                    <span className="font-bold text-lg text-brand-orange">
                                        ₱{booking.total_price || 0}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Reschedule History with Refund Info */}
                        {booking.rescheduled_from && (
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <History size={16} className="text-brand-orange" />
                                    <h4 className="text-xs font-bold text-brand-orange uppercase tracking-wider">
                                        Rescheduled Booking
                                    </h4>
                                </div>
                                <div className="space-y-3 text-sm">
                                    {/* Original Booking Info */}
                                    <div className="bg-white/50 rounded-lg p-3 space-y-2">
                                        <p className="text-xs font-semibold text-gray-600 uppercase">Original Booking</p>
                                        <div>
                                            <span className="text-gray-600">Date:</span>
                                            <p className="font-semibold text-gray-900">
                                                {booking.rescheduled_from.original_date
                                                    ? format(new Date(booking.rescheduled_from.original_date), 'MMMM d, yyyy')
                                                    : '-'
                                                }
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Time:</span>
                                            <p className="font-semibold text-gray-900">
                                                {booking.rescheduled_from.original_booked_times?.map(t => formatTime12Hour(t)).join(', ') || '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-gray-600">Original Amount:</span>
                                            <p className="font-bold text-lg text-gray-900">
                                                ₱{booking.rescheduled_from.original_total_price || booking.total_price || 0}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Refund Calculation */}
                                    {refundInfo && refundInfo.type !== 'same' && (
                                        <div className={`rounded-lg p-3 ${refundInfo.type === 'refund'
                                            ? 'bg-green-50 border border-green-200'
                                            : 'bg-red-50 border border-red-200'
                                            }`}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <DollarSign size={16} className={refundInfo.type === 'refund' ? 'text-green-600' : 'text-red-600'} />
                                                <p className="text-xs font-semibold uppercase tracking-wider">
                                                    {refundInfo.type === 'refund' ? 'Refund Required' : 'Additional Payment Required'}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600">Original Total:</span>
                                                    <span className="font-semibold">₱{refundInfo.originalPrice}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-600">New Total:</span>
                                                    <span className="font-semibold">₱{refundInfo.newPrice}</span>
                                                </div>
                                                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                                    <span className={`font-bold ${refundInfo.type === 'refund' ? 'text-green-700' : 'text-red-700'
                                                        }`}>
                                                        {refundInfo.type === 'refund' ? 'Refund Amount:' : 'Additional Payment:'}
                                                    </span>
                                                    <span className={`font-bold text-lg flex items-center gap-1 ${refundInfo.type === 'refund' ? 'text-green-700' : 'text-red-700'
                                                        }`}>
                                                        {refundInfo.type === 'refund' ? (
                                                            <TrendingDown size={18} />
                                                        ) : (
                                                            <TrendingUp size={18} />
                                                        )}
                                                        ₱{Math.abs(refundInfo.difference).toFixed(2)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {refundInfo && refundInfo.type === 'same' && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                            <p className="text-sm text-blue-800 font-medium">
                                                ✓ No refund needed - Same price
                                            </p>
                                        </div>
                                    )}

                                    {/* Reason */}
                                    <div>
                                        <span className="text-gray-600">Reason:</span>
                                        <p className="font-medium text-gray-900 capitalize">
                                            {booking.rescheduled_from.reason || '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Rescheduled At:</span>
                                        <p className="text-xs text-gray-600">
                                            {booking.rescheduled_from.rescheduled_at
                                                ? format(new Date(booking.rescheduled_from.rescheduled_at), 'MMM d, yyyy h:mm a')
                                                : '-'
                                            }
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Proof of Payment */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <CreditCard size={14} /> Proof of Payment
                        </h3>
                        <div className="space-y-3">
                            {booking.proof_of_payment_url ? (
                                <div className="aspect-[3/4] bg-gray-100 rounded-xl border-2 border-gray-200 flex items-center justify-center overflow-hidden relative group">
                                    {imageLoading ? (
                                        <div className="flex flex-col items-center gap-3 text-gray-400">
                                            <Loader size={32} className="animate-spin text-brand-green" />
                                            <span className="text-sm font-medium">Loading receipt…</span>
                                        </div>
                                    ) : (
                                        <>
                                            <img
                                                src={cachedImageUrl || booking.proof_of_payment_url}
                                                alt="Proof of Payment"
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                onError={(e) => {
                                                    e.target.src = 'https://via.placeholder.com/400x600?text=Failed+to+load';
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <a
                                                    href={booking.proof_of_payment_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="bg-white text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                                                >
                                                    View Full Image
                                                </a>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="aspect-[3/4] bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center">
                                    <div className="text-center">
                                        <CreditCard size={40} className="text-gray-300 mx-auto mb-2" />
                                        <p className="text-sm text-gray-500">No proof of payment uploaded</p>
                                    </div>
                                </div>
                            )}
                            <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-lg flex gap-2 items-start">
                                <div className="mt-0.5 shrink-0">Note:</div>
                                <p>Bookings are automatically confirmed when customers submit payment. Verify proof of payment to ensure legitimacy.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between gap-3">
                    <Button variant="ghost" onClick={onClose}>Close</Button>
                    <div className="flex gap-2">
                        {(booking.status === 'Confirmed' || booking.status === 'Rescheduled') && (
                            <>
                                <Button
                                    onClick={() => onReschedule(booking)}
                                    className="bg-orange-50 text-brand-orange hover:bg-orange-100 border border-orange-200 flex items-center gap-2"
                                >
                                    <RefreshCw size={16} />
                                    Reschedule
                                </Button>
                                <Button onClick={() => { onUpdateStatus(booking.id, 'Cancelled'); onClose(); }} className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200">
                                    Cancel Booking
                                </Button>
                                <Button
                                    onClick={handleDownloadReceipt}
                                    disabled={!booking.proof_of_payment_url}
                                    className="bg-brand-green hover:bg-brand-green-dark text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Download size={16} />
                                    Download Receipt
                                </Button>
                            </>
                        )}
                        {booking.status === 'Cancelled' && (
                            <p className="text-sm text-gray-500 py-2">This booking has been cancelled</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}