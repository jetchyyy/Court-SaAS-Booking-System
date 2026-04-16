import { format, startOfToday, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isBefore, isSameDay } from 'date-fns';
import { AlertCircle, ChevronLeft, ChevronRight, Clock, Lock, Unlock, X, Users } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabaseClient';
import { appendAuditLog } from '../../services/auditLogs';

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
        staleTime: 5 * 60 * 1000,
        cacheTime: 10 * 60 * 1000,
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

    const isExclusiveCourt = selectedCourt?.type === 'Exclusive / Whole Court';
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const normalizeTimeSlot = (timeSlot) => {
        if (!timeSlot || typeof timeSlot !== 'string') return '';
        return timeSlot.replace(':00:00', ':00').replace(':00.000000', ':00').split(':').slice(0, 2).join(':');
    };

    const getBookingSlots = (booking) => {
        if (!booking) return [];

        if (Array.isArray(booking.booked_times) && booking.booked_times.length > 0) {
            return booking.booked_times
                .map((slot) => normalizeTimeSlot(slot))
                .filter(Boolean);
        }

        if (!booking.start_time || !booking.end_time) return [];

        const startHour = parseInt(String(booking.start_time).substring(0, 2), 10);
        const endHour = parseInt(String(booking.end_time).substring(0, 2), 10);
        const slots = [];

        for (let hour = startHour; hour < endHour; hour += 1) {
            slots.push(`${hour.toString().padStart(2, '0')}:00`);
        }

        return slots;
    };

    // Fetch blocked slots with caching
    const { data: blockedSlots = [], isLoading: loadingBlocked } = useQuery({
        queryKey: isExclusiveCourt ? ['blockedSlots', 'all-courts', dateStr] : ['blockedSlots', selectedCourt?.id, dateStr],
        queryFn: async () => {
            if (!selectedCourt) return [];

            let q = supabase.from('blocked_time_slots').select('*').eq('blocked_date', dateStr);
            if (isExclusiveCourt && courts.length > 0) {
                q = q.in('court_id', courts.map(c => c.id));
            } else {
                q = q.eq('court_id', selectedCourt.id);
            }
            const { data, error } = await q;

            if (error) throw error;
            return data || [];
        },
        enabled: !!selectedCourt,
        staleTime: 2 * 60 * 1000,
        cacheTime: 5 * 60 * 1000,
    });

    // Fetch booked slots with caching
    const { data: bookedSlots = [], isLoading: loadingBooked } = useQuery({
        queryKey: isExclusiveCourt ? ['bookedSlots', 'all-courts', dateStr] : ['bookedSlots', selectedCourt?.id, dateStr],
        queryFn: async () => {
            if (!selectedCourt) return [];

            const { data, error } = await supabase
                .from('bookings')
                .select('*, courts(id, type)')
                .eq('booking_date', dateStr)
                .in('status', ['Confirmed', 'Rescheduled']);

            if (error) throw error;

            return (data || []).filter((booking) => {
                if (isExclusiveCourt) return true;
                return (
                    booking.court_id === selectedCourt.id ||
                    booking.courts?.type?.includes('Exclusive') ||
                    booking.courts?.type?.includes('Whole')
                );
            });
        },
        enabled: !!selectedCourt,
        staleTime: 1 * 60 * 1000,
        cacheTime: 3 * 60 * 1000,
    });

    // Mutation for blocking slots
    const blockSlotsMutation = useMutation({
        mutationFn: async (slots) => {
            const courtIds = isExclusiveCourt ? courts.map(c => c.id) : [selectedCourt.id];
            const blocksToInsert = courtIds.flatMap(courtId =>
                slots.map(slot => ({
                    court_id: courtId,
                    blocked_date: dateStr,
                    time_slot: slot,
                    reason: 'Admin blocked'
                }))
            );

            const { error } = await supabase
                .from('blocked_time_slots')
                .upsert(blocksToInsert, { onConflict: 'court_id,blocked_date,time_slot', ignoreDuplicates: true });

            if (error) throw error;
            return blocksToInsert;
        },
        onSuccess: () => {
            if (isExclusiveCourt) {
                queryClient.invalidateQueries(['blockedSlots', 'all-courts', dateStr]);
            } else {
                queryClient.invalidateQueries(['blockedSlots', selectedCourt?.id, dateStr]);
            }

            supabase.auth.getUser().then(({ data: authData }) => {
                appendAuditLog({
                    action: 'admin.timeslots.block',
                    description: `Blocked ${selectedUnblockedSlots.length} slot(s) on ${dateStr}${isExclusiveCourt ? ' for all courts' : ` for ${selectedCourt?.name || 'selected court'}`}`,
                    userId: authData?.user?.id || null,
                    userEmail: authData?.user?.email || null,
                    metadata: {
                        date: dateStr,
                        slots: selectedUnblockedSlots,
                        courtId: selectedCourt?.id || null,
                        applyAllCourts: !!isExclusiveCourt
                    }
                });
            }).catch((err) => {
                console.warn('Audit logging failed for block action:', err);
            });

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
            const courtIds = isExclusiveCourt ? courts.map(c => c.id) : [selectedCourt.id];
            const { error } = await supabase
                .from('blocked_time_slots')
                .delete()
                .in('court_id', courtIds)
                .eq('blocked_date', dateStr)
                .in('time_slot', slots);

            if (error) throw error;
            return slots;
        },
        onSuccess: () => {
            if (isExclusiveCourt) {
                queryClient.invalidateQueries(['blockedSlots', 'all-courts', dateStr]);
            } else {
                queryClient.invalidateQueries(['blockedSlots', selectedCourt?.id, dateStr]);
            }

            supabase.auth.getUser().then(({ data: authData }) => {
                appendAuditLog({
                    action: 'admin.timeslots.unblock',
                    description: `Unblocked ${selectedBlockedSlots.length} slot(s) on ${dateStr}${isExclusiveCourt ? ' for all courts' : ` for ${selectedCourt?.name || 'selected court'}`}`,
                    userId: authData?.user?.id || null,
                    userEmail: authData?.user?.email || null,
                    metadata: {
                        date: dateStr,
                        slots: selectedBlockedSlots,
                        courtId: selectedCourt?.id || null,
                        applyAllCourts: !!isExclusiveCourt
                    }
                });
            }).catch((err) => {
                console.warn('Audit logging failed for unblock action:', err);
            });

            setSelectedSlots([]);
        },
        onError: (err) => {
            console.error('Error unblocking slots:', err);
            alert('Failed to unblock time slots: ' + err.message);
        }
    });

    const handleBlockSlots = () => {
        if (selectedUnblockedSlots.length === 0) return;
        blockSlotsMutation.mutate(selectedUnblockedSlots);
    };

    const handleUnblockSlots = () => {
        if (selectedBlockedSlots.length === 0) return;
        unblockSlotsMutation.mutate(selectedBlockedSlots);
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

    const isSlotBlocked = (slotId) => {
        return blockedSlots.some(slot => {
            const normalizedSlot = normalizeTimeSlot(slot.time_slot);
            const normalizedId = normalizeTimeSlot(slotId);
            return normalizedSlot === normalizedId;
        });
    };

    const isSlotBooked = (slotId) => {
        return bookedSlots.some(booking => {
            const normalizedId = normalizeTimeSlot(slotId);
            return getBookingSlots(booking).some(slot => slot === normalizedId);
        });
    };

    const getBookingInfo = (slotId) => {
        return bookedSlots.find(booking => {
            const normalizedId = normalizeTimeSlot(slotId);
            return getBookingSlots(booking).some(slot => slot === normalizedId);
        });
    };

    const getBlockedCourtNames = (slotId) => {
        return blockedSlots
            .filter(slot => normalizeTimeSlot(slot.time_slot) === normalizeTimeSlot(slotId))
            .map(slot => courts.find(c => c.id === slot.court_id)?.name)
            .filter(Boolean);
    };

    const isBlocking = blockSlotsMutation.isLoading;
    const isUnblocking = unblockSlotsMutation.isLoading;
    const loading = loadingBlocked || loadingBooked || isBlocking || isUnblocking;

    // Split selected slots into unblocked (can be blocked) and blocked (can be unblocked)
    const selectedUnblockedSlots = selectedSlots.filter(id => !isSlotBlocked(id));
    const selectedBlockedSlots = selectedSlots.filter(id => isSlotBlocked(id));

    const TIME_SECTIONS = [
        { title: 'Early Morning', range: [0, 1, 2, 3, 4, 5] },
        { title: 'Morning', range: [6, 7, 8, 9, 10, 11] },
        { title: 'Afternoon', range: [12, 13, 14, 15, 16, 17] },
        { title: 'Evening', range: [18, 19, 20, 21, 22, 23] },
    ];

    return (
        <div className="space-y-6 w-full max-w-full overflow-x-hidden">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold font-display text-brand-green-dark">Time Slot Management</h1>
                <p className="text-gray-500 text-sm">Block or unblock time slots to control court availability</p>
            </div>

            {/* Exclusive court notice */}
            {isExclusiveCourt && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0" />
                    <span><strong>Exclusive / Whole Court</strong> — blocking or unblocking will apply to <strong>all courts</strong> simultaneously.</span>
                </div>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Calendar */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-display font-semibold text-lg text-brand-green-dark">
                            {format(currentMonth, 'MMMM yyyy')}
                        </h3>
                        <div className="flex gap-1">
                            <button
                                onClick={prevMonth}
                                disabled={isBefore(subMonths(currentMonth, 1), startOfMonth(today))}
                                className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronLeft size={18} className="text-gray-600" />
                            </button>
                            <button
                                onClick={nextMonth}
                                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                            >
                                <ChevronRight size={18} className="text-gray-600" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 mb-2">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                            <div key={index} className="text-center text-xs font-semibold text-gray-400 py-1.5">
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
                                <div key={day.toString()} className="flex justify-center py-1">
                                    <button
                                        onClick={() => {
                                            if (!isPast) {
                                                setSelectedDate(day);
                                                setSelectedSlots([]);
                                            }
                                        }}
                                        disabled={isPast}
                                        className={`
                                            h-9 w-9 rounded-full flex items-center justify-center text-sm transition-all duration-200
                                            ${isSelected ? 'bg-brand-green text-white font-bold shadow-sm ring-2 ring-brand-green ring-offset-1' : ''}
                                            ${!isSelected && isPast ? 'text-gray-300 cursor-not-allowed' : ''}
                                            ${!isSelected && !isPast ? 'hover:bg-brand-green/15 text-gray-700' : ''}
                                            ${!isSelected && isToday ? 'border-2 border-brand-green text-brand-green font-semibold' : ''}
                                        `}
                                    >
                                        {format(day, 'd')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend inside calendar card */}
                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-2">
                        {[
                            { color: 'bg-white border-2 border-gray-200', label: 'Available' },
                            { color: 'bg-red-50 border-2 border-red-300', label: 'Blocked' },
                            { color: 'bg-blue-50 border-2 border-blue-500 ring-2 ring-blue-300 ring-offset-1', label: 'Booked' },
                            { color: 'bg-brand-orange border-2 border-brand-orange', label: 'Selected' },
                        ].map(({ color, label }) => (
                            <div key={label} className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded shrink-0 ${color}`} />
                                <span className="text-xs text-gray-600 font-medium">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Time Slots */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
                    {/* Time slots header */}
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-display font-semibold text-lg text-brand-green-dark flex items-center gap-2">
                            <Clock size={17} />
                            <span>{format(selectedDate, 'MMM d, yyyy')}</span>
                        </h3>
                        {loading && (
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-green border-t-transparent" />
                        )}
                    </div>

                    {/* Court selector */}
                    <div className="flex items-center gap-3 mb-4">
                        <label className="text-sm font-semibold text-gray-600 whitespace-nowrap">Court:</label>
                        <select
                            value={selectedCourt?.id || ''}
                            onChange={(e) => {
                                const court = courts.find(c => c.id === e.target.value);
                                setSelectedCourt(court);
                                setSelectedSlots([]);
                            }}
                            className="flex-1 px-3 py-2 text-sm font-medium border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none bg-white text-gray-700"
                        >
                            {courts.map(court => (
                                <option key={court.id} value={court.id}>{court.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Inline action bar */}
                    <div className="flex items-center gap-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-sm text-gray-500 mr-auto">
                            {selectedSlots.length > 0
                                ? <><strong className="text-brand-green-dark">{selectedSlots.length}</strong> slot{selectedSlots.length > 1 ? 's' : ''} selected</>
                                : 'Click slots to select'
                            }
                        </span>
                        <button
                            onClick={handleBlockSlots}
                            disabled={selectedUnblockedSlots.length === 0 || isBlocking || isUnblocking}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                            {isBlocking
                                ? <><div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" /> Blocking...</>
                                : <><Lock size={13} /> Block ({selectedUnblockedSlots.length})</>
                            }
                        </button>
                        <button
                            onClick={handleUnblockSlots}
                            disabled={selectedBlockedSlots.length === 0 || isBlocking || isUnblocking}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg border-2 border-brand-green text-brand-green-dark hover:bg-brand-green-light disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                            {isUnblocking
                                ? <><div className="h-3.5 w-3.5 rounded-full border-2 border-brand-green border-t-transparent animate-spin" /> Unblocking...</>
                                : <><Unlock size={13} /> Unblock ({selectedBlockedSlots.length})</>
                            }
                        </button>
                        {selectedSlots.length > 0 && (
                            <button
                                onClick={() => setSelectedSlots([])}
                                disabled={isBlocking || isUnblocking}
                                className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Slots grid */}
                    <div className="space-y-4 overflow-y-auto flex-1" style={{ maxHeight: '420px' }}>
                        {TIME_SECTIONS.map((section, idx) => {
                            const sectionSlots = timeSlots.filter(slot =>
                                section.range.includes(parseInt(slot.id.split(':')[0]))
                            );

                            if (sectionSlots.length === 0) return null;

                            return (
                                <div key={idx}>
                                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-0.5">
                                        {section.title}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {sectionSlots.map((slot) => {
                                            const blocked = isSlotBlocked(slot.id);
                                            const booked = isSlotBooked(slot.id);
                                            const bookingInfo = getBookingInfo(slot.id);
                                            const selected = selectedSlots.includes(slot.id);
                                            const blockedCourtNames = blocked ? getBlockedCourtNames(slot.id) : [];

                                            return (
                                                <button
                                                    key={slot.id}
                                                    onClick={() => toggleSlot(slot.id, booked)}
                                                    disabled={booked}
                                                    title={booked ? (bookingInfo?.customer_name || bookingInfo?.user_name || 'Booked') : blocked ? `Blocked${blockedCourtNames.length ? ': ' + blockedCourtNames.join(', ') : ''}` : slot.label}
                                                    className={`
                                                        py-2 px-3 rounded-xl text-xs font-medium border-2 transition-all duration-150 text-left leading-snug
                                                        ${selected
                                                            ? 'bg-brand-orange text-white border-brand-orange shadow-sm'
                                                            : booked
                                                                ? 'bg-blue-50 border-blue-500 text-blue-700 cursor-not-allowed ring-2 ring-blue-300 ring-offset-1 shadow-sm shadow-blue-100'
                                                                : blocked
                                                                    ? 'bg-red-50 border-red-200 text-red-600'
                                                                    : 'bg-white border-gray-200 text-gray-600 hover:border-brand-green hover:text-brand-green hover:bg-brand-green/5'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="truncate text-[11px] font-semibold">{slot.label}</span>
                                                        {blocked && !selected && <Lock size={10} className="shrink-0 opacity-70" />}
                                                        {booked && <Users size={10} className="shrink-0 opacity-70" />}
                                                    </div>
                                                    {booked && bookingInfo && (
                                                        <div className="text-[10px] mt-0.5 truncate opacity-75">
                                                            {bookingInfo.customer_name || bookingInfo.user_name || 'Booked'}
                                                        </div>
                                                    )}
                                                    {blocked && !selected && blockedCourtNames.length > 0 && (
                                                        <div className="flex flex-wrap gap-0.5 mt-1">
                                                            {blockedCourtNames.map(name => (
                                                                <span key={name} className="inline-block bg-red-200 text-red-800 text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
                                                                    {name}
                                                                </span>
                                                            ))}
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
                </div>
            </div>
        </div>
    );
}
