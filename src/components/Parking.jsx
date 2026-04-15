import { Car } from 'lucide-react';
import { LazyMapEmbed } from './LazyMapEmbed';

export function Parking() {
    return (
        <section id="parking" className="py-24 bg-bg-user relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-0 right-0 w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-green/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="p-8 sm:p-10 border-b border-gray-100 bg-gray-50/50">
                        <div className="flex items-center gap-3 mb-2">
                            <Car className="text-brand-orange" size={28} />
                            <h3 className="text-2xl font-display font-bold text-brand-green-dark">Parking Availability</h3>
                        </div>
                        <p className="text-gray-600">Secure parking options available nearby depending on your playing time.</p>
                    </div>

                    <div className="grid lg:grid-cols-2">
                        {/* Day Parking */}
                        <div className="p-6 sm:p-8 lg:p-10 border-b lg:border-b-0 lg:border-r border-gray-100">
                            <div className="mb-6">
                                <div>
                                    <span className="inline-block px-3 py-1 bg-brand-orange-light text-brand-orange text-xs font-bold uppercase tracking-wider rounded-full mb-2">
                                        6:00 AM - 8:00 PM
                                    </span>
                                    <h4 className="text-lg sm:text-xl font-bold text-gray-900">Mandaue City Parking Building</h4>
                                </div>
                            </div>
                            <LazyMapEmbed
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1231.7332439194204!2d123.94227780570394!3d10.326561079742241!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a999b23fbbda97%3A0x873ce5859e106bfd!2sMandaue%20City%20Parking%20Building!5e1!3m2!1sen!2sph!4v1769845352536!5m2!1sen!2sph"
                                title="Mandaue City Parking Building map"
                                description="Open the day parking map only when needed."
                                buttonLabel="Show Day Parking Map"
                                aspectClassName="min-h-[260px] sm:min-h-[300px] lg:min-h-[340px]"
                            />
                            <p className="mt-4 text-sm text-gray-500 text-center">Located just a short walk from the courts.</p>
                        </div>

                        {/* Night Parking */}
                        <div className="p-6 sm:p-8 lg:p-10 bg-gray-50/50">
                            <div className="mb-6">
                                <div>
                                    <span className="inline-block px-3 py-1 bg-brand-green-light text-brand-green-dark text-xs font-bold uppercase tracking-wider rounded-full mb-2">
                                        8:00 PM - 6:00 AM
                                    </span>
                                    <h4 className="text-lg sm:text-xl font-bold text-gray-900">Mandaue City Hall</h4>
                                </div>
                            </div>
                            <LazyMapEmbed
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d615.8653893176781!2d123.94299730826987!3d10.327190424017024!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a999b240f0bd77%3A0xbfe6ac0f099de4a4!2sLANDBANK%20-%20Mandaue%20City%20Hall!5e1!3m2!1sen!2sph!4v1769845543147!5m2!1sen!2sph"
                                title="Mandaue City Hall map"
                                description="Open the night parking map only when needed."
                                buttonLabel="Show Night Parking Map"
                                aspectClassName="min-h-[260px] sm:min-h-[300px] lg:min-h-[340px]"
                            />
                            <p className="mt-4 text-sm text-gray-500 text-center">Safe and secure parking at the City Hall grounds.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
