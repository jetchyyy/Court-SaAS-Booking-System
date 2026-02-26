import { useEffect, useState } from 'react';

export function SplashScreen({ onComplete }) {
    const [isFadingOut, setIsFadingOut] = useState(false);

    useEffect(() => {
        // Prevent scrolling while splash screen is active
        document.body.style.overflow = 'hidden';

        // Start fade out after 2 seconds
        const timer1 = setTimeout(() => {
            setIsFadingOut(true);
        }, 2000);

        // Call onComplete after transition finishes (e.g., 2.7s total)
        const timer2 = setTimeout(() => {
            onComplete();
        }, 2700);

        return () => {
            document.body.style.overflow = 'unset';
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [onComplete]);

    return (
        <div
            className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-brand-green-dark transition-all duration-700 ease-in-out ${isFadingOut ? 'opacity-0 scale-110 pointer-events-none' : 'opacity-100 scale-100'
                }`}
        >
            <div className="relative flex flex-col items-center">
                {/* Animated Background Glow */}
                <div className="absolute inset-0 bg-brand-orange-light rounded-full blur-[100px] opacity-20 animate-pulse"></div>

                {/* Logo Icon */}
                <div className="relative mb-6">
                    <div className="w-24 h-24 bg-brand-orange rounded-3xl flex items-center justify-center rotate-12 animate-bounce-slow shadow-[0_0_40px_rgba(249,115,22,0.4)]">
                        <span className="text-white font-bold text-5xl">PP</span>
                    </div>
                    {/* Decorative ring */}
                    <div className="absolute inset-0 border-4 border-white/20 rounded-3xl -rotate-6 animate-pulse"></div>
                </div>

                {/* Brand Name Text */}
                <div className="overflow-hidden mt-4">
                    <h1 className="text-4xl sm:text-6xl font-display font-bold text-white tracking-tight animate-slide-up-fade">
                        The Pickle Point<span className="text-brand-orange">.</span>
                    </h1>
                </div>

                {/* Subtitle */}
                <div className="overflow-hidden mt-3">
                    <p className="text-brand-green-light/80 font-medium tracking-[0.3em] uppercase text-sm sm:text-base animate-slide-up-fade" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
                        Cebu
                    </p>
                </div>

                {/* Loading Bar */}
                <div className="w-48 h-1 bg-white/10 rounded-full mt-16 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-orange to-amber-300 rounded-full animate-progress origin-left"></div>
                </div>
            </div>
        </div>
    );
}
