import { useState, useEffect } from 'react';
import data from '../data/tools.json';
import type { Category, Tool } from '../types';
import './RecentlyViewed.css';

interface RecentTool {
    slug: string;
    title: string;
    body: string;
    tag: string;
    category: string;
}

const lookup = new Map<string, RecentTool>();
for (const cat of data.tools as Category[]) {
    for (const tool of cat.content as Tool[]) {
        if (tool.slug) {
            lookup.set(tool.slug, {
                slug: tool.slug,
                title: tool.title,
                body: tool.body,
                tag: tool.tag ?? '',
                category: cat.title,
            });
        }
    }
}

export default function RecentlyViewed() {
    const [tools, setTools] = useState<RecentTool[]>([]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem('recently_viewed');
            const slugs: string[] = raw ? JSON.parse(raw) : [];
            const resolved = slugs
                .map(s => lookup.get(s))
                .filter((t): t is RecentTool => Boolean(t));
            setTools(resolved);
        } catch {}
    }, []);

    if (tools.length === 0) return null;

    return (
        <section className="rv-section">
            <h2 className="rv-heading">Recently viewed</h2>
            <div className="rv-strip">
                {tools.map(t => (
                    <a key={t.slug} href={`/tools/${t.slug}`} className="rv-card">
                        <span className="rv-tag">{t.tag}</span>
                        <strong className="rv-title">{t.title}</strong>
                        <p className="rv-body">{t.body}</p>
                    </a>
                ))}
            </div>
        </section>
    );
}
