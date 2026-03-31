import { useMemo, useState, useEffect, useRef } from 'react';
import Fuse from 'fuse.js';
import Card from './Card';
import EmptyState, { SearchIcon } from './EmptyState';
import './CardsContainer.css';
import data from '../data/tools.json';
import skillsMeta from '../data/skills-meta.json';
import catalog from '../data/skills-catalog.json';
import type { Tool, Category } from '../types';
import { toolComparators, seededShuffle, type SortKey } from '../utils/sorting';
import { isRecentlyAdded } from '../utils/dates';

const ITEMS_PER_PAGE = 32;

interface ToolWithCategory extends Tool {
    category: string;
    useCase?: string;
}

const fuseOptions = {
    keys: [
        { name: 'title', weight: 0.4 },
        { name: 'body', weight: 0.25 },
        { name: 'useCase', weight: 0.2 },
        { name: 'category', weight: 0.1 },
        { name: 'tag', weight: 0.05 }
    ],
    threshold: 0.3,
    includeScore: true,
    minMatchCharLength: 2,
    ignoreLocation: true
};

type CatalogEntry = { useCase?: string; snippet?: string; endpoints?: string[]; keyParams?: Record<string, string>; responseFields?: string[] };

const useCaseMap = Object.fromEntries(
    Object.entries(catalog as Record<string, CatalogEntry>)
        .map(([slug, entry]) => [slug, entry.useCase ?? ''])
);

const completenessMap = Object.fromEntries(
    Object.entries(catalog as Record<string, CatalogEntry>).map(([slug, e]) => {
        const score = [
            !!e.snippet,
            (e.endpoints?.length ?? 0) > 0,
            Object.keys(e.keyParams ?? {}).length > 0,
            (e.responseFields?.length ?? 0) > 0,
        ].filter(Boolean).length;
        return [slug, score];
    })
);

interface CardsContainerProps {
    filter: string;
    chainFilter?: string;
    typeFilter?: string;
    difficultyFilter?: string;
    sort?: SortKey;
    randomSeed?: number;
    searchQuery?: string;
    filterNew?: boolean;
    onFilteredCountChange?: (count: number) => void;
    selectedSlugs?: string[];
    onCartToggle?: (slug: string) => void;
}

