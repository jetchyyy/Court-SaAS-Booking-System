import { Clock, Facebook, Instagram, Mail, MapPin, Phone } from 'lucide-react';
import { Button } from './ui';
import { LazyMapEmbed } from './LazyMapEmbed';

export function Contact() {
    return (
        <section id="contact" className="py-24 bg-bg-user w-full overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl sm:text-4xl font-display font-bold text-brand-green-dark mb-4">
                        Get in Touch
                    </h2>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                        Have questions about court availability, tournaments, or coaching? Reach out to us or pay us a visit!
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
                    {/* Contact Info */}
                    <div className="space-y-8 min-w-0">
                        <div className="bg-bg-light p-6 sm:p-8 rounded-3xl border border-gray-100">
                            <h3 className="font-display font-bold text-xl text-brand-green-dark mb-6">Contact Information</h3>

                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-brand-green-light rounded-xl text-brand-green-dark shrink-0">
                                        <Phone size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Phone Number</p>
                                        <p className="text-lg font-semibold text-gray-800 break-words">(0929) 119 1087</p>
                                        <p className="text-lg font-semibold text-gray-800 break-words">(0929) 677 5914</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-brand-green-light rounded-xl text-brand-green-dark shrink-0">
                                        <Clock size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Operating Hours</p>
                                        <p className="text-lg font-semibold text-gray-800">Mon-Sun, 24 Hours</p>
                                        <p className="text-sm text-gray-500">12AM-5AM (Advance Booking Required. No Walk-ins)</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-brand-green-light rounded-xl text-brand-green-dark shrink-0">
                                        <Mail size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Email Address</p>
                                        <p className="text-lg font-semibold text-gray-800 break-all">thepicklepointcebu@yahoo.com</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-brand-green-light rounded-xl text-brand-green-dark shrink-0">
                                        <MapPin size={24} />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 font-medium">Location</p>
                                        <p className="text-lg font-semibold text-gray-800">Pickle Point- Cebu</p>
                                        <p className="text-gray-600">8WGV+J46 Centro, Mandaue, Cebu, Philippines</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-brand-orange text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
                            {/* Decorative circle */}
                            <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-white/10 rounded-full"></div>

                            <h3 className="font-display font-bold text-xl mb-4 relative z-10">Follow Us</h3>
                            <p className="mb-6 text-white/90 relative z-10">For private event reservations, please feel free to contact us to discuss further details.</p>

                            <div className="flex gap-4 relative z-10">
                                <a
                                    href="https://www.facebook.com/profile.php?id=61586304389627"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors backdrop-blur-sm"
                                >
                                    <Facebook size={24} />
                                </a>

                                <a
                                    href="https://www.instagram.com/thepicklepointcebu/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors backdrop-blur-sm"
                                >
                                    <Instagram size={24} />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Map */}
                    <div className="w-full rounded-3xl overflow-hidden shadow-lg border border-gray-200 bg-white">
                        <LazyMapEmbed
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d307.9333774424817!2d123.94258601627138!3d10.326493210451394!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x33a999007b7ab781%3A0xa291446a335dd76e!2sPickle%20Point-%20Cebu!5e1!3m2!1sen!2sph!4v1769687613671!5m2!1sen!2sph"
                            title="Pickle Point Cebu map"
                            description="Load the venue map only when you want to view directions."
                            buttonLabel="Show Venue Map"
                            aspectClassName="min-h-[300px] sm:min-h-[360px] lg:min-h-[520px]"
                            className="rounded-none border-0 shadow-none"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
