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

function toSlug(title: string) {
    return title.replace(/[^a-zA-Z0-9]/g, '');
}

function buildCombinedPrompt(slugs: string[]): string {
    const skills = slugs
        .map(s => (catalog as Record<string, CatalogEntry>)[s])
        .filter(Boolean);

    if (skills.length === 0) return '';

    const allChains = [...new Set(skills.flatMap(s => s.chains))];
    const isSolanaOnly = allChains.length === 1 && allChains[0] === 'solana';

    const chainNameMap: Record<string, string> = {
        ethereum: 'eth-mainnet', polygon: 'matic-mainnet', base: 'base-mainnet',
        arbitrum: 'arbitrum-mainnet', optimism: 'optimism-mainnet', bsc: 'bsc-mainnet',
        avalanche: 'avalanche-mainnet', solana: 'solana-mainnet', bitcoin: 'btc-mainnet',
        ronin: 'ronin-mainnet', gnosis: 'gnosis-mainnet',
    };

    const chainEntries = allChains
        .slice(0, 8)
        .map(c => `  { label: "${c.charAt(0).toUpperCase() + c.slice(1)}", value: "${chainNameMap[c] ?? c + '-mainnet'}" }`)
        .join(',\n');

    // File structure
    const componentNames = skills.map(s => `${toSlug(s.title)}.tsx`);
    const hookNames = skills.map(s => `use${toSlug(s.title)}.ts`);
    const fileTree = [
        'app/',
        '  page.tsx            # Main page — chain selector + skill grid',
        '  layout.tsx',
        'lib/',
        '  goldrush.ts         # GoldRush client singleton',
        '  chains.ts           # CHAINS constant + ChainId type',
        '  format.ts           # formatUSD, truncateAddress helpers',
        'components/',
        '  ChainSelector.tsx   # Shared chain dropdown',
        ...componentNames.map(f => `  ${f}`),
        'hooks/',
        ...hookNames.map(f => `  ${f}`),
        'types/',
        '  goldrush.ts         # Shared TypeScript interfaces',
    ].join('\n');

    // Per-skill sections
    const skillSections = skills.map((s, i) => {
        const params = Object.entries(s.keyParams ?? {})
            .map(([k, v]) => `  //   ${k}: ${v}`)
            .join('\n');
        const fields = (s.responseFields ?? []).slice(0, 5).map(f => `  //   ${f}`).join('\n');
        const endpoint = s.endpoints?.[0] ?? '';
        const snippetBlock = s.snippet
            ? `\n\`\`\`typescript\n// hooks/${hookNames[i]}\n${s.snippet}\n\`\`\``
            : '';

        return [
            `### Skill ${i + 1}: ${s.title}`,
            s.useCase ? `> ${s.useCase}` : '',
            '',
            endpoint ? `**API endpoint:** \`${endpoint}\`\n` : '',
            params ? `**Key parameters:**\n\`\`\`\n${params}\n\`\`\`` : '',
            fields ? `\n**Response fields to display:**\n\`\`\`\n${fields}\n\`\`\`` : '',
            snippetBlock,
        ].filter(Boolean).join('\n');
    }).join('\n\n---\n\n');

    const appTitle = skills.length === 1
        ? skills[0].title
        : `${skills.map(s => s.title.split(' ')[0]).slice(0, 3).join(' + ')} Dashboard`;

    return `You are a senior full-stack engineer. Build a complete, production-ready Next.js 14 app. Write every file in full — no placeholders, no TODOs, no "...add more here" comments. All code must be functional and deployable.

## App: ${appTitle}

### What to build
A single-page app that combines ${skills.length} GoldRush onchain data skill${skills.length > 1 ? 's' : ''} into one cohesive UI. Each skill renders in its own section with live data from the GoldRush API.

---

## 1. Setup

\`\`\`bash
npx create-next-app@latest my-app --typescript --tailwind --app
cd my-app
npm install @covalenthq/client-sdk
\`\`\`

Create \`.env.local\`:
\`\`\`
GOLDRUSH_API_KEY=your_api_key_here
\`\`\`

---

## 2. File structure

\`\`\`
${fileTree}
\`\`\`

---

## 3. Shared utilities

**lib/goldrush.ts** — client singleton (import this everywhere, never re-instantiate):
\`\`\`typescript
import { GoldRushClient } from "@covalenthq/client-sdk";
if (!process.env.GOLDRUSH_API_KEY) throw new Error("Missing GOLDRUSH_API_KEY");
export const goldrush = new GoldRushClient(process.env.GOLDRUSH_API_KEY);
\`\`\`

**lib/chains.ts** — chain options${isSolanaOnly ? ' (Solana only)' : ''}:
\`\`\`typescript
export const CHAINS = [
${chainEntries}
] as const;
export type ChainId = (typeof CHAINS)[number]["value"];
export const DEFAULT_CHAIN: ChainId = "${chainNameMap[allChains[0]] ?? allChains[0] + '-mainnet'}";
\`\`\`

**lib/format.ts** — shared formatters:
\`\`\`typescript
export const formatUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
export const truncateAddr = (addr: string) =>
  addr ? \`\${addr.slice(0, 6)}…\${addr.slice(-4)}\` : "";
\`\`\`

---

## 4. Error handling pattern (use this in every hook)

\`\`\`typescript
const resp = await goldrush.SomeService.getEndpoint(chainId, address);
if (resp.error) throw new Error(resp.error_message ?? "GoldRush API error");
const items = resp.data?.items ?? [];
\`\`\`

---

## 5. Skills to implement

${skillSections}

---

## 6. UI requirements

- **Chain selector** at top of page — changing chain re-fetches all sections simultaneously
- **Each skill section** has:
  - Section title + description
  - Loading skeleton (animated pulse) while \`isLoading\`
  - Error state showing \`error.message\` with a "Retry" button that re-runs the fetch
  - Data table or card grid once loaded
- **Layout**: responsive grid, 2 columns on ≥768px, 1 column on mobile
- **Formatting**: all USD values via \`formatUSD()\`, all addresses via \`truncateAddr()\`
- **Tailwind only** — no additional CSS files

---

## 7. Main page structure (app/page.tsx)

\`\`\`typescript
"use client";
import { useState } from "react";
import { CHAINS, DEFAULT_CHAIN, type ChainId } from "@/lib/chains";
import ChainSelector from "@/components/ChainSelector";
${componentNames.map((f, i) => `import ${toSlug(skills[i].title)} from "@/components/${f.replace('.tsx', '')}";`).join('\n')}

export default function Page() {
  const [chain, setChain] = useState<ChainId>(DEFAULT_CHAIN);
  const [address, setAddress] = useState("demo.eth");

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center gap-4 mb-8">
        <input value={address} onChange={e => setAddress(e.target.value)}
          placeholder="Wallet address or ENS" className="border px-3 py-2 rounded flex-1 max-w-sm" />
        <ChainSelector value={chain} onChange={setChain} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        ${componentNames.map((f, i) => `<${toSlug(skills[i].title)} chain={chain} address={address} />`).join('\n        ')}
      </div>
    </main>
  );
}
\`\`\`

---

## 8. Delivery order

Write files in this exact sequence:
1. \`lib/goldrush.ts\`
2. \`lib/chains.ts\`
3. \`lib/format.ts\`
4. \`types/goldrush.ts\` (interfaces for each skill's response)
${hookNames.map((h, i) => `${5 + i}. \`hooks/${h}\``).join('\n')}
${componentNames.map((c, i) => `${5 + hookNames.length + i}. \`components/${c}\``).join('\n')}
${5 + hookNames.length + componentNames.length}. \`components/ChainSelector.tsx\`
${6 + hookNames.length + componentNames.length}. \`app/page.tsx\`

Make every file complete. The app must run with \`npm run dev\` and deploy on Vercel with only \`GOLDRUSH_API_KEY\` set.`;
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
                            Copy → paste into Claude → get a complete, deployable Next.js app with {selectedSlugs.length} GoldRush skill{selectedSlugs.length !== 1 ? 's' : ''}, full TypeScript, error handling, and Vercel-ready setup.
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
