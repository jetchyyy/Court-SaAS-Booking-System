import {
    addDays,
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    format,
    getDay,
    isBefore,
    isSameDay,
    isSameMonth,
    startOfMonth,
    startOfToday,
    subMonths
} from 'date-fns';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useState } from 'react';
import { cn } from './ui';

export function BookingCalendar({ selectedDate, onDateSelect, selectedTimes = [], onTimeSelect, bookedTimes = [], fullyBookedDates = [] }) {
    const today = startOfToday();
    const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));

    // Generate days for the current month view
    const days = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
    });

    // Calculate starting empty slots (0 = Sunday, 1 = Monday, etc.)
    const startingDayIndex = getDay(startOfMonth(currentMonth));

    // Previous and Next Month handlers
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    // Generate 24-hour time slots with ranges (e.g., "8:00AM - 9:00AM")
    const timeSlots = Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, '0');
        const nextHour = ((i + 1) % 24).toString().padStart(2, '0');

        // Start time
        const startPeriod = i < 12 ? 'AM' : 'PM';
        const startDisplayHour = i === 0 ? 12 : (i > 12 ? i - 12 : i);

        // End time (1 hour later)
        const endHourNum = (i + 1) % 24;
        const endPeriod = endHourNum < 12 ? 'AM' : 'PM';
        const endDisplayHour = endHourNum === 0 ? 12 : (endHourNum > 12 ? endHourNum - 12 : endHourNum);

        return {
            id: `${hour}:00`,
            label: `${startDisplayHour}:00${startPeriod} - ${endDisplayHour}:00${endPeriod}`
        };
    });

    // Helper function to determine if time slot needs a date note
    const getDateNote = (slotId) => {
        const hour = parseInt(slotId.split(':')[0]);
        const nextDay = addDays(selectedDate, 1);

        // 11PM-12AM (23:00) - ends on next day
        if (hour === 23) {
            return `Ends on ${format(nextDay, 'MMM dd')}`;
        }
        // 12AM-6AM (00:00-05:00) - is on next day

        return null;
    };

    return (
        <div className="space-y-8">
            {/* Legend */}
            <div className="flex flex-wrap gap-4 items-center text-sm px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-white border-2 border-brand-green"></div>
                    <span className="text-gray-700">Available</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-brand-orange/30 border-2 border-brand-orange"></div>
                    <span className="text-gray-700">Partially Booked</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-red-100 border-2 border-red-400"></div>
                    <span className="text-gray-700">Fully Booked</span>
                </div>
            </div>

            {/* Calendar Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold text-lg text-brand-green-dark">
                        {format(currentMonth, 'MMMM yyyy')}
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={prevMonth}
                            disabled={isBefore(subMonths(currentMonth, 1), startOfMonth(today))}
                            className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                        >
                            <ChevronLeft size={20} className="text-gray-600" />
                        </button>
                        <button
                            onClick={nextMonth}
                            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <ChevronRight size={20} className="text-gray-600" />
                        </button>
                    </div>
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-y-2 mb-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                        <div key={index} className="text-center text-xs font-medium text-gray-400">
                            {day}
                        </div>
                    ))}

                    {/* Empty slots for start of month */}
                    {Array.from({ length: startingDayIndex }).map((_, i) => (
                        <div key={`empty-${i}`} />
                    ))}

                    {days.map((day, dayIdx) => {
                        const isSelected = isSameDay(day, selectedDate);
                        const isPast = isBefore(day, today);
                        const isTodayDate = isSameDay(day, today);

                        // Check if this day has a booking status
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dateStatus = fullyBookedDates.find(d => d.date === dateStr);
                        const isFullyBooked = dateStatus?.status === 'fully-booked';
                        const isPartiallyBooked = dateStatus?.status === 'partially-booked';

                        return (
                            <div key={day.toString()} className="flex justify-center relative">
                                <button
                                    onClick={() => !isPast && !isFullyBooked && onDateSelect(day)}
                                    disabled={isPast || isFullyBooked}
                                    className={cn(
                                        'h-10 w-10 rounded-full flex items-center justify-center text-sm transition-all duration-200 relative',
                                        isSelected && 'bg-brand-green text-white font-bold shadow-md ring-2 ring-brand-green ring-offset-2',
                                        !isSelected && isPast && 'text-gray-300 cursor-not-allowed',
                                        !isSelected && !isPast && isFullyBooked && 'bg-red-100 border-2 border-red-400 text-red-600 font-semibold cursor-not-allowed',
                                        !isSelected && !isPast && isPartiallyBooked && 'bg-brand-orange/30 border-2 border-brand-orange text-gray-700 hover:bg-brand-orange/40',
                                        !isSelected && !isPast && !isFullyBooked && !isPartiallyBooked && 'hover:bg-brand-green/20 text-gray-700 border border-transparent hover:border-brand-green',
                                        !isSelected && isTodayDate && !isFullyBooked && 'border-2 border-brand-green text-brand-green font-semibold',
                                    )}
                                    title={
                                        isFullyBooked
                                            ? 'All time slots are booked for this date'
                                            : isPartiallyBooked
                                                ? 'Some time slots are booked for this date'
                                                : undefined
                                    }
                                >
                                    {format(day, 'd')}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Time Slots */}
            <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold text-lg text-brand-green-dark flex items-center gap-2">
                        <Clock size={18} /> Available Times
                    </h3>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">Select multiple</span>
                </div>

                {/* Instruction Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                    <p className="text-sm font-semibold text-blue-900">📋 How to Select Your Time Slots</p>
                    <ul className="text-xs text-blue-800 space-y-1.5 ml-2">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold mt-0.5">1.</span>
                            <span><strong>Click the time slots</strong> you want to book. Each slot is <strong>1 hour</strong> long.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold mt-0.5">2.</span>
                            <span>You can select <strong>multiple times</strong> - even non-consecutive hours (e.g., 7AM and 7PM).</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold mt-0.5">3.</span>
                            <span>Selected times appear <strong className="text-orange-600">highlighted in orange</strong>. Your total price will adjust accordingly.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold mt-0.5">4.</span>
                            <span><strong className="text-purple-600">⚠️ Times after 11PM cross into the next day.</strong> Check the date notes on each slot.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-600 font-bold mt-0.5">5.</span>
                            <span>Once selected, click <strong>"Next"</strong> to proceed with your booking.</span>
                        </li>
                    </ul>
                </div>

                <div className="space-y-6">
                    {/* Time Sections */}
                    {[
                        { title: 'Early Morning (12AM - 5AM)', range: [0, 1, 2, 3, 4, 5], note: 'Strictly No Walk-ins 12AM - 5AM' },
                        { title: 'Morning (6AM - 11AM)', range: [6, 7, 8, 9, 10, 11] },
                        { title: 'Afternoon (12PM - 5PM)', range: [12, 13, 14, 15, 16, 17] },
                        { title: 'Evening (6PM - 11PM)', range: [18, 19, 20, 21, 22, 23] },
                    ].map((section, idx) => {
                        // Filter slots for this section
                        const sectionSlots = timeSlots.filter(slot => {
                            const hour = parseInt(slot.id.split(':')[0]);
                            return section.range.includes(hour);
                        });

                        if (sectionSlots.length === 0) return null;

                        return (
                            <div key={idx} className="space-y-3">
                                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    {section.title}
                                    {section.note && (
                                        <span className="text-brand-orange text-xs normal-case font-bold px-2 py-0.5 bg-orange-50 rounded-full border border-orange-100">
                                            {section.note}
                                        </span>
                                    )}
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {sectionSlots.map((slot) => {
                                        const isSelected = selectedTimes.includes(slot.id);
                                        const isBooked = bookedTimes.includes(slot.id);
                                        const dateNote = getDateNote(slot.id);

                                        return (
                                            <button
                                                key={slot.id}
                                                onClick={() => !isBooked && onTimeSelect(slot.id)}
                                                disabled={isBooked}
                                                className={cn(
                                                    'py-2 px-3 rounded-xl text-sm font-medium border transition-all duration-200 relative',
                                                    isBooked
                                                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                                                        : isSelected
                                                            ? 'bg-brand-orange text-white border-brand-orange shadow-md scale-105'
                                                            : 'bg-white border-gray-200 text-gray-600 hover:border-brand-orange hover:text-brand-orange'
                                                )}
                                                title={isBooked ? 'This time slot is already booked' : undefined}
                                            >
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span>{slot.label}</span>
                                                    {dateNote && !isBooked && (
                                                        <span className={cn(
                                                            "text-[10px] font-semibold",
                                                            isSelected ? "text-orange-100" : "text-purple-600"
                                                        )}>
                                                            {dateNote}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}