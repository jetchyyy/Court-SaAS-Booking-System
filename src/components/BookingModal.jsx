import { format } from 'date-fns';
import { Calendar, CheckCircle, Clock, CreditCard, Upload, AlertCircle, Loader, ScrollText, Download, FileText, Eye } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button } from './ui';
import { calculatePriceForSlots, checkTimeSlotConflicts } from '../services/booking';
import { getQrCodes } from '../services/qrCodes';

export function BookingModal({ isOpen, onClose, bookingData, onConfirm }) {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({ name: '', phone: '', email: '', reference: '', paymentProof: null });
    const [errors, setErrors] = useState({});
    const [paymentMethod, setPaymentMethod] = useState('gcash');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCompressing, setIsCompressing] = useState(false);
    const [originalFileSize, setOriginalFileSize] = useState(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState(null);
    const [submitError, setSubmitError] = useState(null);
    const [showConflictModal, setShowConflictModal] = useState(false); // Blocking conflict overlay
    const [showBlockedModal, setShowBlockedModal] = useState(false); // Admin-blocked slot overlay
    const [bookingResult, setBookingResult] = useState(null);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [qrCodes, setQrCodes] = useState(null); // loaded from Supabase CMS
    const prevIsOpen = useRef(isOpen);
    const isSubmittingRef = useRef(false); // Synchronous guard for double-submit (Bug 5)

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
            isSubmittingRef.current = false; // Reset synchronous guard
            setSubmitError(null);
            setShowConflictModal(false);
            setShowBlockedModal(false);
            setBookingResult(null);
            setTermsAccepted(false);
            setIsDownloading(false);
            setDownloadError(null);
            setOriginalFileSize(null);
            // Fetch latest QR codes from CMS (cached, so very fast on repeat opens)
            getQrCodes().then(setQrCodes).catch(() => {});
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

    // Validate Step 3 payment fields and advance to Review step
    const handleNextFromPayment = () => {
        const newErrors = {};
        if (!formData.reference) newErrors.reference = 'Last 4 digits are required';
        else if (formData.reference.length !== 4) newErrors.reference = 'Must be exactly 4 digits';
        if (!formData.paymentProof) newErrors.paymentProof = 'Proof of payment is required';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});
        setSubmitError(null);
        setStep(4);
    };

    // Submit the booking (called from Review step)
    const handleSubmit = async () => {
        // Bug 5 fix: Synchronous guard prevents double-submit
        if (isSubmittingRef.current) {
            console.log('Submit already in progress (ref guard), ignoring duplicate click');
            return;
        }
        isSubmittingRef.current = true;
        setIsSubmitting(true);
        setSubmitError(null);

        try {
            // Bug 4 fix: Fresh conflict check before submitting (bypasses stale cache)
            if (bookingData.court && bookingData.times?.length > 0) {
                console.log('Running fresh conflict check before submit...');
                const freshCheck = await checkTimeSlotConflicts(
                    bookingData.court.id,
                    bookingData.date ? format(bookingData.date, 'yyyy-MM-dd') : null,
                    bookingData.times,
                    { courtType: bookingData.court.type || '' }
                );

                if (freshCheck.hasConflict) {
                    const conflictTimes = freshCheck.conflicts.map(t => {
                        const [h] = t.split(':').map(Number);
                        const period = h >= 12 ? 'PM' : 'AM';
                        const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
                        return `${display}:00 ${period}`;
                    }).join(', ');

                    if (freshCheck.reason === 'admin_blocked') {
                        throw new Error(
                            `🚫 These time slots have been blocked by the admin and are no longer available for booking: ${conflictTimes}. Please select different time slots.`
                        );
                    }

                    throw new Error(
                        `❌ Time slot conflict! The following times were just booked by someone else: ${conflictTimes}. Please select different time slots.`
                    );
                }
            }
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
                setStep(5);
            } else {
                console.error('No booking ID found in result:', result);
                // Still proceed to success since the logs show it was created
                setStep(5);
            }
        } catch (error) {
            console.error('Booking submission error:', error);

            // Display user-friendly error message
            let errorMessage = error.message || 'An unexpected error occurred. Please try again.';

            // Admin-blocked slot error — force exit
            if (errorMessage.includes('blocked by the admin')) {
                setSubmitError(errorMessage);
                setShowBlockedModal(true);
                return;
            }

            // Check if it's a conflict error — show blocking modal
            if (errorMessage.includes('conflict') || errorMessage.includes('already booked')) {
                // Dispatch event to tell parent to refresh
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('bookingConflict'));
                }

                setSubmitError(errorMessage);
                setShowConflictModal(true); // Show blocking overlay
                return; // Don't set step, the modal overlay handles everything
            }

            setSubmitError(errorMessage);
            setStep(3);
        } finally {
            setIsSubmitting(false);
            isSubmittingRef.current = false; // Release synchronous guard
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
            setTermsAccepted(false);
            setIsDownloading(false);
            setDownloadError(null);
            setOriginalFileSize(null);
            onClose();
        }
    };

    // Format booked times as a readable range string e.g. "8:00 AM – 11:00 AM"
    const formatTimeRange = (times) => {
        if (!times || times.length === 0) return '-';
        const sorted = [...times].sort();
        const start = formatTime12Hour(sorted[0]);
        // End time = last slot start + 1 hour
        const [h, m] = sorted[sorted.length - 1].split(':').map(Number);
        const endH = (h + 1) % 24;
        const endPeriod = endH >= 12 ? 'PM' : 'AM';
        const endDisplay = (endH === 0 ? 12 : endH > 12 ? endH - 12 : endH).toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0') + ' ' + endPeriod;
        return `${start} – ${endDisplay}`;
    };

    // Build receipt data object used by both download functions
    const buildReceiptData = () => ({
        bookingId: bookingResult?.id || null,
        court: bookingData.court?.name || '-',
        date: bookingData.date ? format(bookingData.date, 'MMMM d, yyyy') : '-',
        time: bookingData.times?.length > 0
            ? formatTimeRange(bookingData.times)
            : (bookingData.time ? formatTime12Hour(bookingData.time) : '-'),
        duration: `${bookingData.times?.length || 1} hr${(bookingData.times?.length || 1) !== 1 ? 's' : ''}`,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        method: paymentMethod === 'gcash' ? 'GCash' : 'GoTyme',
        reference: `\u2022\u2022\u2022\u2022${formData.reference}`,
        total: `\u20b1${getDynamicPrice().toLocaleString()}`,
    });

    // Draw receipt onto an offscreen Canvas and return it (no DOM capture needed)
    const drawReceiptToCanvas = (data) => {
        const W = 420;
        const pad = 22;
        const dpr = 2;
        const rowH = 22;
        const sectionLabelH = 20;
        const divGap = 8;

        const sectionH = (n) => sectionLabelH + n * rowH + divGap;
        const headerH = 68;
        const idBandH = data.bookingId ? 46 : 0;
        const totalH =
            headerH + idBandH +
            pad + sectionH(4) +   // booking (4 rows)
            1 + divGap + sectionH(3) + // customer
            1 + divGap + sectionH(2) + // payment
            1 + divGap + rowH +        // total
            divGap + 36 +              // status badge
            pad;

        const canvas = document.createElement('canvas');
        canvas.width = W * dpr;
        canvas.height = totalH * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, totalH);

        let y = 0;

        // Header
        ctx.fillStyle = '#14B8A6';
        ctx.fillRect(0, 0, W, headerH);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 17px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Booking Receipt', W / 2, 30);
        ctx.fillStyle = '#ccfbf1';
        ctx.font = '12px Arial, sans-serif';
        ctx.fillText('Pickle Point Cebu', W / 2, 50);
        y = headerH;

        // Booking ID band
        if (data.bookingId) {
            ctx.fillStyle = '#f0fdf4';
            ctx.fillRect(0, y, W, idBandH);
            ctx.fillStyle = '#6b7280';
            ctx.font = '10px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Booking ID', W / 2, y + 14);
            ctx.fillStyle = '#0F766E';
            ctx.font = 'bold 12px Courier New, monospace';
            ctx.fillText(String(data.bookingId), W / 2, y + 34);
            y += idBandH;
            ctx.fillStyle = '#dcfce7';
            ctx.fillRect(0, y, W, 1);
            y += 1;
        }

        y += pad;

        const drawDivider = () => {
            ctx.fillStyle = '#e5e7eb';
            ctx.fillRect(pad, y, W - pad * 2, 1);
            y += 1 + divGap;
        };

        const drawSectionLabel = (label) => {
            ctx.textAlign = 'left';
            ctx.fillStyle = '#9ca3af';
            ctx.font = 'bold 10px Arial, sans-serif';
            ctx.fillText(label.toUpperCase(), pad, y + 13);
            y += sectionLabelH;
        };

        const drawRow = (label, value) => {
            ctx.textAlign = 'left';
            ctx.fillStyle = '#6b7280';
            ctx.font = '12px Arial, sans-serif';
            ctx.fillText(label, pad, y + 15);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#111827';
            ctx.font = '600 12px Arial, sans-serif';
            // Clip long values
            let display = String(value);
            while (ctx.measureText(display).width > W - pad * 2 - 90 && display.length > 6) {
                display = display.slice(0, -1);
            }
            if (display !== String(value)) display += '\u2026';
            ctx.fillText(display, W - pad, y + 15);
            y += rowH;
        };

        // Booking section
        drawSectionLabel('Booking');
        drawRow('Court', data.court);
        drawRow('Date', data.date);
        drawRow('Time', data.time);
        drawRow('Duration', data.duration);
        y += divGap;
        drawDivider();

        // Customer section
        drawSectionLabel('Customer');
        drawRow('Name', data.name);
        drawRow('Phone', data.phone);
        drawRow('Email', data.email);
        y += divGap;
        drawDivider();

        // Payment section
        drawSectionLabel('Payment');
        drawRow('Method', data.method);
        drawRow('Reference', data.reference);
        y += divGap;
        drawDivider();

        // Total row
        ctx.textAlign = 'left';
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 14px Arial, sans-serif';
        ctx.fillText('Total Paid', pad, y + 16);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#F97316';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.fillText(data.total, W - pad, y + 16);
        y += rowH + divGap;

        // Status badge
        ctx.fillStyle = '#f0fdf4';
        const bx = pad, bw = W - pad * 2, bh = 30, br = 8;
        ctx.beginPath();
        ctx.moveTo(bx + br, y);
        ctx.lineTo(bx + bw - br, y);
        ctx.quadraticCurveTo(bx + bw, y, bx + bw, y + br);
        ctx.lineTo(bx + bw, y + bh - br);
        ctx.quadraticCurveTo(bx + bw, y + bh, bx + bw - br, y + bh);
        ctx.lineTo(bx + br, y + bh);
        ctx.quadraticCurveTo(bx, y + bh, bx, y + bh - br);
        ctx.lineTo(bx, y + br);
        ctx.quadraticCurveTo(bx, y, bx + br, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#15803d';
        ctx.font = 'bold 12px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('\u2713  Status: Confirmed', W / 2, y + 20);

        return canvas;
    };

    const triggerDownload = (href, filename) => {
        const link = document.createElement('a');
        link.download = filename;
        link.href = href;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const isMobileDevice = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

    const handleDownloadImage = async () => {
        setIsDownloading(true);
        setDownloadError(null);
        try {
            const canvas = drawReceiptToCanvas(buildReceiptData());
            const filename = `booking-receipt-${bookingResult?.id || Date.now()}.png`;

            // Convert canvas to Blob
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

            if (isMobileDevice()) {
                // Tier 1: Web Share API — shows the native share sheet.
                // On iOS the user picks "Save Image" → goes to Photos.
                // On Android the user picks "Save to Photos" / gallery.
                // Note: iOS Safari sometimes drops the gesture chain after an await,
                // so we wrap in try/catch and fall through to the iOS-specific fallback.
                if (navigator.canShare) {
                    const file = new File([blob], filename, { type: 'image/png' });
                    try {
                        if (navigator.canShare({ files: [file] })) {
                            await navigator.share({
                                files: [file],
                                title: 'Booking Receipt',
                                text: 'Your Pickle Point Cebu booking receipt',
                            });
                            return;
                        }
                    } catch (shareErr) {
                        if (shareErr.name === 'AbortError') return; // user dismissed — not an error
                        // Share failed (gesture chain broken, etc.) — fall through below
                    }
                }

                // Tier 2 (iOS only): open image in a new tab.
                // The user can long-press the image → "Add to Photos" to save to their gallery.
                if (isIOS()) {
                    const dataUrl = canvas.toDataURL('image/png');
                    const newTab = window.open('', '_blank');
                    if (newTab) {
                        newTab.document.write(
                            `<!DOCTYPE html><html><head><title>Booking Receipt</title>
                            <meta name="viewport" content="width=device-width,initial-scale=1">
                            <style>
                                body{margin:0;background:#f3f4f6;display:flex;flex-direction:column;align-items:center;padding:16px;font-family:sans-serif;}
                                img{max-width:100%;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.15);}
                                .tip{background:#dcfce7;border:1px solid #bbf7d0;border-radius:10px;padding:12px 16px;margin-top:14px;font-size:13px;color:#166534;text-align:center;max-width:360px;}
                            </style></head><body>
                            <img src="${dataUrl}" alt="Booking Receipt" />
                            <div class="tip">📸 Long-press the image, then tap <strong>"Add to Photos"</strong> to save it to your gallery.</div>
                            </body></html>`
                        );
                        newTab.document.close();
                        return;
                    }
                }

                // Tier 3: Android without share support — direct blob download
                const url = URL.createObjectURL(blob);
                triggerDownload(url, filename);
                setTimeout(() => URL.revokeObjectURL(url), 10000);
            } else {
                // Desktop: always a direct download — no share sheet
                const url = URL.createObjectURL(blob);
                triggerDownload(url, filename);
                setTimeout(() => URL.revokeObjectURL(url), 10000);
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('Image download failed:', err);
            setDownloadError('Could not save image. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadPDF = async () => {
        setIsDownloading(true);
        setDownloadError(null);
        try {
            const canvas = drawReceiptToCanvas(buildReceiptData());
            const { default: jsPDF } = await import('jspdf');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfW = pdf.internal.pageSize.getWidth();
            const pdfH = (canvas.height * pdfW) / canvas.width;
            pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfW, pdfH);
            pdf.save(`booking-receipt-${bookingResult?.id || Date.now()}.pdf`);
        } catch (err) {
            console.error('PDF download failed:', err);
            setDownloadError('Could not save PDF. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity" onClick={handleClose}></div>

            {/* Admin-Blocked Slot Overlay */}
            {showBlockedModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm"></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-6 sm:p-8 text-center">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle size={36} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Time Slot Unavailable</h2>
                            <p className="text-sm text-gray-600 mb-4">
                                One or more of your selected time slots have been blocked by the admin and cannot be booked.
                            </p>
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left">
                                <p className="text-sm text-red-800 whitespace-pre-line">{submitError}</p>
                            </div>
                            <Button
                                size="lg"
                                className="w-full text-white bg-brand-green hover:bg-brand-green-dark"
                                onClick={() => {
                                    setShowBlockedModal(false);
                                    setSubmitError(null);
                                    handleClose();
                                }}
                            >
                                Close &amp; Select Different Time Slots
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Blocking Conflict Modal Overlay */}
            {showConflictModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm"></div>
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-6 sm:p-8 text-center">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle size={36} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Booking Conflict Detected</h2>
                            <p className="text-sm text-gray-600 mb-4">
                                Someone else has already booked the time slot(s) you selected. Your booking was not submitted.
                            </p>
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-left">
                                <p className="text-sm text-red-800 whitespace-pre-line">{submitError}</p>
                            </div>
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 text-left">
                                <p className="text-xs font-bold text-orange-900 mb-2">📌 What to do next:</p>
                                <ul className="text-xs text-orange-800 space-y-1.5 ml-4 list-disc">
                                    <li>Close this dialog and <strong>select different time slots</strong> from the availability modal</li>
                                    <li>Keep the <strong>same proof of payment</strong> — do NOT upload a new screenshot</li>
                                    <li>Select time slots with the <strong>same total price</strong> as what you already paid (₱{getDynamicPrice().toLocaleString()})</li>
                                    <li>You paid for <strong>{bookingData.times?.length || 1} hour(s)</strong>, so select {bookingData.times?.length || 1} slot(s)</li>
                                </ul>
                                <p className="text-xs text-red-700 font-semibold mt-3">
                                    ⚠️ If the price doesn't match what you paid, your booking will be INVALID!
                                </p>
                            </div>
                            <Button
                                size="lg"
                                className="w-full text-white bg-brand-green hover:bg-brand-green-dark"
                                onClick={() => {
                                    setShowConflictModal(false);
                                    setSubmitError(null);
                                    handleClose(); // Close the entire BookingModal
                                }}
                            >
                                Select New Time Slots
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-200 overflow-hidden max-h-[90vh] flex flex-col">

                {/* Fixed Header Section */}
                <div className="p-6 sm:p-8 pb-0 shrink-0">
                    {/* Progress Bar — hidden on success */}
                    {step !== 5 && (
                        <div className="flex items-center gap-2 mb-6">
                            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step >= 1 ? 'bg-brand-green' : 'bg-gray-100'}`} />
                            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step >= 2 ? 'bg-brand-green' : 'bg-gray-100'}`} />
                            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step >= 3 ? 'bg-brand-green' : 'bg-gray-100'}`} />
                            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step >= 4 ? 'bg-brand-green' : 'bg-gray-100'}`} />
                            <div className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${step >= 5 ? 'bg-brand-green' : 'bg-gray-100'}`} />
                        </div>
                    )}

                    {/* Header */}
                    <div className="text-center mb-2">
                        {step === 5 ? (
                            <>
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-in zoom-in duration-500">
                                    <CheckCircle size={34} className="text-green-600" />
                                </div>
                                <h2 className="text-2xl font-display font-bold text-gray-900">Booking Confirmed!</h2>
                                <p className="text-gray-500 text-sm mt-1">Your receipt is ready to download</p>
                                {bookingResult?.id && (
                                    <p className="text-xs text-gray-400 font-mono mt-1">ID: {bookingResult.id}</p>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-green-light text-brand-green-dark mb-4">
                                    {step === 1 && <CheckCircle size={24} />}
                                    {step === 2 && <ScrollText size={24} />}
                                    {step === 3 && <CreditCard size={24} />}
                                    {step === 4 && <Eye size={24} />}
                                </div>
                                <h2 className="text-2xl font-display font-bold text-brand-green-dark">
                                    {step === 1 && 'Confirm Booking'}
                                    {step === 2 && 'Terms & Conditions'}
                                    {step === 3 && 'Payment'}
                                    {step === 4 && 'Review Booking'}
                                </h2>
                                <p className="text-gray-500 text-sm mt-1">
                                    {step === 1 && "You're almost ready to play!"}
                                    {step === 2 && "Please read and accept before paying"}
                                    {step === 3 && "Scan to pay via GCash or GoTyme"}
                                    {step === 4 && "Review your details before confirming"}
                                </p>
                            </>
                        )}
                    </div>
                </div>

                {/* Content Section — scrollable for all steps */}
                <div className="p-6 sm:p-8 pt-4 overflow-y-auto custom-scrollbar">

                    {step === 1 && (
                        /* STEP 1: Details */
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">

                            {/* Non-conflict errors still show inline */}
                            {submitError && !showConflictModal && (
                                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex gap-3 animate-in slide-in-from-top duration-200">
                                    <AlertCircle size={24} className="text-red-600 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-red-900 mb-1">⚠️ Booking Error</p>
                                        <p className="text-xs text-red-800 whitespace-pre-line">{submitError}</p>
                                        <p className="text-xs text-red-700 mt-2">Please try again or contact support.</p>
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
                                        {bookingData.times?.length > 0 ? formatTimeRange(bookingData.times) : (bookingData.time ? formatTime12Hour(bookingData.time) : '-')}
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
                                <Button className="flex-1 text-white" onClick={handleNext}>Next</Button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        /* STEP 2: Terms & Conditions */
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            <div className="bg-gray-50 border border-gray-200 rounded-2xl overflow-hidden">
                                <div className="overflow-y-auto max-h-64 p-5 custom-scrollbar space-y-4 text-sm text-gray-700">
                                    <h4 className="font-bold text-gray-900 text-base mb-3">Terms and Conditions</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="font-semibold text-gray-800">1. Booking Confirmation</p>
                                            <p className="mt-1 leading-relaxed">All bookings are confirmed upon payment and are strictly non-refundable.</p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">2. No Refunds</p>
                                            <p className="mt-1 leading-relaxed">No refunds will be issued for cancellations, no-shows, or any changes in schedule.</p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">3. Corkage Policy</p>
                                            <p className="mt-1 leading-relaxed">Corkage applies to all non-exclusive bookings.</p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">4. Damages</p>
                                            <p className="mt-1 leading-relaxed">Any damage to court, equipment, or property will incur a minimum fine of ₱2,500-subject to assessment.</p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">5. Smoking Policy</p>
                                            <p className="mt-1 leading-relaxed">Smoking is strictly prohibited. A penalty of ₱500 will be charged if violated.</p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">6. Rain Rescheduling</p>
                                            <p className="mt-1 leading-relaxed">Rescheduling is allowed for rain only.</p>
                                            <ul className="mt-1 space-y-2 ml-4 list-disc leading-relaxed">
                                                <li>Must notify at least 1 hour before booking time.</li>
                                                <li>If raining 1 hour prior, booking may be moved within 30 days (subject to availability).</li>
                                                <li>If rain occurs within the first 30 minutes, session may be rescheduled.</li>
                                                <li>If rain occurs in the last 15 minutes, session is considered completed.</li>
                                                <li>If no rain 1 hour prior, booking proceeds as scheduled.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div
                                onClick={() => setTermsAccepted(prev => !prev)}
                                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer select-none transition-colors ${
                                    termsAccepted ? 'border-brand-green bg-green-50' : 'border-gray-200 bg-gray-50 hover:border-brand-green/50'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={termsAccepted}
                                    readOnly
                                    className="mt-0.5 w-4 h-4 accent-brand-green shrink-0 pointer-events-none"
                                />
                                <span className="text-sm text-gray-700 leading-snug">
                                    I have read and agree to the <span className="font-medium text-brand-green-dark">Terms and Conditions</span>
                                </span>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button variant="ghost" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                                <Button
                                    className="flex-1 text-white"
                                    disabled={!termsAccepted}
                                    onClick={() => { setErrors({}); setStep(3); }}
                                >
                                    Next: Pay
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        /* STEP 3: Payment */
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
                                            src={
                                                qrCodes
                                                    ? qrCodes[paymentMethod].image_url
                                                    : (paymentMethod === 'gcash' ? '/images/gcash.jpg' : '/images/gotyme.jpg')
                                            }
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
                                            {qrCodes ? qrCodes[paymentMethod].account_name : 'SYE SIMOLDE'}
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
                                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                                        ⚠️ Upload your <strong>GCash or GoTyme payment screenshot</strong> showing the reference number and amount. Make sure the screenshot is clear and legible to avoid delays in processing your booking.
                                    </p>
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
                                                    // Reject files over 10MB — too large even for compression
                                                    if (file.size > 10 * 1024 * 1024) {
                                                        setErrors({ ...errors, paymentProof: 'File is too large (max 10MB). Please screenshot your payment instead of uploading a photo.' });
                                                        e.target.value = '';
                                                        return;
                                                    }

                                                    setOriginalFileSize(file.size);

                                                    // Skip compression if already ≤100KB
                                                    if (file.size <= 100 * 1024) {
                                                        console.log(`[Receipt] Already small (${(file.size / 1024).toFixed(0)} KB), skipping compression`);
                                                        setFormData({ ...formData, paymentProof: file });
                                                        setErrors({ ...errors, paymentProof: '' });
                                                        return;
                                                    }

                                                    setIsCompressing(true);
                                                    try {
                                                        const { default: imageCompression } = await import('browser-image-compression');
                                                        const options = {
                                                            maxSizeMB: 0.1,          // Target ≤100KB
                                                            maxWidthOrHeight: 800,   // 800px is plenty to read receipt text
                                                            useWebWorker: true,
                                                            initialQuality: 0.5,     // Start lower for faster convergence
                                                            fileType: 'image/jpeg',  // Force JPEG for best compression ratio
                                                            maxIteration: 20,        // More passes to reliably hit the target
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
                                                            ? (
                                                                <span className="flex flex-col items-center gap-0.5">
                                                                    <span className="font-medium text-gray-700 truncate max-w-[220px]">{formData.paymentProof.name}</span>
                                                                    {originalFileSize && originalFileSize > formData.paymentProof.size ? (
                                                                        <span className="text-xs text-green-700">
                                                                            Compressed: {(originalFileSize / 1024).toFixed(0)} KB → <strong>{(formData.paymentProof.size / 1024).toFixed(0)} KB</strong>
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-400">{(formData.paymentProof.size / 1024).toFixed(0)} KB</span>
                                                                    )}
                                                                </span>
                                                            )
                                                            : 'Upload your GCash / GoTyme screenshot'}
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
                                    onClick={() => setStep(2)}
                                    disabled={isSubmitting}
                                >
                                    Back
                                </Button>
                                <Button
                                    className="flex-1 text-white"
                                    onClick={handleNextFromPayment}
                                    disabled={isSubmitting || isCompressing}
                                >
                                    Review Booking
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        /* STEP 4: Review & Confirm */
                        <div className="space-y-5 animate-in slide-in-from-right duration-300">

                            {submitError && !showConflictModal && (
                                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex gap-3 animate-in slide-in-from-top duration-200">
                                    <AlertCircle size={24} className="text-red-600 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-red-900 mb-1">⚠️ Booking Error</p>
                                        <p className="text-xs text-red-800 whitespace-pre-line">{submitError}</p>
                                    </div>
                                </div>
                            )}

                            {/* Booking Details */}
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Booking Details</p>
                                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                                        <span className="text-gray-500 text-sm">Court</span>
                                        <span className="font-semibold text-gray-800">{bookingData.court?.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                                        <span className="text-gray-500 text-sm flex items-center gap-1"><Calendar size={14} /> Date</span>
                                        <span className="font-semibold text-gray-800">
                                            {bookingData.date ? format(bookingData.date, 'MMM do, yyyy') : '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                                    <span className="text-gray-500 text-sm flex items-center gap-1"><Clock size={14} /> Time(s)</span>
                                    <span className="font-semibold text-gray-800 text-right max-w-[200px]">
                                        {bookingData.times?.length > 0 ? formatTimeRange(bookingData.times) : (bookingData.time ? formatTime12Hour(bookingData.time) : '-')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                        <span className="text-gray-500 text-sm">Total Amount</span>
                                        <span className="font-bold text-brand-orange text-lg">₱{getDynamicPrice().toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Personal Details */}
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Your Details</p>
                                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                                        <span className="text-gray-500 text-sm">Name</span>
                                        <span className="font-semibold text-gray-800">{formData.name}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                                        <span className="text-gray-500 text-sm">Phone</span>
                                        <span className="font-semibold text-gray-800">{formData.phone}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-sm">Email</span>
                                        <span className="font-semibold text-gray-800 truncate max-w-[200px]">{formData.email}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Details */}
                            <div>
                                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Payment</p>
                                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                                        <span className="text-gray-500 text-sm">Method</span>
                                        <span className="font-semibold text-gray-800">{paymentMethod === 'gcash' ? 'GCash' : 'GoTyme'}</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                                        <span className="text-gray-500 text-sm">Reference (last 4)</span>
                                        <span className="font-semibold text-gray-800 font-mono tracking-widest">••••{formData.reference}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-500 text-sm">Proof of Payment</span>
                                        <span className="font-semibold text-gray-800 text-right max-w-[180px] truncate text-xs">{formData.paymentProof?.name}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => { setSubmitError(null); setStep(3); }}
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
                                        'Confirm Booking'
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 5 && (
                        /* STEP 5: Success */
                        <div className="space-y-4 animate-in slide-in-from-right duration-300">

                            {/* Receipt Card */}
                            <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '2px solid #bbf7d0' }}>
                                {/* Receipt Header */}
                                <div className="p-4 text-center" style={{ backgroundColor: '#14B8A6' }}>
                                    <h3 className="font-bold text-lg" style={{ color: '#ffffff' }}>Booking Receipt</h3>
                                    <p className="text-xs mt-0.5" style={{ color: '#dcfce7' }}>Pickle Point Cebu</p>
                                </div>

                                {/* Booking ID */}
                                {bookingResult?.id && (
                                    <div className="px-4 py-2 text-center" style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #dcfce7' }}>
                                        <p className="text-xs text-gray-500">Booking ID</p>
                                        <p className="font-mono text-sm font-bold" style={{ color: '#0F766E' }}>{bookingResult.id}</p>
                                    </div>
                                )}

                                <div className="p-4 space-y-3">
                                    {/* Booking Info */}
                                    <div className="space-y-2 pb-3 border-b border-gray-100">
                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Booking</p>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Court</span>
                                            <span className="font-semibold text-gray-800">{bookingData.court?.name}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Date</span>
                                            <span className="font-semibold text-gray-800">
                                                {bookingData.date ? format(bookingData.date, 'MMMM d, yyyy') : '-'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Time Slot(s)</span>
                                            <span className="font-semibold text-gray-800 text-right max-w-[200px]" style={{ fontSize: '12px' }}>
                                                {bookingData.times?.length > 0 ? formatTimeRange(bookingData.times) : (bookingData.time ? formatTime12Hour(bookingData.time) : '-')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Hours</span>
                                            <span className="font-semibold text-gray-800">{bookingData.times?.length || 1} hr{(bookingData.times?.length || 1) !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>

                                    {/* Customer Info */}
                                    <div className="space-y-2 pb-3 border-b border-gray-100">
                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Customer</p>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Name</span>
                                            <span className="font-semibold text-gray-800">{formData.name}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Phone</span>
                                            <span className="font-semibold text-gray-800">{formData.phone}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Email</span>
                                            <span className="font-semibold text-gray-800 break-all text-xs">{formData.email}</span>
                                        </div>
                                    </div>

                                    {/* Payment Info */}
                                    <div className="space-y-2 pb-3 border-b border-gray-100">
                                        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Payment</p>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Method</span>
                                            <span className="font-semibold text-gray-800">{paymentMethod === 'gcash' ? 'GCash' : 'GoTyme'}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Reference</span>
                                            <span className="font-mono font-semibold text-gray-800">••••{formData.reference}</span>
                                        </div>
                                    </div>

                                    {/* Total */}
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-gray-800">Total Paid</span>
                                        <span className="font-bold text-xl" style={{ color: '#F97316' }}>₱{getDynamicPrice().toLocaleString()}</span>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="rounded-xl p-3 flex items-center justify-center gap-2" style={{ backgroundColor: '#f0fdf4' }}>
                                        <CheckCircle size={16} style={{ color: '#16a34a' }} />
                                        <span className="font-semibold text-sm" style={{ color: '#15803d' }}>Status: Confirmed</span>
                                    </div>
                                </div>
                            </div>

                            {downloadError && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex gap-2">
                                    <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-700">{downloadError}</p>
                                </div>
                            )}

                            {/* Download Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-brand-green text-brand-green-dark hover:bg-green-50"
                                    onClick={handleDownloadImage}
                                    disabled={isDownloading}
                                >
                                    {isDownloading ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
                                    Save as Image
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-brand-orange text-brand-orange hover:bg-orange-50"
                                    onClick={handleDownloadPDF}
                                    disabled={isDownloading}
                                >
                                    {isDownloading ? <Loader size={14} className="animate-spin" /> : <FileText size={14} />}
                                    Save as PDF
                                </Button>
                            </div>

                            <Button size="lg" className="w-full text-white" onClick={handleClose}>Done</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
