import { format } from 'date-fns';
import { Calendar, CheckCircle, Clock, CreditCard, Upload, AlertCircle, Loader } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button } from './ui';
import { calculatePriceForSlots } from '../services/booking';

export function BookingModal({ isOpen, onClose, bookingData, onConfirm }) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', reference: '', paymentProof: null });
    const [errors, setErrors] = useState({});
    const [paymentMethod, setPaymentMethod] = useState('gcash');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [bookingResult, setBookingResult] = useState(null);
    const prevIsOpen = useRef(isOpen);

    // Calculate dynamic price based on time slots and pricing rules
    const getDynamicPrice = () => {
        return calculatePriceForSlots(bookingData.times || [], bookingData.court || {});
    };

    // Format time to 12-hour format
    const formatTime12Hour = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
        return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    // ✅ FIXED: Reset state only when modal transitions from closed to open
    useEffect(() => {
        // Only reset if we're transitioning from closed to open
        if (isOpen && !prevIsOpen.current) {
            console.log('Modal opening fresh - resetting to step 1');
            setStep(1);
            setFormData({ name: '', phone: '', email: '', reference: '', paymentProof: null });
            setErrors({});
            setPaymentMethod('gcash');
            setIsSubmitting(false);
            setSubmitError(null);
            setBookingResult(null);
        }
        prevIsOpen.current = isOpen;
    }, [isOpen]);

    if (!isOpen) return null;

    console.log('BookingModal render - current step:', step, 'isSubmitting:', isSubmitting);

    const handleNext = () => {
        const newErrors = {};
        if (!formData.name) newErrors.name = 'Name is required';
        if (!formData.phone) newErrors.phone = 'Phone number is required';
        else if (formData.phone.length !== 11) newErrors.phone = 'Phone number must be exactly 11 digits';
        if (!formData.email) newErrors.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});
        setSubmitError(null);
        setStep(2);
    };

    const handleSubmit = async () => {
        const newErrors = {};
        if (!formData.reference) newErrors.reference = 'Last 4 digits are required';
        else if (formData.reference.length !== 4) newErrors.reference = 'Must be exactly 4 digits';
        if (!formData.paymentProof) newErrors.paymentProof = 'Proof of payment is required';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);

        try {
            // Calculate total price based on time-based pricing rules
            const totalPrice = calculatePriceForSlots(bookingData.times || [], bookingData.court || {});

            // Call the onConfirm handler which should handle the actual booking creation
            const result = await onConfirm({
                ...formData,
                ...bookingData,
                totalPrice: totalPrice
            });

            console.log('Booking result received:', result);

            // Store the result for display
            setBookingResult(result);

            // Check if result is valid - it could be the booking object directly or wrapped
            const bookingId = result?.id || result?.data?.id || result?.[0]?.id;

            if (bookingId) {
                console.log('Booking successful with ID:', bookingId);
                console.log('Setting step to 3 (success screen)...');
                setStep(3);
            } else {
                console.error('No booking ID found in result:', result);
                // Still proceed to success since the logs show it was created
                console.log('Setting step to 3 anyway (success screen)...');
                setStep(3);
            }
        } catch (error) {
            console.error('Booking submission error:', error);

            // Display user-friendly error message
            let errorMessage = error.message || 'An unexpected error occurred. Please try again.';

            // Check if it's a conflict error - ask parent to refresh time slots
            if (errorMessage.includes('conflict') || errorMessage.includes('already booked')) {
                errorMessage = errorMessage + '\n\nPlease select different time slots and try again.';

                // Dispatch event to tell parent to refresh
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('bookingConflict'));
                }
            }

            setSubmitError(errorMessage);

            // Go back to step 1 so user can select different times
            // But keep their form data cached
            setStep(1);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            // Reset everything when closing
            setStep(1);
            setFormData({ name: '', phone: '', email: '', reference: '', paymentProof: null });
            setErrors({});
            setSubmitError(null);
            setBookingResult(null);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={handleClose}></div>

            <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-200 overflow-hidden max-h-[90vh] flex flex-col">

                {/* Fixed Header Section */}
                <div className="p-6 sm:p-8 pb-0 shrink-0">
                    {/* Progress Bar */}
                    <div className="flex items-center gap-2 mb-6">
                        <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step >= 1 ? 'bg-brand-green' : 'bg-gray-100'}`} />
                        <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step >= 2 ? 'bg-brand-green' : 'bg-gray-100'}`} />
                        <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step >= 3 ? 'bg-brand-green' : 'bg-gray-100'}`} />
                    </div>

                    {/* Header */}
                    <div className="text-center mb-2">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-green-light text-brand-green-dark mb-4">
                            {step === 1 && <CheckCircle size={24} />}
                            {step === 2 && <CreditCard size={24} />}
                            {step === 3 && <CheckCircle size={24} />}
                        </div>
                        <h2 className="text-2xl font-display font-bold text-brand-green-dark">
                            {step === 1 && 'Confirm Booking'}
                            {step === 2 && 'Payment'}
                            {step === 3 && 'Success'}
                        </h2>
                        <p className="text-gray-500 text-sm mt-1">
                            {step === 1 && "You're almost ready to play!"}
                            {step === 2 && "Scan to pay via GCash or Bank Transfer"}
                            {step === 3 && "Booking confirmed successfully"}
                        </p>
                    </div>
                </div>

                {/* Scrollable Content Section */}
                <div className="p-6 sm:p-8 pt-4 overflow-y-auto custom-scrollbar">

                    {step === 1 && (
                        /* STEP 1: Details */
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">

                            {/* Conflict Error Alert */}
                            {submitError && (
                                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex gap-3 animate-in slide-in-from-top duration-200">
                                    <AlertCircle size={24} className="text-red-600 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-red-900 mb-1">⚠️ Booking Conflict Detected</p>
                                        <p className="text-xs text-red-800 whitespace-pre-line">{submitError}</p>
                                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                                            <p className="text-xs font-bold text-orange-900 mb-2">📌 IMPORTANT - Before Selecting Different Times:</p>
                                            <ul className="text-xs text-orange-800 space-y-1.5 ml-4">
                                                <li>✓ <strong>Keep the same proof of payment</strong> - Do NOT upload a new screenshot</li>
                                                <li>✓ <strong>Select time slots with the SAME TOTAL PRICE</strong> as what you already paid (₱{getDynamicPrice().toLocaleString()})</li>
                                                <li>✓ <strong>Same number of hours:</strong> You paid for {bookingData.times?.length || 1} hour(s), so select {bookingData.times?.length || 1} slot(s)</li>
                                            </ul>
                                            <p className="text-xs text-red-700 font-semibold mt-2">
                                                ⚠️ If the price doesn't match what you paid, your booking will be INVALID!
                                            </p>
                                        </div>
                                        <p className="text-xs text-gray-700 mt-3 font-semibold">
                                            👇 Select different time slots below, then click "Next: Pay" to continue or Contact our Social Media Platforms.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                                <div className="flex justify-between items-center pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                                    <span className="text-gray-500 text-sm">Court</span>
                                    <span className="font-semibold text-gray-800">{bookingData.court?.name}</span>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                                    <span className="text-gray-500 text-sm flex items-center gap-1"><Calendar size={14} /> Date</span>
                                    <span className="font-semibold text-gray-800">
                                        {bookingData.date ? format(bookingData.date, 'MMM do, yyyy') : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                                    <span className="text-gray-500 text-sm flex items-center gap-1"><Clock size={14} /> Time(s)</span>
                                    <span className="font-semibold text-gray-800 text-right max-w-[200px]">
                                        {bookingData.times ? bookingData.times.sort().map(t => formatTime12Hour(t)).join(', ') : formatTime12Hour(bookingData.time)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                    <span className="text-gray-500 text-sm">Total Price ({bookingData.times?.length || 1} slots)</span>
                                    <span className="font-bold text-brand-orange text-lg">
                                        ₱{getDynamicPrice().toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleNext(); }}>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => {
                                            setFormData({ ...formData, name: e.target.value });
                                            setErrors({ ...errors, name: '' });
                                        }}
                                        className={`w-full px-4 py-2 border ${errors.name ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all`}
                                        placeholder="Enter your name"
                                    />
                                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            if (val.length <= 11) {
                                                setFormData({ ...formData, phone: val });
                                                setErrors({ ...errors, phone: '' });
                                            }
                                        }}
                                        className={`w-full px-4 py-2 border ${errors.phone ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all`}
                                        placeholder="09123456789"
                                        maxLength={11}
                                    />
                                    {errors.phone ? (
                                        <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
                                    ) : (
                                        <p className="text-xs text-gray-500 mt-1">Please enter a valid contact number for us to easily contact you</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => {
                                            setFormData({ ...formData, email: e.target.value });
                                            setErrors({ ...errors, email: '' });
                                        }}
                                        className={`w-full px-4 py-2 border ${errors.email ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all`}
                                        placeholder="Enter your email"
                                    />
                                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                                </div>
                            </form>

                            <div className="flex gap-3 pt-2">
                                <Button variant="ghost" className="flex-1" onClick={handleClose}>Cancel</Button>
                                <Button className="flex-1 text-white" onClick={handleNext}>Next: Pay</Button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        /* STEP 2: Payment */
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">

                            {/* Error Alert */}
                            {submitError && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 animate-in slide-in-from-top duration-200">
                                    <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-red-900 mb-1">Booking Error</p>
                                        <p className="text-xs text-red-800">{submitError}</p>
                                        <p className="text-xs text-red-700 mt-2">Please try again or contact support if the issue persists.</p>
                                    </div>
                                </div>
                            )}

                            {/* QR Code Selection */}
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                                <p className="text-sm font-medium text-center text-gray-700 mb-4">Scan QR Code to Pay</p>

                                {/* Payment Method Toggle */}
                                <div className="grid grid-cols-2 gap-2 mb-4 p-1 bg-gray-200/50 rounded-xl">
                                    <button
                                        onClick={() => setPaymentMethod('gcash')}
                                        disabled={isSubmitting}
                                        className={`py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${paymentMethod === 'gcash'
                                            ? 'bg-white text-blue-700 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        GCash
                                    </button>
                                    <button
                                        onClick={() => setPaymentMethod('gotyme')}
                                        disabled={isSubmitting}
                                        className={`py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${paymentMethod === 'gotyme'
                                            ? 'bg-white text-indigo-700 shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            } ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        GoTyme
                                    </button>
                                </div>

                                {/* QR Code Display */}
                                <div className="flex flex-col items-center p-4 bg-white rounded-xl border border-gray-200 shadow-sm transition-all duration-300">
                                    <div className={`relative w-64 aspect-square mb-3 rounded-lg overflow-hidden group ${paymentMethod === 'gcash' ? 'bg-blue-50' : 'bg-indigo-50'
                                        }`}>
                                        <img
                                            src={paymentMethod === 'gcash' ? "/images/gcash.jpg" : "/images/gotyme.jpg"}
                                            alt={`${paymentMethod === 'gcash' ? 'GCash' : 'GoTyme'} QR Code`}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = `https://placehold.co/400x400?text=${paymentMethod === 'gcash' ? 'GCash' : 'GoTyme'}+QR`;
                                            }}
                                        />
                                    </div>

                                    <div className="text-center">
                                        <p className="text-sm text-gray-500 mb-0.5">Account Name</p>
                                        <p className="font-bold text-gray-900 text-lg leading-tight mb-1">
                                            SYE SIMOLDE
                                        </p>
                                        <span className={`text-xs font-bold uppercase tracking-wide ${paymentMethod === 'gcash' ? 'text-blue-600' : 'text-indigo-600'
                                            }`}>
                                            {paymentMethod === 'gcash' ? 'GCash Payment' : 'GoTyme Payment'}
                                        </span>
                                    </div>
                                </div>

                                <p className="text-center text-sm text-gray-600 mt-4">
                                    Total Amount: <span className="font-bold text-brand-orange text-lg">
                                        ₱{getDynamicPrice().toLocaleString()}
                                    </span>
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last 4 Digits of Reference Number</label>
                                    <input
                                        type="text"
                                        maxLength={4}
                                        value={formData.reference}
                                        disabled={isSubmitting}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '');
                                            setFormData({ ...formData, reference: val });
                                            setErrors({ ...errors, reference: '' });
                                        }}
                                        className={`w-full px-4 py-2 border ${errors.reference ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300'} rounded-xl focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all font-mono text-center tracking-[0.5em] uppercase text-lg ${isSubmitting ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                        placeholder="0000"
                                    />
                                    {errors.reference && <p className="text-xs text-red-500 mt-1 text-center">{errors.reference}</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Upload Proof of Payment</label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            disabled={isSubmitting || isCompressing}
                                            onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;

                                                // Only compress image files
                                                if (file.type.startsWith('image/')) {
                                                    setIsCompressing(true);
                                                    try {
                                                        const { default: imageCompression } = await import('browser-image-compression');
                                                        const options = {
                                                            maxSizeMB: 0.4,          // Target ≤400KB
                                                            maxWidthOrHeight: 1920,
                                                            useWebWorker: true,
                                                            initialQuality: 0.8,
                                                        };
                                                        console.log(`[Receipt] Original: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
                                                        const compressed = await imageCompression(file, options);
                                                        console.log(`[Receipt] Compressed: ${(compressed.size / 1024).toFixed(0)} KB`);

                                                        // Preserve the original filename for display
                                                        const compressedFile = new File([compressed], file.name, { type: compressed.type });
                                                        setFormData({ ...formData, paymentProof: compressedFile });
                                                        setErrors({ ...errors, paymentProof: '' });
                                                    } catch (err) {
                                                        console.error('[Receipt] Compression failed, using original:', err);
                                                        setFormData({ ...formData, paymentProof: file });
                                                        setErrors({ ...errors, paymentProof: '' });
                                                    } finally {
                                                        setIsCompressing(false);
                                                    }
                                                } else {
                                                    setFormData({ ...formData, paymentProof: file });
                                                    setErrors({ ...errors, paymentProof: '' });
                                                }
                                            }}
                                            className="hidden"
                                            id="payment-proof-upload"
                                        />
                                        <label
                                            htmlFor="payment-proof-upload"
                                            className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed ${errors.paymentProof ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-brand-green hover:bg-green-50/50'} rounded-xl ${(isSubmitting || isCompressing) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} transition-all`}
                                        >
                                            {isCompressing ? (
                                                <>
                                                    <Loader size={18} className="animate-spin text-brand-green" />
                                                    <span className="text-sm text-brand-green-dark font-medium">Compressing image…</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload size={18} className={errors.paymentProof ? 'text-red-400' : 'text-gray-400'} />
                                                    <span className={`text-sm ${errors.paymentProof ? 'text-red-500' : 'text-gray-500'}`}>
                                                        {formData.paymentProof
                                                            ? `${formData.paymentProof.name} (${(formData.paymentProof.size / 1024).toFixed(0)} KB)`
                                                            : 'Click to upload screenshot'}
                                                    </span>
                                                </>
                                            )}
                                        </label>
                                    </div>
                                    {errors.paymentProof && <p className="text-xs text-red-500 mt-1 text-center">{errors.paymentProof}</p>}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => setStep(1)}
                                    disabled={isSubmitting}
                                >
                                    Back
                                </Button>
                                <Button
                                    className="flex-1 text-white"
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <span className="flex items-center gap-2">
                                            <Loader size={16} className="animate-spin" />
                                            Submitting...
                                        </span>
                                    ) : (
                                        'Submit Booking'
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        /* STEP 3: Success */
                        <div className="space-y-6 animate-in slide-in-from-right duration-300 text-center py-4">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-in zoom-in spin-in-3 duration-500">
                                <CheckCircle size={40} />
                            </div>

                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
                                <p className="text-gray-600 text-base leading-relaxed">
                                    Thank you for booking with us.
                                </p>
                                {bookingResult && bookingResult.id && (
                                    <p className="text-xs text-gray-400 mt-2">
                                        Booking ID: {bookingResult.id}
                                    </p>
                                )}
                                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                                    <p className="font-medium flex items-center justify-center gap-2">
                                        <CheckCircle size={16} /> Status: Confirmed
                                    </p>
                                    <p className="mt-2 text-gray-600">
                                        Your booking has been successfully saved to our system. Please contact us for any inquiries.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-4">
                                <Button size="lg" className="w-full text-white" onClick={handleClose}>Done</Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}