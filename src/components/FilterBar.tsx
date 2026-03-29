import './FilterBar.css';
import data from '../data/tools.json';
import type { Category } from '../types';

export interface FilterState {
    category: string;
    chain: string;
    type: string;
    difficulty: string;
}

interface FilterBarProps {
    filters: FilterState;
    onChange: (filters: FilterState) => void;
    totalCount: number;
    filteredCount: number;
}

const CHAINS = [
    { value: 'all',       label: 'All Chains' },
    { value: 'ethereum',  label: 'Ethereum' },
    { value: 'base',      label: 'Base' },
    { value: 'solana',    label: 'Solana' },
    { value: 'polygon',   label: 'Polygon' },
    { value: 'bsc',       label: 'BSC' },
    { value: 'arbitrum',  label: 'Arbitrum' },
    { value: 'optimism',  label: 'Optimism' },
    { value: 'avalanche', label: 'Avalanche' },
    { value: 'bitcoin',   label: 'Bitcoin' },
    { value: 'ronin',     label: 'Ronin' },
    { value: 'gnosis',    label: 'Gnosis' },
];

const TYPES = [
    { value: 'all',               label: 'All Types' },
    { value: 'Free Tier',         label: 'Free Tier' },
    { value: 'API Key Required',  label: 'API Key Required' },
    { value: 'Open Source',       label: 'Open Source' },
];

const DIFFICULTIES = [
    { value: 'all',          label: 'All Levels' },
    { value: 'Beginner',     label: 'Beginner' },
    { value: 'Intermediate', label: 'Intermediate' },
    { value: 'Advanced',     label: 'Advanced' },
];

export default function FilterBar({ filters, onChange, totalCount, filteredCount }: FilterBarProps) {
    const categories = [
        { value: 'all', label: 'All Products' },
        ...(data.tools as Category[]).map(cat => ({
            value: cat.category,
            label: cat.title,
        })),
    ];

    const activeFilterCount = [
        filters.category !== 'all',
        filters.chain !== 'all',
        filters.type !== 'all',
        filters.difficulty !== 'all',
    ].filter(Boolean).length;

    const set = (key: keyof FilterState) => (e: React.ChangeEvent<HTMLSelectElement>) =>
        onChange({ ...filters, [key]: e.target.value });

    const clearAll = () =>
        onChange({ category: 'all', chain: 'all', type: 'all', difficulty: 'all' });

    return (
        <div className="filter-bar-container">
            <div className="filter-bar">
                <div className="filter-selects">
                    <select
                        className="filter-select"
                        value={filters.category}
                        onChange={set('category')}
                        aria-label="Filter by product category"
                    >
                        {categories.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>

                    <select
                        className="filter-select"
                        value={filters.chain}
                        onChange={set('chain')}
                        aria-label="Filter by chain"
                    >
                        {CHAINS.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>

                    <select
                        className="filter-select"
                        value={filters.type}
                        onChange={set('type')}
                        aria-label="Filter by access type"
                    >
                        {TYPES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>

                    <select
                        className="filter-select"
                        value={filters.difficulty}
                        onChange={set('difficulty')}
                        aria-label="Filter by difficulty"
                    >
                        {DIFFICULTIES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                </div>

                <div className="filter-bar-meta">
                    <span className="filter-count">
                        {filteredCount === totalCount
                            ? `${totalCount} skills`
                            : `${filteredCount} / ${totalCount}`}
                    </span>
                    {activeFilterCount > 0 && (
                        <button className="filter-clear" onClick={clearAll}>
                            clear
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
