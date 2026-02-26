import { format } from 'date-fns';
import { Calendar, Clock, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../ui';
import { BookingCalendar } from '../BookingCalendar';
import { calculatePriceForSlots, getDailyBookings } from '../../services/booking';

export function RescheduleModal({ isOpen, onClose, booking, onConfirm }) {
    const [step, setStep] = useState(1);
    const [reason, setReason] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTimes, setSelectedTimes] = useState([]);
    const [courtBookings, setCourtBookings] = useState([]);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);

    // Predefined reschedule reasons
    const rescheduleReasons = [
        'court maintenance',
        'weather conditions',
        'facility upgrades',
        'unexpected circumstances',
        'custom' // This will show the custom input field
    ];

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen && booking) {
            setStep(1);
            setReason('');
            setCustomReason('');
            setSelectedDate(null);
            setSelectedTimes([]);
            setCourtBookings([]);
            setCopied(false);
        }
    }, [isOpen, booking]);

    // Load bookings when date changes
    useEffect(() => {
        if (selectedDate && booking) {
            loadBookings();
        }
    }, [selectedDate, booking]);

    const loadBookings = async () => {
        if (!selectedDate || !booking) return;

        try {
            setLoading(true);
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const bookings = await getDailyBookings(dateStr);
            setCourtBookings(bookings || []);
        } catch (err) {
            console.error('Error loading bookings:', err);
            setCourtBookings([]);
        } finally {
            setLoading(false);
        }
    };

    // Get booked times for selected date
    const getBookedTimes = () => {
        const bookedSlots = new Set();

        if (!booking || !courtBookings || courtBookings.length === 0) {
            return Array.from(bookedSlots);
        }

        const court = booking.courts;
        const isExclusiveSelected = court?.type?.includes('Exclusive') || court?.type?.includes('Whole');

        courtBookings.forEach(courtBooking => {
            // Skip the current booking being rescheduled
            if (courtBooking.id === booking.id) {
                return;
            }

            let isConflict = false;

            // Check for conflicts
            if (courtBooking.court_id === booking.court_id) {
                isConflict = true;
            } else if (isExclusiveSelected) {
                isConflict = true;
            } else if (courtBooking.courts?.type?.includes('Exclusive') || courtBooking.courts?.type?.includes('Whole')) {
                isConflict = true;
            }

            if (isConflict && courtBooking.start_time && courtBooking.end_time) {
                if (courtBooking.booked_times && Array.isArray(courtBooking.booked_times) && courtBooking.booked_times.length > 0) {
                    courtBooking.booked_times.forEach(time => {
                        if (time && typeof time === 'string') {
                            const normalizedTime = time.substring(0, 5);
                            bookedSlots.add(normalizedTime);
                        }
                    });
                } else {
                    const startTime = courtBooking.start_time.substring(0, 5);
                    const endTime = courtBooking.end_time.substring(0, 5);
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

    // Format time to 12-hour format
    const formatTime12Hour = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
        return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`;
    };

    // Generate SMS message
    const generateSMSMessage = () => {
        if (!booking || !selectedDate || selectedTimes.length === 0) return '';

        const customerName = booking.customer_name;
        const courtName = booking.courts?.name || 'Court';

        // Original date and times
        const originalDate = format(new Date(booking.booking_date), 'MMM d, yyyy');
        const originalTimes = booking.booked_times && booking.booked_times.length > 0
            ? booking.booked_times.map(t => formatTime12Hour(t)).join(', ')
            : `${formatTime12Hour(booking.start_time)} - ${formatTime12Hour(booking.end_time)}`;

        // New date and times
        const newDate = format(selectedDate, 'MMM d, yyyy');
        const newTimes = selectedTimes.sort().map(t => formatTime12Hour(t)).join(', ');

        // Get the actual reason text
        const reasonText = reason === 'custom' ? customReason : reason;

        // Calculate new price
        const courtData = {
            price: booking.courts?.price || 0,
            pricing_rules: booking.courts?.pricing_rules || []
        };
        const newPrice = calculatePriceForSlots(selectedTimes, courtData);

        const message = `Good day, ${customerName}! Due to ${reasonText}, we need to reschedule your ${courtName} booking from ${originalDate} (${originalTimes}) to ${newDate} (${newTimes}). Total: ₱${newPrice}. Questions? Contact us. - ThePicklepointCebu`;

        return message;
    };

    // Copy SMS to clipboard
    const handleCopySMS = async () => {
        const message = generateSMSMessage();
        try {
            await navigator.clipboard.writeText(message);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            alert('Failed to copy to clipboard. Please copy manually.');
        }
    };

    // Handle reschedule confirmation
    const handleConfirm = () => {
        if (!selectedDate || selectedTimes.length === 0) {
            alert('Please select a new date and time slots');
            return;
        }

        if (!reason) {
            alert('Please select a reason for rescheduling');
            return;
        }

        if (reason === 'custom' && !customReason.trim()) {
            alert('Please enter a custom reason');
            return;
        }

        // Sort time slots
        const sortedSlots = [...selectedTimes].sort();
        const firstSlot = sortedSlots[0];
        const lastSlot = sortedSlots[sortedSlots.length - 1];

        // Calculate start and end times
        const startTime = firstSlot;
        const [hours] = lastSlot.split(':').map(Number);
        const endTime = `${(hours + 1).toString().padStart(2, '0')}:00`;

        // Calculate new price
        const courtData = {
            price: booking.courts?.price || 0,
            pricing_rules: booking.courts?.pricing_rules || []
        };
        const newPrice = calculatePriceForSlots(selectedTimes, courtData);

        const rescheduleData = {
            bookingId: booking.id,
            newDate: format(selectedDate, 'yyyy-MM-dd'),
            newStartTime: startTime,
            newEndTime: endTime,
            newBookedTimes: sortedSlots,
            newTotalPrice: newPrice,
            reason: reason === 'custom' ? customReason : reason,
            originalDate: booking.booking_date,
            originalStartTime: booking.start_time,
            originalEndTime: booking.end_time,
            originalBookedTimes: booking.booked_times
        };

        onConfirm(rescheduleData);
        onClose();
    };

    const bookedTimes = getBookedTimes();

    // Early return AFTER all hooks - follows Rules of Hooks
    if (!isOpen || !booking) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-orange-50/50 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Reschedule Booking</h2>
                        <p className="text-sm text-gray-500">
                            {booking.customer_name} • {booking.courts?.name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                    >
                        ✕
                    </button>
                </div>

                {/* Progress Steps */}
                <div className="px-6 py-4 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-brand-orange' : 'bg-gray-200'}`} />
                        <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-brand-orange' : 'bg-gray-200'}`} />
                        <div className={`h-2 flex-1 rounded-full transition-colors ${step >= 3 ? 'bg-brand-orange' : 'bg-gray-200'}`} />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-gray-500">
                        <span>Reason</span>
                        <span>New Date & Time</span>
                        <span>Review & Send</span>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {/* Step 1: Reason */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                    Why are you rescheduling this booking?
                                </h3>

                                <div className="space-y-3">
                                    {rescheduleReasons.map((reasonOption) => (
                                        <label
                                            key={reasonOption}
                                            className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${reason === reasonOption
                                                    ? 'border-brand-orange bg-orange-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="reason"
                                                value={reasonOption}
                                                checked={reason === reasonOption}
                                                onChange={(e) => setReason(e.target.value)}
                                                className="w-4 h-4 text-brand-orange"
                                            />
                                            <span className="text-gray-900 capitalize flex-1">
                                                {reasonOption === 'custom' ? 'Other (specify below)' : reasonOption}
                                            </span>
                                        </label>
                                    ))}
                                </div>

                                {reason === 'custom' && (
                                    <div className="mt-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Please specify the reason
                                        </label>
                                        <textarea
                                            value={customReason}
                                            onChange={(e) => setCustomReason(e.target.value)}
                                            placeholder="e.g., power outage, emergency repairs..."
                                            rows={3}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-orange focus:border-brand-orange outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button variant="ghost" onClick={onClose} className="flex-1">
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (!reason) {
                                            alert('Please select a reason');
                                            return;
                                        }
                                        if (reason === 'custom' && !customReason.trim()) {
                                            alert('Please enter a custom reason');
                                            return;
                                        }
                                        setStep(2);
                                    }}
                                    className="flex-1 bg-brand-orange hover:bg-brand-orange/90 text-white"
                                >
                                    Next: Select Date & Time
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Date & Time Selection */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    Select New Date & Time
                                </h3>
                                <p className="text-sm text-gray-500 mb-4">
                                    Choose the new date and time slots for this booking
                                </p>

                                {/* Show original booking info */}
                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                                    <p className="text-sm font-semibold text-blue-900 mb-2">📋 Original Booking Info</p>
                                    <div className="space-y-1 text-sm text-blue-800">
                                        <p>
                                            <strong>Date:</strong> {format(new Date(booking.booking_date), 'MMM d, yyyy')}
                                        </p>
                                        <p>
                                            <strong>Time Slots:</strong> {booking.booked_times && booking.booked_times.length > 0
                                                ? booking.booked_times.map(t => formatTime12Hour(t)).join(', ')
                                                : `${formatTime12Hour(booking.start_time)} - ${formatTime12Hour(booking.end_time)}`
                                            }
                                        </p>
                                        <p className="mt-2 text-xs bg-blue-100 px-2 py-1 rounded inline-block">
                                            💡 Customer booked <strong>{booking.booked_times?.length || 1} time slot{(booking.booked_times?.length || 1) !== 1 ? 's' : ''}</strong> - select the same amount or more/less as needed
                                        </p>
                                    </div>
                                </div>

                                <BookingCalendar
                                    selectedDate={selectedDate}
                                    onDateSelect={setSelectedDate}
                                    selectedTimes={selectedTimes}
                                    bookedTimes={bookedTimes}
                                    onTimeSelect={(time) => {
                                        const newTimes = selectedTimes.includes(time)
                                            ? selectedTimes.filter(t => t !== time)
                                            : [...selectedTimes, time];
                                        setSelectedTimes(newTimes);
                                    }}
                                    fullyBookedDates={[]}
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button variant="ghost" onClick={() => setStep(1)} className="flex-1">
                                    Back
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (!selectedDate) {
                                            alert('Please select a date');
                                            return;
                                        }
                                        if (selectedTimes.length === 0) {
                                            alert('Please select at least one time slot');
                                            return;
                                        }
                                        setStep(3);
                                    }}
                                    className="flex-1 bg-brand-orange hover:bg-brand-orange/90 text-white"
                                    disabled={!selectedDate || selectedTimes.length === 0}
                                >
                                    Next: Review ({selectedTimes.length} slot{selectedTimes.length !== 1 ? 's' : ''})
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Review & SMS */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    Review Changes
                                </h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    Review the changes and copy the SMS to send to the customer
                                </p>

                                {/* Comparison Table */}
                                <div className="bg-gray-50 rounded-xl p-4 space-y-4 mb-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Original */}
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">
                                                Original Booking
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Date:</span>
                                                    <p className="font-semibold text-gray-900">
                                                        {format(new Date(booking.booking_date), 'MMM d, yyyy')}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Time:</span>
                                                    <p className="font-semibold text-gray-900">
                                                        {booking.booked_times && booking.booked_times.length > 0
                                                            ? booking.booked_times.map(t => formatTime12Hour(t)).join(', ')
                                                            : `${formatTime12Hour(booking.start_time)} - ${formatTime12Hour(booking.end_time)}`
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* New */}
                                        <div>
                                            <h4 className="text-xs font-bold text-brand-orange uppercase mb-2">
                                                New Booking
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Date:</span>
                                                    <p className="font-semibold text-gray-900">
                                                        {format(selectedDate, 'MMM d, yyyy')}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Time:</span>
                                                    <p className="font-semibold text-gray-900">
                                                        {selectedTimes.sort().map(t => formatTime12Hour(t)).join(', ')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-gray-200">
                                        <span className="text-xs text-gray-500">Reason:</span>
                                        <p className="font-medium text-gray-900 capitalize">
                                            {reason === 'custom' ? customReason : reason}
                                        </p>
                                    </div>
                                </div>

                                {/* SMS Preview */}
                                <div className="space-y-3">
                                    <label className="block text-sm font-semibold text-gray-900">
                                        SMS Message to Send
                                    </label>
                                    <div className="relative">
                                        <textarea
                                            value={generateSMSMessage()}
                                            readOnly
                                            rows={5}
                                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl bg-gray-50 text-gray-900 text-sm font-mono resize-none"
                                        />
                                        <button
                                            onClick={handleCopySMS}
                                            className={`absolute top-2 right-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${copied
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-brand-orange text-white hover:bg-brand-orange/90'
                                                }`}
                                        >
                                            {copied ? (
                                                <>
                                                    <CheckCircle size={14} />
                                                    Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy size={14} />
                                                    Copy SMS
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 flex items-start gap-2">
                                        <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                        After confirming, copy this message and send it manually to the customer via your phone.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <Button variant="ghost" onClick={() => setStep(2)} className="flex-1">
                                    Back
                                </Button>
                                <Button
                                    onClick={handleConfirm}
                                    className="flex-1 bg-brand-orange hover:bg-brand-orange/90 text-white"
                                >
                                    Confirm Reschedule
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}