export function Footer({ content }) {
    const footer = content?.footer || {};

    return (
        <footer className="bg-bg-user border-t border-gray-100 py-12 mt-20">
            <div className="max-w-7xl mx-auto px-4 text-center">
                <p className="text-gray-500 font-medium">{footer.copyright || '(c) 2026 Pickleball Courts. All rights reserved.'}</p>
                {footer.creditLabel && footer.creditUrl && (
                    <p className="text-gray-400 text-sm mt-2">
                        Created by <a href={footer.creditUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors underline">{footer.creditLabel}</a>
                    </p>
                )}
            </div>
        </footer>
    );
}
