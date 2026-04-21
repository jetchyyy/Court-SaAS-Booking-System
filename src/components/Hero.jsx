import { ArrowRight, Calendar, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui';

export function Hero({ content }) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const hero = content?.hero || {};
    const heroImages = (hero.slides?.length ? hero.slides : [
        { src: '/images/picklepoint.jpg', title: 'Center Court', subtitle: 'Premium Surface - Lighting' },
    ]).filter((slide) => slide?.src);
    const stats = hero.stats?.length ? hero.stats : [];

    useEffect(() => {
        if (heroImages.length <= 1) return undefined;
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % heroImages.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [heroImages.length]);

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % heroImages.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + heroImages.length) % heroImages.length);
    const getStatIcon = (icon) => icon === 'Calendar'
        ? <Calendar size={18} className="text-brand-orange" />
        : <Users size={18} className="text-brand-orange" />;

    return (
        <div className="relative pt-24 pb-16 sm:pt-32 sm:pb-24 overflow-hidden bg-bg-user">
            <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 bg-brand-green-light rounded-full blur-3xl opacity-50 -z-10"></div>
            <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 bg-brand-orange-light rounded-full blur-3xl opacity-50 -z-10"></div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-brand-green/20 mb-6 shadow-sm">
                            <span className="flex h-2 w-2 rounded-full bg-brand-green"></span>
                            <span className="text-sm font-medium text-gray-600">{hero.eyebrow || 'Courts now open for booking'}</span>
                        </div>

                        <h1 className="text-5xl sm:text-6xl font-display font-bold leading-tight text-brand-green-dark mb-6">
                            {hero.titlePrefix || 'Book your next'} <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-green to-brand-green-dark">
                                {hero.titleHighlight || 'Pickleball Court'}
                            </span>
                        </h1>

                        <p className="text-lg text-gray-600 mb-8 max-w-lg leading-relaxed">
                            {hero.description || 'Reserve a court online and enjoy your next game.'}
                        </p>

                        <div className="flex flex-wrap gap-4">
                            <Button
                                size="lg"
                                className="shadow-brand-green/25 shadow-lg text-white"
                                onClick={() => document.getElementById('courts')?.scrollIntoView({ behavior: 'smooth' })}
                            >
                                {hero.primaryCta || 'Book a Court'} <ArrowRight size={18} />
                            </Button>
                        </div>

                        {stats.length > 0 && (
                            <div className="mt-10 flex flex-wrap items-center gap-6 text-gray-500 text-sm font-medium">
                                {stats.map((stat, index) => (
                                    <div key={`${stat.label}-${index}`} className="flex items-center gap-2">
                                        {getStatIcon(stat.icon)}
                                        <span>{stat.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative group">
                        <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/3] transform transition-transform duration-500 hover:scale-[1.01]">
                            {heroImages.map((img, index) => (
                                <div
                                    key={`${img.src}-${index}`}
                                    className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                                >
                                    <img
                                        src={img.src}
                                        alt={img.title || 'Court photo'}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent"></div>
                                    <div className="absolute bottom-6 left-6 text-white transform transition-all duration-700 translate-y-0">
                                        <p className="font-bold text-xl">{img.title}</p>
                                        <p className="text-white/80 text-sm">{img.subtitle}</p>
                                    </div>
                                </div>
                            ))}

                            {heroImages.length > 1 && (
                                <>
                                    <button
                                        onClick={prevSlide}
                                        className="absolute left-4 top-1/2 -translate-y-12 bg-white/20 backdrop-blur-md hover:bg-white/40 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300"
                                        aria-label="Previous slide"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <button
                                        onClick={nextSlide}
                                        className="absolute right-4 top-1/2 -translate-y-12 bg-white/20 backdrop-blur-md hover:bg-white/40 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300"
                                        aria-label="Next slide"
                                    >
                                        <ChevronRight size={24} />
                                    </button>

                                    <div className="absolute bottom-6 right-6 flex gap-2">
                                        {heroImages.map((_, index) => (
                                            <button
                                                key={index}
                                                onClick={() => setCurrentSlide(index)}
                                                className={`w-2 h-2 rounded-full transition-all duration-300 ${index === currentSlide ? 'w-6 bg-brand-orange' : 'bg-white/50 hover:bg-white/80'}`}
                                                aria-label={`Go to slide ${index + 1}`}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="absolute -inset-4 bg-brand-green/20 rounded-[2.5rem] -z-10 rotate-3 group-hover:rotate-6 transition-transform duration-500"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
