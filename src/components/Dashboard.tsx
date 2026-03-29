import { useEffect, useState } from 'react';
import FilterBar, { type FilterState } from './FilterBar';
import CardsContainer from './CardsContainer';
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
            />
        </>
    );
}
