import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui';

export function LazyMapEmbed({
    src,
    title,
    description,
    buttonLabel = 'Show Map',
    className = '',
    aspectClassName = 'min-h-[280px] sm:aspect-video'
}) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className={`${aspectClassName} w-full bg-gray-100 rounded-2xl overflow-hidden shadow-inner border border-gray-200 ${className}`}>
            {isVisible ? (
                <iframe
                    src={src}
                    title={title}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="w-full h-full"
                ></iframe>
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white via-brand-green-light to-brand-orange-light p-5 sm:p-6 text-center">
                    <div className="max-w-sm w-full">
                        <div className="mx-auto mb-4 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-white/90 text-brand-green-dark shadow-sm">
                            <MapPin size={24} className="sm:w-7 sm:h-7" />
                        </div>
                        <h4 className="text-base sm:text-lg font-display font-bold text-brand-green-dark">{title}</h4>
                        {description ? (
                            <p className="mt-2 text-sm text-gray-600">{description}</p>
                        ) : null}
                        <Button
                            type="button"
                            className="mt-5 w-full sm:w-auto text-white"
                            onClick={() => setIsVisible(true)}
                        >
                            {buttonLabel}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
