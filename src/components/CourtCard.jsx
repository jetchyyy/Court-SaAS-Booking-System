import { MapPin, Users, DollarSign, X, Info } from 'lucide-react';
import { Badge, Button, Card } from './ui';
import { useState } from 'react';

export function CourtCard({ court, onBook }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const courtTypeLabel = court.type?.trim() || 'Court';

    // Format hour to 12-hour format
    const formatHour12 = (hour) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
        return `${displayHour.toString().padStart(2, '0')}:00 ${period}`;
    };

    // Check if court has dynamic pricing rules
    const hasPricingRules = court.pricing_rules && court.pricing_rules.length > 0;

    // Get max players (default to 10 if not set)
    const maxPlayers = court.max_players || 10;

    // Check if court is active (default to true if not specified)
    const isActive = court.is_active !== false;

    return (
        <>
            <Card className={`group h-full flex flex-col ${!isActive ? 'opacity-75' : ''}`}>
                <div
                    className="relative h-48 overflow-hidden bg-gray-100 cursor-pointer"
                    onClick={() => setIsExpanded(true)}
                >
                    <img
                        src={(court.images && court.images[0]?.url) || court.image || '/images/court1.jpg'}
                        alt={court.name}
                        className={`w-full h-full object-cover transition-transform duration-500 ${isActive ? 'group-hover:scale-110' : 'grayscale'}`}
                        onError={(e) => { e.target.src = '/images/court1.jpg'; }}
                    />
                    <div className="absolute top-4 right-4">
                        <Badge variant={isActive ? (court.status === 'Available' ? 'green' : 'gray') : 'red'}>
                            {isActive ? (court.status || 'Available') : 'Unavailable'}
                        </Badge>
                    </div>
                    {/* Info overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                        <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-medium text-gray-700">
                            <Info size={14} />
                            Click to view details
                        </div>
                    </div>
                    {!isActive && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm">
                                COURT UNAVAILABLE
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h3 className="font-display font-bold text-lg text-brand-green-dark">{court.name}</h3>
                            <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
                                <MapPin size={14} />
                                <span>{courtTypeLabel}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="block font-bold text-brand-orange text-lg">₱{court.price}</span>
                            <span className="text-xs text-gray-400">/ hour</span>
                        </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{court.description}</p>

                    {/* See More button for description */}
                    {court.description && court.description.length > 80 && (
                        <button
                            onClick={() => setIsExpanded(true)}
                            className="text-xs text-brand-green hover:text-brand-green-dark font-medium mb-3 text-left underline"
                        >
                            See full description →
                        </button>
                    )}

                    {/* Dynamic Pricing Rules Badge */}
                    {hasPricingRules && isActive && (
                        <div className="mb-3 p-2.5 bg-brand-orange/10 border border-brand-orange/30 rounded-lg">
                            <div className="flex items-start gap-2">
                                <DollarSign size={14} className="text-brand-orange mt-0.5 flex-shrink-0" />
                                <div className="text-xs space-y-1.5 flex-1">
                                    <p className="font-semibold text-brand-orange">Time-Based Pricing</p>
                                    {court.pricing_rules.map((rule, idx) => (
                                        <p key={idx} className="text-gray-700">
                                            {formatHour12(rule.startHour)} - {formatHour12(rule.endHour)}: <span className="font-bold text-brand-orange">₱{rule.price}/hr</span>
                                        </p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Unavailable Notice for disabled courts */}
                    {!isActive && (
                        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-xs text-red-600 font-medium text-center">
                                This court is currently unavailable for booking
                            </p>
                        </div>
                    )}

                    <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-gray-500 font-medium">
                            <Users size={14} className="text-brand-green" />
                            Up to {maxPlayers} pax{maxPlayers !== 1 ? '' : ''}
                        </div>
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onBook(court)}
                            disabled={!isActive}
                            className={!isActive ? 'opacity-50 cursor-not-allowed' : 'text-white'}
                        >
                            {isActive ? 'Book Now' : 'Unavailable'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Expanded Modal */}
            {isExpanded && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={() => setIsExpanded(false)}
                >
                    <div
                        className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header with Image */}
                        <div className="relative h-64 sm:h-80 overflow-hidden bg-gray-100">
                            <img
                                src={(court.images && court.images[0]?.url) || court.image || '/images/court1.jpg'}
                                alt={court.name}
                                className={`w-full h-full object-cover ${!isActive ? 'grayscale' : ''}`}
                                onError={(e) => { e.target.src = '/images/court1.jpg'; }}
                            />
                            <button
                                onClick={() => setIsExpanded(false)}
                                className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-white rounded-full transition-colors shadow-lg"
                            >
                                <X size={20} className="text-gray-700" />
                            </button>
                            <div className="absolute top-4 left-4">
                                <Badge variant={isActive ? (court.status === 'Available' ? 'green' : 'gray') : 'red'}>
                                    {isActive ? (court.status || 'Available') : 'Unavailable'}
                                </Badge>
                            </div>
                            {!isActive && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                    <div className="bg-red-500 text-white px-6 py-3 rounded-lg font-bold text-lg">
                                        COURT UNAVAILABLE
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="p-6 sm:p-8 space-y-6">
                            {/* Title and Price */}
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="font-display font-bold text-2xl sm:text-3xl text-brand-green-dark mb-2">
                                        {court.name}
                                    </h2>
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <MapPin size={16} />
                                        <span className="text-sm">{courtTypeLabel}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block font-bold text-brand-orange text-2xl">₱{court.price}</span>
                                    <span className="text-sm text-gray-400">per hour</span>
                                </div>
                            </div>

                            {/* Full Description */}
                            <div className="space-y-2">
                                <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wider">Description</h3>
                                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                                    {court.description || 'No description available.'}
                                </p>
                            </div>

                            {/* Capacity */}
                            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <Users size={18} className="text-brand-green" />
                                <span className="text-sm font-medium text-gray-700">
                                    Capacity: Up to {maxPlayers} player{maxPlayers !== 1 ? 's' : ''}
                                </span>
                            </div>

                            {/* Dynamic Pricing Rules */}
                            {hasPricingRules && isActive && (
                                <div className="space-y-3">
                                    <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wider">Time-Based Pricing</h3>
                                    <div className="bg-brand-orange/10 border border-brand-orange/30 rounded-lg p-4">
                                        <div className="space-y-3">
                                            {court.pricing_rules.map((rule, idx) => (
                                                <div key={idx} className="flex items-center justify-between py-2 border-b border-brand-orange/20 last:border-0">
                                                    <div className="flex items-center gap-2">
                                                        <DollarSign size={16} className="text-brand-orange" />
                                                        <span className="text-sm font-medium text-gray-700">
                                                            {formatHour12(rule.startHour)} - {formatHour12(rule.endHour)}
                                                        </span>
                                                    </div>
                                                    <span className="font-bold text-brand-orange text-lg">
                                                        ₱{rule.price}/hr
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Unavailable Notice */}
                            {!isActive && (
                                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-sm text-red-600 font-medium text-center">
                                        ⚠️ This court is currently unavailable for booking
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <Button
                                    variant="ghost"
                                    className="flex-1"
                                    onClick={() => setIsExpanded(false)}
                                >
                                    Close
                                </Button>
                                <Button
                                    variant="primary"
                                    className="flex-1 text-white"
                                    onClick={() => {
                                        setIsExpanded(false);
                                        onBook(court);
                                    }}
                                    disabled={!isActive}
                                >
                                    {isActive ? 'Book This Court' : 'Unavailable'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
