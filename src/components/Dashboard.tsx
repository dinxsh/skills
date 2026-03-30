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

export default function Dashboard({ category }: DashboardProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterNew, setFilterNew] = useState(false);
    const [filteredCount, setFilteredCount] = useState(totalSkillCount);
    const [filters, setFilters] = useState<FilterState>({
        category: category === 'all' ? 'all' : category,
        chain: 'all',
        type: 'all',
        difficulty: 'all',
    });
    const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);

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
