import { useState, useCallback, useEffect } from 'react';
import FavoritesView from './FavoritesView';
import BuildCart from './BuildCart';

function readCart(): string[] {
    try {
        const raw = localStorage.getItem('build_cart');
        if (raw) { const slugs = JSON.parse(raw); if (Array.isArray(slugs)) return slugs; }
    } catch {}
    return [];
}

function writeCart(slugs: string[]) {
    try {
        localStorage.setItem('build_cart', JSON.stringify(slugs));
        window.dispatchEvent(new CustomEvent('cart:changed'));
    } catch {}
}

export default function SavedWithCart() {
    const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() => readCart());

    // Sync from other tabs
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === 'build_cart' && e.newValue !== null) {
                try {
                    const slugs = JSON.parse(e.newValue);
                    if (Array.isArray(slugs)) setSelectedSlugs(slugs);
                } catch {}
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const handleCartToggle = useCallback((slug: string) => {
        setSelectedSlugs(prev => {
            const next = prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug];
            writeCart(next);
            return next;
        });
    }, []);

    const handleClear = useCallback(() => {
        setSelectedSlugs([]);
        writeCart([]);
    }, []);

    const handleRemove = useCallback((slug: string) => {
        setSelectedSlugs(prev => {
            const next = prev.filter(s => s !== slug);
            writeCart(next);
            return next;
        });
    }, []);

    return (
        <>
            <FavoritesView selectedSlugs={selectedSlugs} onCartToggle={handleCartToggle} />
            <BuildCart selectedSlugs={selectedSlugs} onClear={handleClear} onRemove={handleRemove} />
        </>
    );
}