export default function CardsContainer({
    filter,
    chainFilter = 'all',
    typeFilter = 'all',
    difficultyFilter = 'all',
    sort = 'nameAsc',
    randomSeed = 0,
    searchQuery = '',
    filterNew = false,
    onFilteredCountChange,
    selectedSlugs = [],
    onCartToggle,
}: CardsContainerProps) {
    const [displayedCount, setDisplayedCount] = useState(ITEMS_PER_PAGE);
    const [isLoading, setIsLoading] = useState(false);
    const loaderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('toolsState');
            if (raw) {
                const state = JSON.parse(raw);
                if (state && state.filter === filter) {
                    if (state.displayedCount && state.displayedCount > displayedCount) {
                        setDisplayedCount(state.displayedCount);
                    }
                    setTimeout(() => {
                        if (typeof window !== 'undefined' && typeof state.scrollY !== 'undefined') {
                            window.scrollTo(0, state.scrollY);
                        }
                    }, 50);
                }
                sessionStorage.removeItem('toolsState');
            }
        } catch (err) { }
    }, []);

    const allFlatTools = useMemo((): ToolWithCategory[] => {
        return (data.tools as Category[]).flatMap((item) =>
            item.content.map((tool) => ({
                ...tool,
                category: item.category,
                useCase: useCaseMap[tool.slug ?? ''] ?? '',
            }))
        );
    }, []);

    const fuse = useMemo(() => {
        return new Fuse(allFlatTools, fuseOptions);
    }, [allFlatTools]);

    const filteredCards = useMemo((): ToolWithCategory[] => {
        let base: ToolWithCategory[];

        if (searchQuery && searchQuery.length >= 2) {
            const results = fuse.search(searchQuery);
            base = results.map(result => result.item);
            if (filter !== 'all') {
                base = base.filter(tool => tool.category === filter);
            }
        } else {
            base = (data.tools as Category[])
                .filter((item) => filter === 'all' || filter === item.category)
                .flatMap((item) =>
                    item.content.map((tool) => ({
                        ...tool,
                        category: item.category,
                    }))
                );
        }

        if (filterNew) {
            base = base.filter((tool) => isRecentlyAdded(tool['date-added'], 30));
        }

        if (chainFilter !== 'all') {
            base = base.filter((tool) => {
                const meta = (skillsMeta as Record<string, { chains: string[]; complexity: string }>)[tool.slug ?? ''];
                return meta?.chains?.includes(chainFilter) ?? false;
            });
        }

        if (typeFilter !== 'all') {
            base = base.filter((tool) => tool.tag === typeFilter);
        }

        if (difficultyFilter !== 'all') {
            base = base.filter((tool) => {
                const meta = (skillsMeta as Record<string, { chains: string[]; complexity: string }>)[tool.slug ?? ''];
                return meta?.complexity === difficultyFilter;
            });
        }

        if (sort === 'random') {
            const DEFAULT_SEED = 42;
            return seededShuffle(base, randomSeed || DEFAULT_SEED);
        } else {
            const comparator = toolComparators[sort] || toolComparators.nameAsc;
            return [...base].sort(comparator);
        }
    }, [filter, chainFilter, typeFilter, difficultyFilter, sort, randomSeed, searchQuery, filterNew, fuse]);

    useEffect(() => {
        onFilteredCountChange?.(filteredCards.length);
    }, [filteredCards.length, onFilteredCountChange]);

    useEffect(() => {
        setDisplayedCount(ITEMS_PER_PAGE);
    }, [filter, chainFilter, typeFilter, difficultyFilter, searchQuery, filterNew]);

    useEffect(() => {
        const handleSaveState = () => {
            try {
                const state = {
                    filter,
                    displayedCount,
                    scrollY: typeof window !== 'undefined' ? window.scrollY || window.pageYOffset : 0,
                };
                sessionStorage.setItem('toolsState', JSON.stringify(state));
            } catch (err) { }
        };

        window.addEventListener('tools:save-state', handleSaveState);
        return () => window.removeEventListener('tools:save-state', handleSaveState);
    }, [displayedCount, filter]);

    useEffect(() => {
        const tryRestore = () => {
            try {
                const raw = sessionStorage.getItem('toolsState');
                if (!raw) return;
                const state = JSON.parse(raw);
                if (state && state.filter === filter) {
                    if (state.displayedCount && state.displayedCount > displayedCount) {
                        setDisplayedCount(state.displayedCount);
                    }
                    setTimeout(() => {
                        if (typeof window !== 'undefined' && typeof state.scrollY !== 'undefined') {
                            window.scrollTo(0, state.scrollY);
                        }
                    }, 50);
                }
                sessionStorage.removeItem('toolsState');
            } catch (err) { }
        };

        window.addEventListener('pageshow', tryRestore);
        window.addEventListener('astro:page-load', tryRestore);
        return () => {
            window.removeEventListener('pageshow', tryRestore);
            window.removeEventListener('astro:page-load', tryRestore);
        };
    }, [filter]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && !isLoading && displayedCount < filteredCards.length) {
                    setIsLoading(true);
                    setTimeout(() => {
                        setDisplayedCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredCards.length));
                        setIsLoading(false);
                    }, 300);
                }
            },
            { threshold: 0.1 }
        );

        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }

        return () => observer.disconnect();
    }, [displayedCount, isLoading, filteredCards.length]);

    const displayedCards = filteredCards.slice(0, displayedCount);

    const SEARCH_SUGGESTIONS = ['wallet balance', 'whale tracking', 'NFT collection', 'token price', 'DEX trades', 'tax report', 'cross-chain', 'AI agent'];

    const dispatchSearch = (term: string) => {
        window.dispatchEvent(new CustomEvent('tools:search', { detail: { query: term } }));
    };

    const isSearchingInCategory = searchQuery && searchQuery.length >= 2 && filter !== 'all';
    const hasNoSearchResults = isSearchingInCategory && filteredCards.length === 0;

    if (hasNoSearchResults) {
        return (
            <section>
                <EmptyState
                    icon={<SearchIcon />}
                    message={`No results for "${searchQuery}" in this category.`}
                    suggestions={SEARCH_SUGGESTIONS.slice(0, 4)}
                    onSuggestion={dispatchSearch}
                    actionText="Search All Skills"
                    actionHref="/"
                />
            </section>
        );
    }

    if (filteredCards.length === 0) {
        const suggestions = searchQuery && searchQuery.length >= 2
            ? SEARCH_SUGGESTIONS.filter(s => !s.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 4)
            : undefined;
        return (
            <section>
                <EmptyState
                    icon={<SearchIcon />}
                    message={searchQuery ? `No results for "${searchQuery}".` : 'No skills match the selected filters.'}
                    suggestions={suggestions}
                    onSuggestion={suggestions ? dispatchSearch : undefined}
                    actionText="Clear Filters"
                    actionHref="/"
                />
            </section>
        );
    }

    return (
        <section>
            <ul role="list" className="link-card-grid">
                {displayedCards.map(({ url, title, body, tag, 'date-added': dateAdded, slug, category }, i) => (
                    <Card
                        key={`${title}-${i}`}
                        href={url}
                        title={title}
                        body={body}
                        tag={tag}
                        dateAdded={dateAdded}
                        slug={slug}
                        category={category}
                        isSelected={slug ? selectedSlugs.includes(slug) : false}
                        onCartToggle={onCartToggle}
                        completeness={slug ? (completenessMap[slug] ?? 0) : 0}
                        complexity={slug ? ((skillsMeta as Record<string, { chains: string[]; complexity: string }>)[slug]?.complexity ?? '') : ''}
                    />
                ))}
            </ul>

            {displayedCount < filteredCards.length && (
                <div ref={loaderRef} className="infinite-scroll-loader">
                    {isLoading && (
                        <p className="loading-text">Loading more...</p>
                    )}
                </div>
            )}
        </section>
    );
}
