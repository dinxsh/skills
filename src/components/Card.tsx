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
    isSelected?: boolean;
    onCartToggle?: (slug: string) => void;
    completeness?: number;
    complexity?: string;
}

export default function Card({
    href,
    title,
    body,
    tag,
    dateAdded,
    slug,
    category,
    isSelected = false,
    onCartToggle,
    completeness = 0,
    complexity = '',
}: CardProps) {
    const linkUrl = slug ? `/tools/${slug}` : href;
    const isNew = isRecentlyAdded(dateAdded, 30);

    return (
        <li className={`link-card${isSelected ? ' link-card--selected' : ''}`}>
            <a
                href={linkUrl}
                onClick={() => {
                    window.dispatchEvent(new CustomEvent('tools:save-state'));
                }}
            >
                <div className="card-top">
                    {category && <span className="card-category">{category}</span>}
                    {isNew && <span className="tag-new" title="Recently added">new</span>}
                    {complexity && (
                        <span className={`card-complexity card-complexity--${complexity.toLowerCase()}`}>{complexity}</span>
                    )}
                </div>
                <strong className="card-title">{title}</strong>
                <p className="card-body">{body}</p>
                <div className="card-footer">
                    {tag && <span className="tag">{tag}</span>}
                    {completeness > 0 && (
                        <span className="card-completeness" title={`Prompt quality: ${completeness}/4`} aria-label={`Prompt quality ${completeness} out of 4`}>
                            {Array.from({ length: 4 }, (_, i) => (
                                <span key={i} className={`completeness-dot${i < completeness ? ' completeness-dot--filled' : ''}`} />
                            ))}
                        </span>
                    )}
                </div>
            </a>
            {slug && (
                <div className="card-bookmark">
                    <BookmarkButton slug={slug} title={title} variant="small" />
                </div>
            )}
            {slug && onCartToggle && (
                <button
                    className={`card-cart-btn${isSelected ? ' card-cart-btn--active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onCartToggle(slug); }}
                    aria-label={isSelected ? `Remove ${title} from build` : `Add ${title} to build`}
                    title={isSelected ? 'Remove from build' : 'Add to build'}
                >
                    {isSelected ? '−' : '+'}
                </button>
            )}
        </li>
    );
}
