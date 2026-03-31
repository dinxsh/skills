import { useState, useEffect, useCallback } from 'react';
import { getBookmarkedTools, type BookmarkedTool } from '../utils/bookmarks';
import { toolComparators, type SortKey } from '../utils/sorting';
import Card from './Card';
import EmptyState, { BookmarkIcon } from './EmptyState';
import './CardsContainer.css';
import data from '../data/tools.json';
import skillsMeta from '../data/skills-meta.json';
import catalog from '../data/skills-catalog.json';
import type { Category } from '../types';

type FavoritesSortKey = Exclude<SortKey, 'random' | 'completenessDesc'>;

type CatalogEntry = { snippet?: string; endpoints?: string[]; keyParams?: Record<string, string>; responseFields?: string[] };

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

interface FavoritesViewProps {
    selectedSlugs?: string[];
    onCartToggle?: (slug: string) => void;
}

export default function FavoritesView({ selectedSlugs: externalSlugs, onCartToggle: externalToggle }: FavoritesViewProps = {}) {
    const [bookmarkedTools, setBookmarkedTools] = useState<BookmarkedTool[]>([]);
    const [sortBy, setSortBy] = useState<FavoritesSortKey>('nameAsc');
    const [internalSlugs, setInternalSlugs] = useState<string[]>(() => readCart());

    const selectedSlugs = externalSlugs ?? internalSlugs;

    const loadBookmarks = () => {
        const tools = getBookmarkedTools(data.tools as Category[]);
        setBookmarkedTools(tools);
    };

    useEffect(() => { loadBookmarks(); }, []);

    useEffect(() => {
        const handleBookmarkChange = () => { loadBookmarks(); };
        window.addEventListener('bookmarks:changed', handleBookmarkChange);
        return () => { window.removeEventListener('bookmarks:changed', handleBookmarkChange); };
    }, []);

    const handleCartToggle = useCallback((slug: string) => {
        if (externalToggle) {
            externalToggle(slug);
        } else {
            setInternalSlugs(prev => {
                const next = prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug];
                writeCart(next);
                return next;
            });
        }
    }, [externalToggle]);

    const sortedTools = [...bookmarkedTools].sort(toolComparators[sortBy]);

    if (bookmarkedTools.length === 0) {
        return (
            <section>
                <EmptyState
                    icon={<BookmarkIcon />}
                    message="Start saving AI tools by clicking the bookmark icon on any tool card. Your saved tools will appear here for quick access."
                    actionText="Browse AI Tools"
                    actionHref="/"
                />
            </section>
        );
    }

    return (
        <section>
            <div className="favorites-header">
                <div className="favorites-info">
                    <p className="nu-c-fs-small nu-u-text--secondary">
                        {bookmarkedTools.length} {bookmarkedTools.length === 1 ? 'tool' : 'tools'} saved
                        {selectedSlugs.length > 0 && ` · ${selectedSlugs.length} in build cart`}
                    </p>
                </div>

                <div className="favorites-controls">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as FavoritesSortKey)}
                        className="sort-select"
                    >
                        <option value="nameAsc">Name (A-Z)</option>
                        <option value="nameDesc">Name (Z-A)</option>
                        <option value="dateNewest">Newest First</option>
                        <option value="dateOldest">Oldest First</option>
                    </select>
                </div>
            </div>

            <ul role="list" className="link-card-grid">
                {sortedTools.map(({ url, title, body, tag, 'date-added': dateAdded, slug, category }, i) => (
                    <Card
                        key={`${slug}-${i}`}
                        href={url}
                        title={title}
                        body={body}
                        tag={tag}
                        dateAdded={dateAdded}
                        slug={slug}
                        category={category}
                        isSelected={slug ? selectedSlugs.includes(slug) : false}
                        onCartToggle={handleCartToggle}
                        completeness={slug ? (completenessMap[slug] ?? 0) : 0}
                        complexity={slug ? ((skillsMeta as Record<string, { chains: string[]; complexity: string }>)[slug]?.complexity ?? '') : ''}
                    />
                ))}
            </ul>
        </section>
    );
}
