import { Clock, Facebook, Instagram, Mail, MapPin, Phone } from 'lucide-react';
import { LazyMapEmbed } from './LazyMapEmbed';

export function Contact({ content }) {
    const contact = content?.contact || {};
    const phones = Array.isArray(contact.phones) ? contact.phones.filter(Boolean) : [];

    return (
        <section id="contact" className="py-24 bg-bg-user w-full overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl sm:text-4xl font-display font-bold text-brand-green-dark mb-4">
                        {contact.title || 'Get in Touch'}
                    </h2>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                        {contact.description || 'Reach out to us or pay us a visit.'}
                    </p>
                </div>

                <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
                    <div className="space-y-8 min-w-0">
                        <div className="bg-bg-light p-6 sm:p-8 rounded-3xl border border-gray-100">
                            <h3 className="font-display font-bold text-xl text-brand-green-dark mb-6">Contact Information</h3>

                            <div className="space-y-6">
                                {phones.length > 0 && (
                                    <ContactRow icon={Phone} label="Phone Number">
                                        {phones.map((phone) => (
                                            <p key={phone} className="text-lg font-semibold text-gray-800 break-words">{phone}</p>
                                        ))}
                                    </ContactRow>
                                )}

                                {(contact.hoursTitle || contact.hoursNote) && (
                                    <ContactRow icon={Clock} label="Operating Hours">
                                        <p className="text-lg font-semibold text-gray-800">{contact.hoursTitle}</p>
                                        {contact.hoursNote && <p className="text-sm text-gray-500">{contact.hoursNote}</p>}
                                    </ContactRow>
                                )}

                                {contact.email && (
                                    <ContactRow icon={Mail} label="Email Address">
                                        <p className="text-lg font-semibold text-gray-800 break-all">{contact.email}</p>
                                    </ContactRow>
                                )}

                                {(contact.locationName || contact.address) && (
                                    <ContactRow icon={MapPin} label="Location">
                                        <p className="text-lg font-semibold text-gray-800">{contact.locationName}</p>
                                        <p className="text-gray-600">{contact.address}</p>
                                    </ContactRow>
                                )}
                            </div>
                        </div>

                        {(contact.facebookUrl || contact.instagramUrl || contact.socialText) && (
                            <div className="bg-brand-orange text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
                                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-48 h-48 bg-white/10 rounded-full"></div>

                                <h3 className="font-display font-bold text-xl mb-4 relative z-10">Follow Us</h3>
                                {contact.socialText && <p className="mb-6 text-white/90 relative z-10">{contact.socialText}</p>}

                                <div className="flex gap-4 relative z-10">
                                    {contact.facebookUrl && (
                                        <a href={contact.facebookUrl} target="_blank" rel="noopener noreferrer" className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors backdrop-blur-sm" aria-label="Facebook">
                                            <Facebook size={24} />
                                        </a>
                                    )}

                                    {contact.instagramUrl && (
                                        <a href={contact.instagramUrl} target="_blank" rel="noopener noreferrer" className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors backdrop-blur-sm" aria-label="Instagram">
                                            <Instagram size={24} />
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-full rounded-3xl overflow-hidden shadow-lg border border-gray-200 bg-white">
                        {contact.mapEmbedUrl ? (
                            <LazyMapEmbed
                                src={contact.mapEmbedUrl}
                                title={`${contact.locationName || 'Venue'} map`}
                                description="Load the venue map only when you want to view directions."
                                buttonLabel="Show Venue Map"
                                aspectClassName="min-h-[300px] sm:min-h-[360px] lg:min-h-[520px]"
                                className="rounded-none border-0 shadow-none"
                            />
                        ) : (
                            <div className="min-h-[300px] sm:min-h-[360px] lg:min-h-[520px] grid place-items-center p-8 text-center text-gray-500">
                                <div>
                                    <MapPin className="mx-auto mb-3 text-brand-green-dark" size={32} />
                                    <p className="font-medium text-gray-700">{contact.locationName || 'Venue Location'}</p>
                                    <p className="mt-1 text-sm">{contact.address || 'Map details will appear here once configured.'}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

function ContactRow({ icon, label, children }) {
    const IconComponent = icon;

    return (
        <div className="flex items-start gap-4">
            <div className="p-3 bg-brand-green-light rounded-xl text-brand-green-dark shrink-0">
                <IconComponent size={24} />
            </div>
            <div>
                <p className="text-sm text-gray-500 font-medium">{label}</p>
                {children}
            </div>
        </div>
    );
}
