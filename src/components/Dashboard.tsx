import { useEffect, useState, useCallback } from 'react';
import FilterBar, { type FilterState } from './FilterBar';
import CardsContainer from './CardsContainer';
import BuildCart from './BuildCart';
import data from '../data/tools.json';
import type { Category } from '../types';

interface DashboardProps {
    category: string;
}

interface SearchEventDetail {
    query?: string;
}

interface FilterNewEventDetail {
    filterNew?: boolean;
}

const totalSkillCount = (data.tools as Category[]).reduce(
    (sum, cat) => sum + cat.content.length,
    0
);

function readUrlFilters(defaultCategory: string): FilterState {
    if (typeof window === 'undefined') return { category: defaultCategory, chain: 'all', type: 'all', difficulty: 'all' };
    const p = new URLSearchParams(window.location.search);
    return {
        category: p.get('category') || defaultCategory,
        chain: p.get('chain') || 'all',
        type: p.get('type') || 'all',
        difficulty: p.get('difficulty') || 'all',
    };
}

function writeUrlFilters(filters: FilterState) {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams();
    if (filters.category !== 'all') p.set('category', filters.category);
    if (filters.chain !== 'all') p.set('chain', filters.chain);
    if (filters.type !== 'all') p.set('type', filters.type);
    if (filters.difficulty !== 'all') p.set('difficulty', filters.difficulty);
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}

export default function Dashboard({ category }: DashboardProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterNew, setFilterNew] = useState(false);
    const [filteredCount, setFilteredCount] = useState(totalSkillCount);
    const [filters, setFilters] = useState<FilterState>(() =>
        readUrlFilters(category === 'all' ? 'all' : category)
    );
    const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const raw = sessionStorage.getItem('build_cart');
            if (raw) { const slugs = JSON.parse(raw); if (Array.isArray(slugs)) return slugs; }
        } catch {}
        return [];
    });

    // Persist cart to sessionStorage
    useEffect(() => {
        try { sessionStorage.setItem('build_cart', JSON.stringify(selectedSlugs)); } catch {}
    }, [selectedSlugs]);

    // Sync filters to URL
    useEffect(() => {
        writeUrlFilters(filters);
    }, [filters]);

    useEffect(() => {
        const handleSearch = (e: Event) => {
            const detail = (e as CustomEvent<SearchEventDetail>)?.detail || {};
            if (typeof detail.query !== 'undefined') {
                setSearchQuery(detail.query);
            }
        };

        const handleFilterNew = (e: Event) => {
            const detail = (e as CustomEvent<FilterNewEventDetail>)?.detail || {};
            if (typeof detail.filterNew !== 'undefined') {
                setFilterNew(detail.filterNew);
            }
        };

        if (typeof window !== 'undefined') {
            window.addEventListener('tools:search', handleSearch);
            window.addEventListener('tools:filter-new', handleFilterNew);
        }

        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('tools:search', handleSearch);
                window.removeEventListener('tools:filter-new', handleFilterNew);
            }
        };
    }, []);

    const handleCartToggle = useCallback((slug: string) => {
        setSelectedSlugs(prev => {
            const isSelected = prev.includes(slug);
            const next = isSelected ? prev.filter(s => s !== slug) : [...prev, slug];
            // GA4 event
            window.gtag?.('event', isSelected ? 'build_cart_remove' : 'build_cart_add', {
                skill_slug: slug,
                cart_size: next.length,
            });
            return next;
        });
    }, []);

    const handleCartClear = useCallback(() => {
        setSelectedSlugs([]);
    }, []);

    const handleCartRemove = useCallback((slug: string) => {
        setSelectedSlugs(prev => prev.filter(s => s !== slug));
    }, []);

    return (
        <>
            <FilterBar
                filters={filters}
                onChange={setFilters}
                totalCount={totalSkillCount}
                filteredCount={filteredCount}
            />
            <CardsContainer
                filter={filters.category}
                chainFilter={filters.chain}
                typeFilter={filters.type}
                difficultyFilter={filters.difficulty}
                searchQuery={searchQuery}
                filterNew={filterNew}
                onFilteredCountChange={setFilteredCount}
                selectedSlugs={selectedSlugs}
                onCartToggle={handleCartToggle}
            />
            <BuildCart
                selectedSlugs={selectedSlugs}
                onClear={handleCartClear}
                onRemove={handleCartRemove}
            />
        </>
    );
}
