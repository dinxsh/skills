import './Card.css';
import BookmarkButton from './BookmarkButton';
import { isRecentlyAdded } from '../utils/dates';

interface CardProps {
    href: string;
    title: string;
    body: string;
    tag?: string | undefined;
    dateAdded?: string | undefined;
    slug?: string | undefined;
    category?: string | undefined;
}

export default function Card({
    href,
    title,
    body,
    tag,
    dateAdded,
    slug,
    category,
}: CardProps) {
    const linkUrl = slug ? `/tools/${slug}` : href;
    const isNew = isRecentlyAdded(dateAdded, 30);

    return (
        <li className="link-card">
            <a
                href={linkUrl}
                onClick={() => {
                    window.dispatchEvent(new CustomEvent('tools:save-state'));
                }}
            >
                <div className="card-top">
                    {category && <span className="card-category">{category}</span>}
                    {isNew && <span className="tag-new" title="Recently added">new</span>}
                </div>
                <strong className="card-title">{title}</strong>
                <p className="card-body">{body}</p>
                <div className="card-footer">
                    {tag && <span className="tag">{tag}</span>}
                </div>
            </a>
            {slug && (
                <div className="card-bookmark">
                    <BookmarkButton slug={slug} title={title} variant="small" />
                </div>
            )}
        </li>
    );
}
