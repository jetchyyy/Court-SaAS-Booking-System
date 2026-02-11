import { format, startOfToday, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isBefore, isSameDay } from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight, Clock, Lock, Unlock, X, Users } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabaseClient';

export function TimeSlotManagement() {
    const today = startOfToday();
    const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
    const [selectedDate, setSelectedDate] = useState(today);
    const [selectedCourt, setSelectedCourt] = useState(null);
    const [selectedSlots, setSelectedSlots] = useState([]);
    
    const queryClient = useQueryClient();

    // Fetch courts with caching
    const { data: courts = [] } = useQuery({
        queryKey: ['courts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('courts')
                .select('*')
                .order('name');

            if (error) throw error;
            return data || [];
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
        onSuccess: (data) => {
            if (data && data.length > 0 && !selectedCourt) {
                setSelectedCourt(data[0]);
            }
        }
    });

    // Set selected court when courts data loads
    if (courts.length > 0 && !selectedCourt) {
        setSelectedCourt(courts[0]);
    }

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    // Fetch blocked slots with caching
    const { data: blockedSlots = [], isLoading: loadingBlocked } = useQuery({
        queryKey: ['blockedSlots', selectedCourt?.id, dateStr],
        queryFn: async () => {
            if (!selectedCourt) return [];
            
            const { data, error } = await supabase
                .from('blocked_time_slots')
                .select('*')
                .eq('court_id', selectedCourt.id)
                .eq('blocked_date', dateStr);

            if (error) throw error;
            return data || [];
        },
        enabled: !!selectedCourt,
        staleTime: 2 * 60 * 1000, // 2 minutes
        cacheTime: 5 * 60 * 1000, // 5 minutes
    });

    // Fetch booked slots with caching
    const { data: bookedSlots = [], isLoading: loadingBooked } = useQuery({
        queryKey: ['bookedSlots', selectedCourt?.id, dateStr],
        queryFn: async () => {
            if (!selectedCourt) return [];
            
            const { data, error } = await supabase
                .from('bookings')
                .select('*')
                .eq('court_id', selectedCourt.id)
                .eq('booking_date', dateStr)
                .in('status', ['confirmed', 'pending']);

            if (error) throw error;
            return data || [];
        },
        enabled: !!selectedCourt,
        staleTime: 1 * 60 * 1000, // 1 minute (bookings change more frequently)
        cacheTime: 3 * 60 * 1000, // 3 minutes
    });

    // Mutation for blocking slots
    const blockSlotsMutation = useMutation({
        mutationFn: async (slots) => {
            const blocksToInsert = slots.map(slot => ({
                court_id: selectedCourt.id,
                blocked_date: dateStr,
                time_slot: slot,
                reason: 'Admin blocked'
            }));

            const { error } = await supabase
                .from('blocked_time_slots')
                .insert(blocksToInsert);

            if (error) throw error;
            return blocksToInsert;
        },
        onSuccess: () => {
            // Invalidate and refetch blocked slots
            queryClient.invalidateQueries(['blockedSlots', selectedCourt?.id, dateStr]);
            setSelectedSlots([]);
        },
        onError: (err) => {
            console.error('Error blocking slots:', err);
            alert('Failed to block time slots: ' + err.message);
        }
    });

    // Mutation for unblocking slots
    const unblockSlotsMutation = useMutation({
        mutationFn: async (slots) => {
            const { error } = await supabase
                .from('blocked_time_slots')
                .delete()
                .eq('court_id', selectedCourt.id)
                .eq('blocked_date', dateStr)
                .in('time_slot', slots);

            if (error) throw error;
            return slots;
        },
        onSuccess: () => {
            // Invalidate and refetch blocked slots
            queryClient.invalidateQueries(['blockedSlots', selectedCourt?.id, dateStr]);
            setSelectedSlots([]);
        },
        onError: (err) => {
            console.error('Error unblocking slots:', err);
            alert('Failed to unblock time slots: ' + err.message);
        }
    });

    const handleBlockSlots = () => {
        if (selectedSlots.length === 0) return;
        blockSlotsMutation.mutate(selectedSlots);
    };

    const handleUnblockSlots = () => {
        if (selectedSlots.length === 0) return;
        unblockSlotsMutation.mutate(selectedSlots);
    };

    const toggleSlot = (timeSlot, isBooked) => {
        if (isBooked) return;
        
        setSelectedSlots(prev => {
            if (prev.includes(timeSlot)) {
                return prev.filter(t => t !== timeSlot);
            } else {
                return [...prev, timeSlot];
            }
        });
    };

    // Generate calendar days
    const days = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
    });
    const startingDayIndex = getDay(startOfMonth(currentMonth));

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    // Generate time slots
    const timeSlots = Array.from({ length: 24 }, (_, i) => {
        const hour = i.toString().padStart(2, '0');
        const startPeriod = i < 12 ? 'AM' : 'PM';
        const startDisplayHour = i === 0 ? 12 : (i > 12 ? i - 12 : i);
        const endHourNum = (i + 1) % 24;
        const endPeriod = endHourNum < 12 ? 'AM' : 'PM';
        const endDisplayHour = endHourNum === 0 ? 12 : (endHourNum > 12 ? endHourNum - 12 : endHourNum);

        return {
            id: `${hour}:00`,
            label: `${startDisplayHour}:00${startPeriod} - ${endDisplayHour}:00${endPeriod}`
        };
    });

    const normalizeTimeSlot = (timeSlot) => {
        if (!timeSlot) return '';
        return timeSlot.replace(':00:00', ':00').replace(':00.000000', ':00').split(':').slice(0, 2).join(':');
    };

    const isSlotBlocked = (slotId) => {
        return blockedSlots.some(slot => {
            const normalizedSlot = normalizeTimeSlot(slot.time_slot);
            const normalizedId = normalizeTimeSlot(slotId);
            return normalizedSlot === normalizedId;
        });
    };

    const isSlotBooked = (slotId) => {
        return bookedSlots.some(booking => {
            const normalizedBooking = normalizeTimeSlot(booking.time_slot);
            const normalizedId = normalizeTimeSlot(slotId);
            return normalizedBooking === normalizedId;
        });
    };

    const getBookingInfo = (slotId) => {
        return bookedSlots.find(booking => {
            const normalizedBooking = normalizeTimeSlot(booking.time_slot);
            const normalizedId = normalizeTimeSlot(slotId);
            return normalizedBooking === normalizedId;
        });
    };

    const loading = loadingBlocked || loadingBooked || blockSlotsMutation.isLoading || unblockSlotsMutation.isLoading;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold font-display text-brand-green-dark">Time Slot Management</h1>
                <p className="text-gray-500">Block or unblock specific time slots to control availability</p>
            </div>

            {/* Court Selector */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Court</label>
                <select
                    value={selectedCourt?.id || ''}
                    onChange={(e) => {
                        const court = courts.find(c => c.id === e.target.value);
                        setSelectedCourt(court);
                        setSelectedSlots([]);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none"
                >
                    {courts.map(court => (
                        <option key={court.id} value={court.id}>{court.name}</option>
                    ))}
                </select>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Calendar */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
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

                    <div className="grid grid-cols-7 gap-y-2 mb-2">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                            <div key={index} className="text-center text-xs font-medium text-gray-400">
                                {day}
                            </div>
                        ))}

                        {Array.from({ length: startingDayIndex }).map((_, i) => (
                            <div key={`empty-${i}`} />
                        ))}

                        {days.map((day) => {
                            const isSelected = isSameDay(day, selectedDate);
                            const isPast = isBefore(day, today);
                            const isToday = isSameDay(day, today);

                            return (
                                <div key={day.toString()} className="flex justify-center relative">
                                    <button
                                        onClick={() => {
                                            if (!isPast) {
                                                setSelectedDate(day);
                                                setSelectedSlots([]);
                                            }
                                        }}
                                        disabled={isPast}
                                        className={`
                                            h-10 w-10 rounded-full flex items-center justify-center text-sm transition-all duration-200
                                            ${isSelected && 'bg-brand-green text-white font-bold shadow-md ring-2 ring-brand-green ring-offset-2'}
                                            ${!isSelected && isPast && 'text-gray-300 cursor-not-allowed'}
                                            ${!isSelected && !isPast && 'hover:bg-brand-green/20 text-gray-700 border border-transparent hover:border-brand-green'}
                                            ${!isSelected && isToday && 'border-2 border-brand-green text-brand-green font-semibold'}
                                        `}
                                    >
                                        {format(day, 'd')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Time Slots */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display font-semibold text-lg text-brand-green-dark flex items-center gap-2">
                            <Clock size={18} /> Time Slots
                        </h3>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {format(selectedDate, 'MMM dd, yyyy')}
                        </span>
                    </div>

                    {selectedSlots.length > 0 && (
                        <div className="mb-4 flex gap-2">
                            <Button
                                size="sm"
                                onClick={handleBlockSlots}
                                disabled={loading}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                            >
                                <Lock size={16} className="mr-2" /> Block Selected ({selectedSlots.length})
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleUnblockSlots}
                                disabled={loading}
                                className="flex-1"
                            >
                                <Unlock size={16} className="mr-2" /> Unblock Selected ({selectedSlots.length})
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedSlots([])}
                                className="text-gray-500"
                            >
                                <X size={16} />
                            </Button>
                        </div>
                    )}

                    {loading && (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green"></div>
                        </div>
                    )}

                    {!loading && (
                        <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
                            {[
                                { title: 'Early Morning (12AM - 5AM)', range: [0, 1, 2, 3, 4, 5] },
                                { title: 'Morning (6AM - 11AM)', range: [6, 7, 8, 9, 10, 11] },
                                { title: 'Afternoon (12PM - 5PM)', range: [12, 13, 14, 15, 16, 17] },
                                { title: 'Evening (6PM - 11PM)', range: [18, 19, 20, 21, 22, 23] },
                            ].map((section, idx) => {
                                const sectionSlots = timeSlots.filter(slot => {
                                    const hour = parseInt(slot.id.split(':')[0]);
                                    return section.range.includes(hour);
                                });

                                if (sectionSlots.length === 0) return null;

                                return (
                                    <div key={idx} className="space-y-3">
                                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                                            {section.title}
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {sectionSlots.map((slot) => {
                                                const blocked = isSlotBlocked(slot.id);
                                                const booked = isSlotBooked(slot.id);
                                                const bookingInfo = getBookingInfo(slot.id);
                                                const selected = selectedSlots.includes(slot.id);

                                                return (
                                                    <button
                                                        key={slot.id}
                                                        onClick={() => toggleSlot(slot.id, booked)}
                                                        disabled={booked}
                                                        className={`
                                                            py-2 px-3 rounded-xl text-xs font-medium border transition-all duration-200 relative
                                                            ${selected
                                                                ? 'bg-brand-orange text-white border-brand-orange shadow-md scale-105'
                                                                : booked
                                                                    ? 'bg-blue-50 border-blue-300 text-blue-700 cursor-not-allowed'
                                                                    : blocked
                                                                        ? 'bg-red-50 border-red-300 text-red-700'
                                                                        : 'bg-white border-gray-200 text-gray-600 hover:border-brand-green hover:text-brand-green'
                                                            }
                                                        `}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-[10px]">{slot.label}</span>
                                                            {blocked && <Lock size={12} />}
                                                            {booked && <Users size={12} />}
                                                        </div>
                                                        {booked && bookingInfo && (
                                                            <div className="text-[9px] mt-0.5 truncate text-left">
                                                                {bookingInfo.customer_name || bookingInfo.user_name || 'Booked'}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Legend */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-sm text-gray-700 mb-3">Legend</h4>
                <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-white border-2 border-gray-200"></div>
                        <span className="text-gray-600">Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-red-50 border-2 border-red-300"></div>
                        <span className="text-gray-600">Blocked by Admin</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-blue-50 border-2 border-blue-300"></div>
                        <span className="text-gray-600">Booked by Customer</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-brand-orange border-2 border-brand-orange"></div>
                        <span className="text-gray-600">Selected</span>
                    </div>
                </div>
            </div>
        </div>
    );
}