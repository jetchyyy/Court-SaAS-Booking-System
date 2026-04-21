import { useEffect, useMemo, useState } from 'react';
import { getSiteContent } from '../services/siteContent';

const DEFAULT_SPLASH = {
    enabled: true,
    title: 'The Pickle Point',
    subtitle: 'Cebu',
    logoUrl: '',
    initials: 'PP',
    backgroundColor: '#174034',
    accentColor: '#f97316',
    textColor: '#ffffff',
    durationMs: 2000,
};

export function SplashScreen({ onComplete }) {
    const [isFadingOut, setIsFadingOut] = useState(false);
    const [splash, setSplash] = useState(null);
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fallbackTimer = setTimeout(() => {
            if (!isMounted) return;
            setSplash(DEFAULT_SPLASH);
            setIsReady(true);
        }, 800);

        getSiteContent()
            .then((content) => {
                if (!isMounted) return;
                clearTimeout(fallbackTimer);
                const nextSplash = { ...DEFAULT_SPLASH, ...(content?.splash || {}) };
                setSplash(nextSplash);
                setIsReady(true);
                if (nextSplash.enabled === false) {
                    onComplete();
                }
            })
            .catch(() => {
                if (!isMounted) return;
                clearTimeout(fallbackTimer);
                setSplash(DEFAULT_SPLASH);
                setIsReady(true);
            });

        return () => {
            isMounted = false;
            clearTimeout(fallbackTimer);
        };
    }, [onComplete]);

    const durationMs = useMemo(() => {
        const value = Number(splash?.durationMs);
        return Number.isFinite(value) ? Math.min(Math.max(value, 700), 5000) : DEFAULT_SPLASH.durationMs;
    }, [splash?.durationMs]);

    useEffect(() => {
        if (!isReady || !splash || splash.enabled === false) return undefined;

        document.body.style.overflow = 'hidden';

        const timer1 = setTimeout(() => {
            setIsFadingOut(true);
        }, durationMs);

        const timer2 = setTimeout(() => {
            onComplete();
        }, durationMs + 700);

        return () => {
            document.body.style.overflow = 'unset';
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [durationMs, isReady, onComplete, splash]);

    if (!isReady || !splash || splash.enabled === false) return null;

    const accentStyle = { backgroundColor: splash.accentColor };
    const textStyle = { color: splash.textColor };
    const subtitleStyle = {
        color: splash.textColor,
        animationDelay: '200ms',
        animationFillMode: 'both',
    };

    return (
        <div
            className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-700 ease-in-out ${isFadingOut ? 'opacity-0 scale-110 pointer-events-none' : 'opacity-100 scale-100'}`}
            style={{ backgroundColor: splash.backgroundColor }}
        >
            <div className="relative flex flex-col items-center px-6 text-center">
                <div className="absolute inset-0 rounded-full blur-[100px] opacity-20 animate-pulse" style={accentStyle}></div>

                <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-3xl flex items-center justify-center rotate-12 animate-bounce-slow shadow-[0_0_40px_rgba(249,115,22,0.4)] overflow-hidden" style={accentStyle}>
                        {splash.logoUrl ? (
                            <img src={splash.logoUrl} alt={splash.title || 'Venue logo'} className="h-full w-full object-cover" />
                        ) : (
                            <span className="text-white font-bold text-5xl">{splash.initials || 'PC'}</span>
                        )}
                    </div>
                    <div className="absolute inset-0 border-4 border-white/20 rounded-3xl -rotate-6 animate-pulse"></div>
                </div>

                <div className="overflow-hidden mt-4">
                    <h1 className="text-4xl sm:text-6xl font-display font-bold tracking-tight animate-slide-up-fade" style={textStyle}>
                        {splash.title || 'Pickleball Courts'}<span style={{ color: splash.accentColor }}>.</span>
                    </h1>
                </div>

                {splash.subtitle && (
                    <div className="overflow-hidden mt-3">
                        <p className="font-medium tracking-[0.3em] uppercase text-sm sm:text-base animate-slide-up-fade opacity-80" style={subtitleStyle}>
                            {splash.subtitle}
                        </p>
                    </div>
                )}

                <div className="w-48 h-1 bg-white/10 rounded-full mt-16 overflow-hidden">
                    <div className="h-full rounded-full animate-progress origin-left" style={accentStyle}></div>
                </div>
            </div>
        </div>
    );
}
