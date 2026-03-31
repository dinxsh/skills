import { useState } from 'react';
import './FilterBar.css';
import data from '../data/tools.json';
import type { Category } from '../types';
import SearchInput from './SearchInput';

declare global { interface Window { gtag?: (...args: any[]) => void; } }
const track = (type: string, value: string) => window.gtag?.('event', 'filter_applied', { filter_type: type, filter_value: value });

export interface FilterState {
    category: string;
    chain: string;
    type: string;
    difficulty: string;
    sort: string;
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

const SORTS = [
    { value: 'nameAsc',           label: 'Name A–Z' },
    { value: 'nameDesc',          label: 'Name Z–A' },
    { value: 'dateNewest',        label: 'Newest first' },
    { value: 'dateOldest',        label: 'Oldest first' },
    { value: 'completenessDesc',  label: 'Best prompt' },
];

export default function FilterBar({ filters, onChange, totalCount, filteredCount }: FilterBarProps) {
    const [drawerOpen, setDrawerOpen] = useState(false);

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

    const clearAll = () =>
        onChange({ category: 'all', chain: 'all', type: 'all', difficulty: 'all', sort: filters.sort });

    const set = (key: keyof FilterState) => (e: React.ChangeEvent<HTMLSelectElement>) => {
        track(key, e.target.value);
        onChange({ ...filters, [key]: e.target.value });
    };


    const selects = (
        <>
            <select className="filter-select" value={filters.category} onChange={set('category')} aria-label="Filter by product category">
                {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select className="filter-select" value={filters.chain} onChange={set('chain')} aria-label="Filter by chain">
                {CHAINS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select className="filter-select" value={filters.type} onChange={set('type')} aria-label="Filter by access type">
                {TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select className="filter-select" value={filters.difficulty} onChange={set('difficulty')} aria-label="Filter by difficulty">
                {DIFFICULTIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <select className="filter-select" value={filters.sort} onChange={set('sort')} aria-label="Sort skills">
                {SORTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
        </>
    );

    return (
        <>
            <div className="filter-bar-container">
                {/* Search — full-width top row */}
                <div className="filter-search-row">
                    <SearchInput placeholder="Search skills by name, chain, or use case..." />
                </div>

                {/* Filters + meta — second row */}
                <div className="filter-bar">
                    <div className="filter-bar-left">
                        {/* Desktop: show all selects inline */}
                        <div className="filter-selects filter-selects--desktop">
                            {selects}
                        </div>
                        {/* Mobile: single drawer toggle */}
                        <button
                            className={`filter-drawer-toggle${activeFilterCount > 0 ? ' filter-drawer-toggle--active' : ''}`}
                            onClick={() => setDrawerOpen(true)}
                            aria-label="Open filters"
                        >
                            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                            <svg xmlns="http://www.w3.org/2000/svg" width="9" height="6" fill="none"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="m1 1 3.5 3.5L8 1"/></svg>
                        </button>
                    </div>

                    <div className="filter-bar-meta">
                        <span className="filter-count">
                            {filteredCount === totalCount
                                ? `${totalCount} skills`
                                : `${filteredCount} / ${totalCount}`}
                        </span>
                        {activeFilterCount > 0 && (
                            <button className="filter-clear" onClick={clearAll}>clear</button>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile drawer */}
            {drawerOpen && (
                <div className="filter-drawer-backdrop" onClick={() => setDrawerOpen(false)}>
                    <div className="filter-drawer" onClick={e => e.stopPropagation()}>
                        <div className="filter-drawer-header">
                            <span className="filter-drawer-title">Filters</span>
                            <button className="filter-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Close filters">
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                        </div>
                        <div className="filter-drawer-body">
                            <label className="filter-drawer-label">Product</label>
                            <select className="filter-select filter-select--full" value={filters.category} onChange={e => { set('category')(e); }} aria-label="Filter by product category">
                                {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            <label className="filter-drawer-label">Chain</label>
                            <select className="filter-select filter-select--full" value={filters.chain} onChange={set('chain')} aria-label="Filter by chain">
                                {CHAINS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            <label className="filter-drawer-label">Type</label>
                            <select className="filter-select filter-select--full" value={filters.type} onChange={set('type')} aria-label="Filter by access type">
                                {TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            <label className="filter-drawer-label">Level</label>
                            <select className="filter-select filter-select--full" value={filters.difficulty} onChange={set('difficulty')} aria-label="Filter by difficulty">
                                {DIFFICULTIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            <label className="filter-drawer-label">Sort</label>
                            <select className="filter-select filter-select--full" value={filters.sort} onChange={set('sort')} aria-label="Sort skills">
                                {SORTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                        </div>
                        <div className="filter-drawer-footer">
                            {activeFilterCount > 0 && (
                                <button className="filter-clear" onClick={() => { clearAll(); setDrawerOpen(false); }}>Clear all</button>
                            )}
                            <button className="filter-drawer-apply" onClick={() => setDrawerOpen(false)}>
                                Show {filteredCount} skills
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
