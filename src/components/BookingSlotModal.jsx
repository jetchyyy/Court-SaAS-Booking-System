import { format } from 'date-fns';
import { CalendarDays, Clock, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BookingCalendar } from './BookingCalendar';
import { Button } from './ui';

function formatSelectedTimes(times = []) {
    if (!times.length) return 'No time selected yet';

    const sorted = [...times].sort();
    const start = sorted[0];
    const end = sorted[sorted.length - 1];

    const format12Hour = (timeStr) => {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    const [endHour, endMinute] = end.split(':').map(Number);
    const nextEndHour = (endHour + 1) % 24;
    const endLabel = `${nextEndHour === 0 ? 12 : (nextEndHour > 12 ? nextEndHour - 12 : nextEndHour)}:${endMinute.toString().padStart(2, '0')} ${nextEndHour >= 12 ? 'PM' : 'AM'}`;

    if (sorted.length === 1) {
        return `${format12Hour(start)} - ${endLabel}`;
    }

    return `${format12Hour(start)} - ${endLabel} (${sorted.length} slots)`;
}

export function BookingSlotModal({
    isOpen,
    onClose,
    onProceed,
    selectedCourt,
    selectedDate,
    selectedTimes,
    bookedTimes,
    fullyBookedDates,
    onDateSelect,
    onTimeSelect,
    validationError = ''
}) {
    const [step, setStep] = useState(1);

    useEffect(() => {
        if (isOpen) {
            setStep(1);
        }
    }, [isOpen, selectedCourt?.id]);

    useEffect(() => {
        if (step === 2 && !selectedDate) {
            setStep(1);
        }
    }, [step, selectedDate]);

    if (!isOpen || !selectedCourt) return null;

    const handleDateStepSelect = (date) => {
        onDateSelect(date);
        setStep(2);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-auto max-h-[94dvh] sm:max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="shrink-0 px-4 sm:px-7 py-2.5 sm:py-3.5 border-b border-gray-100 bg-linear-to-r from-brand-green-light via-white to-brand-orange-light">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
                            <div className="inline-flex px-2.5 py-0.5 bg-white/90 text-brand-orange text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-full border border-brand-orange/20">
                                Step {step} of 2
                            </div>
                            <div>
                                <h2 className="text-lg sm:text-2xl font-display font-bold text-brand-green-dark leading-tight">
                                    {step === 1 ? 'Choose a Date' : 'Choose Time Slot'}
                                </h2>
                                <p className="hidden sm:block text-xs sm:text-sm text-gray-600 mt-0.5">
                                    {step === 1 ? (
                                        <>Pick an available date for <span className="font-semibold text-brand-green-dark">{selectedCourt.name}</span>.</>
                                    ) : (
                                        <>Now choose an available time slot for <span className="font-semibold text-brand-green-dark">{selectedCourt.name}</span>.</>
                                    )}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-white/80 transition-colors"
                            aria-label="Close booking slot picker"
                        >
                            <X size={20} className="text-gray-600" />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2.5 sm:mt-3.5">
                        <div className="bg-white/90 rounded-lg sm:rounded-xl border border-white px-2.5 sm:px-3 py-2 sm:py-2.5">
                            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-bold">Court</p>
                            <p className="text-xs sm:text-sm font-semibold text-gray-800 mt-0.5 line-clamp-1">{selectedCourt.name}</p>
                        </div>
                        <div className="bg-brand-orange-light/60 rounded-lg sm:rounded-xl border border-brand-orange/30 px-2.5 sm:px-3 py-2 sm:py-2.5 shadow-sm">
                            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-brand-orange font-bold flex items-center gap-1">
                                <CalendarDays size={12} /> Date Selected
                            </p>
                            <p className="text-xs sm:text-base font-bold text-brand-green-dark mt-0.5">{format(selectedDate, 'MMMM d, yyyy')}</p>
                        </div>
                        <div className="col-span-2 sm:col-span-1 bg-white/90 rounded-lg sm:rounded-xl border border-white px-2.5 sm:px-3 py-2 sm:py-2.5">
                            <p className="text-[10px] sm:text-xs uppercase tracking-wider text-gray-400 font-bold flex items-center gap-1">
                                <Clock size={12} /> Selected
                            </p>
                                <p className="text-xs sm:text-sm font-semibold text-gray-800 mt-0.5 line-clamp-2">
                                {step === 1 ? 'Choose a date first' : formatSelectedTimes(selectedTimes)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-7 py-4 sm:py-5">
                    {step === 2 && (
                        <div className="mb-6 rounded-2xl border border-brand-orange/20 bg-brand-orange-light/40 px-4 py-3">
                            <p className="text-xs font-bold uppercase tracking-wider text-brand-orange">Selected Date</p>
                            <p className="mt-1 text-base font-semibold text-brand-green-dark">{format(selectedDate, 'MMMM d, yyyy')}</p>
                        </div>
                    )}

                    <BookingCalendar
                        selectedDate={selectedDate}
                        onDateSelect={handleDateStepSelect}
                        selectedTimes={selectedTimes}
                        bookedTimes={bookedTimes}
                        fullyBookedDates={fullyBookedDates}
                        onTimeSelect={onTimeSelect}
                        showInstructions={false}
                        showTimeSlots={step === 2}
                        showDatePicker={step === 1}
                    />
                </div>

                <div className="shrink-0 px-4 sm:px-7 py-3 sm:py-4 border-t border-gray-100 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            {validationError ? (
                                <p className="text-sm font-medium text-red-500">{validationError}</p>
                            ) : step === 1 ? (
                                <p className="text-sm text-gray-500">Select your preferred date first, then continue to time slots.</p>
                            ) : (
                                <p className="text-sm text-gray-500">Choose at least one available time slot to continue.</p>
                            )}
                        </div>

                        <div className="flex gap-3">
                            {step === 1 ? (
                                <>
                                    <Button variant="ghost" onClick={onClose}>
                                        Cancel
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button variant="ghost" onClick={() => setStep(1)}>
                                        Back to Dates
                                    </Button>
                                    <Button
                                        className="text-white"
                                        onClick={onProceed}
                                        disabled={selectedTimes.length === 0}
                                    >
                                        Continue to Details
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
