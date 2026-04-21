import { Armchair, Car, Clock, Coffee, Gamepad2, MapPin, ShowerHead, Users, Volleyball, Wifi } from 'lucide-react';

const ICONS = {
    Armchair,
    Car,
    Clock,
    Coffee,
    Gamepad2,
    MapPin,
    ShowerHead,
    Users,
    Volleyball,
    Wifi,
};

export function Offers({ content }) {
    const offers = content?.offers || {};
    const items = offers.items?.length ? offers.items : [];

    if (items.length === 0) return null;

    return (
        <section id="offers" className="py-24 bg-bg-user relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-green/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl sm:text-4xl font-display font-bold text-brand-green-dark mb-4">
                        {offers.title || 'What This Place Offers'}
                    </h2>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                        {offers.description || 'Enjoy amenities designed for your comfort before and after your game.'}
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {items.map((item, index) => (
                        <AmenityCard key={item.id || index} iconName={item.icon} title={item.title} />
                    ))}
                </div>
            </div>
        </section>
    );
}

function AmenityCard({ iconName, title }) {
    const Icon = ICONS[iconName] || Car;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center gap-4 hover:shadow-md transition-shadow duration-300 group">
            <div className="w-16 h-16 rounded-full bg-brand-green-light text-brand-green-dark flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Icon size={32} />
            </div>
            <span className="font-medium text-gray-700">{title}</span>
        </div>
    );
}
