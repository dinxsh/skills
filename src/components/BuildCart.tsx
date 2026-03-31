import { useState, useCallback } from 'react';
import './BuildCart.css';
import catalog from '../data/skills-catalog.json';
import { buildCombinedPrompt } from '../utils/prompt';

type CatalogEntry = {
    title: string;
    description: string;
    useCase: string;
    chains: string[];
    snippet: string;
    endpoints: string[];
    keyParams: Record<string, string>;
    responseFields: string[];
    creditCost: string;
    complexity: string;
};

declare global {
    interface Window { gtag?: (...args: any[]) => void; }
}
const track = (event: string, params: Record<string, any>) => window.gtag?.('event', event, params);

interface BuildCartProps {
    selectedSlugs: string[];
    onClear: () => void;
    onRemove: (slug: string) => void;
}

export default function BuildCart({ selectedSlugs, onClear, onRemove }: BuildCartProps) {
    const [showModal, setShowModal] = useState(false);
    const [copied, setCopied] = useState(false);
    const [shared, setShared] = useState(false);

    const handleShare = useCallback(() => {
        const url = `${window.location.origin}/?cart=${selectedSlugs.join(',')}`;
        navigator.clipboard.writeText(url).then(() => {
            setShared(true);
            setTimeout(() => setShared(false), 2500);
            track('build_cart_shared', { skill_count: selectedSlugs.length, skill_slugs: selectedSlugs.join(',') });
        });
    }, [selectedSlugs]);

    const prompt = buildCombinedPrompt(selectedSlugs);

    const handleGenerate = useCallback(() => {
        track('build_prompt_generated', {
            skill_count: selectedSlugs.length,
            skill_slugs: selectedSlugs.join(','),
        });
        setShowModal(true);
    }, [selectedSlugs]);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(prompt).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
            track('build_prompt_copy', {
                skill_count: selectedSlugs.length,
                skill_slugs: selectedSlugs.join(','),
            });
        });
    }, [prompt, selectedSlugs]);

    const handleClose = useCallback(() => {
        setShowModal(false);
        setCopied(false);
    }, []);

    const handleDownload = useCallback(() => {
        if (!prompt) return;
        const appTitle = selectedSlugs.length === 1
            ? ((catalog as Record<string, CatalogEntry>)[selectedSlugs[0] ?? '']?.title ?? 'skill')
            : `${selectedSlugs.slice(0, 3).map(s => (catalog as Record<string, CatalogEntry>)[s]?.title?.split(' ')[0] ?? s).join('-')}-dashboard`;
        const filename = appTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-prompt.md';
        const blob = new Blob([prompt], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        track('build_prompt_download', { skill_count: selectedSlugs.length, skill_slugs: selectedSlugs.join(',') });
    }, [prompt, selectedSlugs]);

    if (selectedSlugs.length === 0) return null;

    const skillEntries = selectedSlugs.map(s => ({
        slug: s,
        title: (catalog as Record<string, CatalogEntry>)[s]?.title ?? s,
    }));

    return (
        <>
            {/* Sticky bottom bar */}
            <div className="build-cart" role="region" aria-label="Build cart">
                <div className="build-cart-inner">
                    <div className="build-cart-skills">
                        {skillEntries.map(({ slug, title }) => (
                            <span key={slug} className="build-cart-chip">
                                {title}
                                <button
                                    className="build-cart-chip-remove"
                                    onClick={() => onRemove(slug)}
                                    aria-label={`Remove ${title}`}
                                >×</button>
                            </span>
                        ))}
                    </div>
                    <div className="build-cart-actions">
                        <span className="build-cart-count">{selectedSlugs.length} skill{selectedSlugs.length !== 1 ? 's' : ''}</span>
                        <button className="build-cart-clear" onClick={onClear}>clear</button>
                        <button className="build-cart-share" onClick={handleShare} title="Copy shareable cart link">
                            {shared ? (
                                <><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
                            ) : (
                                <><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 256 256"><path d="M240,88.23a54.43,54.43,0,0,1-16,37L189.25,160a54.27,54.27,0,0,1-38.63,16h-.05A54.63,54.63,0,0,1,96,119.84a8,8,0,0,1,16,.45A38.62,38.62,0,0,0,150.58,160h0a38.39,38.39,0,0,0,27.31-11.31l34.75-34.75a38.63,38.63,0,0,0-54.63-54.63l-11,11A8,8,0,0,1,135.7,59l11-11A54.65,54.65,0,0,1,224,48,54.86,54.86,0,0,1,240,88.23ZM109,185.66l-11,11A38.41,38.41,0,0,1,70.6,208h0a38.63,38.63,0,0,1-27.29-65.94L78,107.31A38.63,38.63,0,0,1,144,135.71a8,8,0,0,0,16,.45A54.86,54.86,0,0,0,144,96a54.65,54.65,0,0,0-77.27,0L32,130.75A54.62,54.62,0,0,0,70.56,224h0a54.28,54.28,0,0,0,38.64-16l11-11A8,8,0,0,0,109,185.66Z"/></svg> Share</>
                            )}
                        </button>
                        <button className="build-cart-generate" onClick={handleGenerate}>
                            Generate combined prompt →
                        </button>
                    </div>
                </div>
            </div>

            {/* Combined prompt modal */}
            {showModal && (
                <div className="build-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
                    <div className="build-modal">
                        <div className="build-modal-header">
                            <div className="build-modal-title">
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                Combined Claude prompt
                                <span className="build-modal-badge">{selectedSlugs.length} skills</span>
                            </div>
                            <div className="build-modal-header-actions">
                                <button className="build-modal-download" onClick={handleDownload} title="Download as .md">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor" viewBox="0 0 256 256"><path d="M224,144v64a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144a8,8,0,0,1,16,0v56H208V144a8,8,0,0,1,16,0Zm-101.66,5.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,124.69V32a8,8,0,0,0-16,0v92.69L93.66,98.34a8,8,0,0,0-11.32,11.32Z"/></svg>
                                    .md
                                </button>
                                <button className="build-modal-copy" onClick={handleCopy}>
                                    {copied ? (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" fill="currentColor" viewBox="0 0 256 256"><path d="M216,32H88a8,8,0,0,0-8,8V80H40a8,8,0,0,0-8,8V216a8,8,0,0,0,8,8H168a8,8,0,0,0,8-8V176h40a8,8,0,0,0,8-8V40A8,8,0,0,0,216,32ZM160,208H48V96H160Zm48-48H176V88a8,8,0,0,0-8-8H96V48H208Z"/></svg>
                                            Copy prompt
                                        </>
                                    )}
                                </button>
                                <button className="build-modal-close" onClick={handleClose} aria-label="Close">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 6L6 18M6 6l12 12"/></svg>
                                </button>
                            </div>
                        </div>
                        <p className="build-modal-hint">
                            Copy → paste into Claude → get a complete, deployable Next.js app with {selectedSlugs.length} GoldRush skill{selectedSlugs.length !== 1 ? 's' : ''}, full TypeScript, error handling, and Vercel-ready setup.
                        </p>
                        <textarea className="build-modal-textarea" readOnly value={prompt} />
                        {copied && (
                            <div className="build-modal-next">
                                <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer" className="build-modal-open-claude">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                                    Open Claude.ai →
                                </a>
                                <a href="https://goldrush.dev/platform/auth/register" target="_blank" rel="noopener noreferrer" className="build-modal-next-step">
                                    Get API key →
                                </a>
                                <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer" className="build-modal-next-step">
                                    Deploy on Vercel →
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
