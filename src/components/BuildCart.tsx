import { useState, useCallback } from 'react';
import './BuildCart.css';
import catalog from '../data/skills-catalog.json';

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

function buildCombinedPrompt(slugs: string[]): string {
    const skills = slugs
        .map(s => (catalog as Record<string, CatalogEntry>)[s])
        .filter(Boolean);

    if (skills.length === 0) return '';

    const titles = skills.map(s => s.title).join(', ');
    const allChains = [...new Set(skills.flatMap(s => s.chains))];
    const chainNameMap: Record<string, string> = {
        ethereum: 'eth-mainnet', polygon: 'matic-mainnet', base: 'base-mainnet',
        arbitrum: 'arbitrum-mainnet', optimism: 'optimism-mainnet', bsc: 'bsc-mainnet',
        avalanche: 'avalanche-mainnet', solana: 'solana-mainnet', bitcoin: 'btc-mainnet',
    };
    const chainOptions = allChains
        .slice(0, 8)
        .map(c => `{ label: "${c.charAt(0).toUpperCase() + c.slice(1)}", value: "${chainNameMap[c] ?? c + '-mainnet'}" }`)
        .join(', ');

    const skillSections = skills.map((s, i) => {
        const epLine = s.endpoints.length > 0 ? `\n  Endpoint: ${s.endpoints[0]}` : '';
        const useLine = s.useCase ? `\n  Purpose: ${s.useCase}` : '';
        const snippetBlock = s.snippet
            ? `\n\n  Starting code:\n  \`\`\`typescript\n${s.snippet.split('\n').map(l => '  ' + l).join('\n')}\n  \`\`\``
            : '';
        return `### ${i + 1}. ${s.title}${useLine}${epLine}${snippetBlock}`;
    }).join('\n\n');

    const responseFieldLines = skills
        .flatMap(s => s.responseFields.slice(0, 3).map(f => `  - ${f} (from ${s.title})`))
        .join('\n');

    return `Build a production-ready web app that combines these GoldRush onchain data skills:

## Skills included (${skills.length} total)

${skillSections}

## Architecture
- Next.js 14 App Router + TypeScript + Tailwind CSS
- @covalenthq/client-sdk (GoldRush SDK v3)
- Environment variable: GOLDRUSH_API_KEY
- Shared GoldRush client singleton in \`lib/goldrush.ts\`
- Each skill becomes its own React component + custom hook
- Shared chain selector at the top level that re-fetches all components on change

## Chain support
const CHAINS = [${chainOptions}];

When the chain changes, all components re-fetch simultaneously. Default to the first chain.

## UI requirements
1. Chain dropdown at the top of the page
2. Grid layout — each skill gets its own card/section
3. Loading skeleton per section while fetching
4. Error state per section with retry button
5. All response fields displayed:
${responseFieldLines}
6. USD values formatted as $x,xxx.xx
7. Responsive on mobile

## Code quality
- Full TypeScript — no \`any\` types
- Use GoldRush SDK types from @covalenthq/client-sdk
- async/await + check resp.error before resp.data
- Extract shared types to \`types/goldrush.ts\`

Build the complete app: main page, all skill components, hooks, shared utilities, and the chain switcher. Make it ready to deploy on Vercel.`;
}

export default function BuildCart({ selectedSlugs, onClear, onRemove }: BuildCartProps) {
    const [showModal, setShowModal] = useState(false);
    const [copied, setCopied] = useState(false);

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
                            Paste into Claude → get a complete Next.js app using all {selectedSlugs.length} GoldRush skills.
                        </p>
                        <textarea className="build-modal-textarea" readOnly value={prompt} />
                        {copied && (
                            <div className="build-modal-next">
                                <span className="build-modal-next-label">Next steps</span>
                                <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" className="build-modal-next-step">
                                    1 · Open Claude.ai and paste →
                                </a>
                                <a href="https://goldrush.dev/platform/auth/register" target="_blank" rel="noopener noreferrer" className="build-modal-next-step">
                                    2 · Get your free GoldRush API key →
                                </a>
                                <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer" className="build-modal-next-step">
                                    3 · Deploy to Vercel →
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
