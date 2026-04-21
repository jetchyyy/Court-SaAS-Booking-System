import { Car } from 'lucide-react';
import { LazyMapEmbed } from './LazyMapEmbed';

export function Parking({ content }) {
    const parking = content?.parking || {};
    const items = Array.isArray(parking.items) ? parking.items.filter((item) => item?.title || item?.description) : [];

    if (items.length === 0) return null;

    return (
        <section id="parking" className="py-24 bg-bg-user relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-green/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="p-8 sm:p-10 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-3 mb-2">
                            <Car className="text-brand-orange" size={28} />
                            <h3 className="text-2xl font-display font-bold text-brand-green-dark">{parking.title || 'Parking Availability'}</h3>
                        </div>
                        <p className="text-gray-600">{parking.description || 'Secure parking options available nearby.'}</p>
                    </div>

                    <div className={`grid ${items.length > 1 ? 'lg:grid-cols-2' : ''}`}>
                        {items.map((item, index) => (
                            <div key={`${item.title}-${index}`} className={`p-6 sm:p-8 lg:p-10 ${index % 2 === 1 ? 'bg-gray-50/50' : ''} ${items.length > 1 && index === 0 ? 'border-b lg:border-b-0 lg:border-r border-gray-100' : ''}`}>
                                <div className="mb-6">
                                    <span className={`inline-block px-3 py-1 ${index % 2 === 0 ? 'bg-brand-orange-light text-brand-orange' : 'bg-brand-green-light text-brand-green-dark'} text-xs font-bold uppercase tracking-wider rounded-full mb-2`}>
                                        {item.timeLabel || 'Parking'}
                                    </span>
                                    <h4 className="text-lg sm:text-xl font-bold text-gray-900">{item.title}</h4>
                                </div>
                                {item.mapEmbedUrl ? (
                                    <LazyMapEmbed
                                        src={item.mapEmbedUrl}
                                        title={`${item.title} map`}
                                        description="Open the parking map only when needed."
                                        buttonLabel="Show Parking Map"
                                        aspectClassName="min-h-[260px] sm:min-h-[300px] lg:min-h-[340px]"
                                    />
                                ) : (
                                    <div className="min-h-[260px] sm:min-h-[300px] lg:min-h-[340px] rounded-2xl bg-gray-50 border border-gray-200 grid place-items-center p-6 text-center text-gray-500">
                                        <p>Map details can be added from the website editor.</p>
                                    </div>
                                )}
                                {item.description && <p className="mt-4 text-sm text-gray-500 text-center">{item.description}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
