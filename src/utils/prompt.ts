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

function toSlug(title: string) {
    return title.replace(/[^a-zA-Z0-9]/g, '');
}

const chainNameMap: Record<string, string> = {
    ethereum: 'eth-mainnet', polygon: 'matic-mainnet', base: 'base-mainnet',
    arbitrum: 'arbitrum-mainnet', optimism: 'optimism-mainnet', bsc: 'bsc-mainnet',
    avalanche: 'avalanche-mainnet', solana: 'solana-mainnet', bitcoin: 'btc-mainnet',
    ronin: 'ronin-mainnet', gnosis: 'gnosis-mainnet',
};

export function buildCombinedPrompt(
    slugs: string[],
    opts?: { title?: string; description?: string }
): string {
    const skills = slugs
        .map(s => (catalog as Record<string, CatalogEntry>)[s])
        .filter((s): s is CatalogEntry => Boolean(s));

    if (skills.length === 0) return '';

    const allChains = [...new Set(skills.flatMap(s => s.chains))];
    const isSolanaOnly = allChains.length === 1 && allChains[0] === 'solana';

    const chainEntries = allChains
        .slice(0, 8)
        .map(c => `  { label: "${c.charAt(0).toUpperCase() + c.slice(1)}", value: "${chainNameMap[c] ?? c + '-mainnet'}" }`)
        .join(',\n');

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

    const appTitle = opts?.title ?? (
        skills.length === 1
            ? skills[0]!.title
            : `${skills.map(s => s.title.split(' ')[0]).slice(0, 3).join(' + ')} Dashboard`
    );

    const appDescription = opts?.description
        ? `${opts.description}\n\nCombines ${skills.length} GoldRush skill${skills.length > 1 ? 's' : ''} into one cohesive UI.`
        : `A single-page app that combines ${skills.length} GoldRush onchain data skill${skills.length > 1 ? 's' : ''} into one cohesive UI. Each skill renders in its own section with live data from the GoldRush API.`;

    return `You are a senior full-stack engineer. Build a complete, production-ready Next.js 14 app. Write every file in full — no placeholders, no TODOs, no "...add more here" comments. All code must be functional and deployable.

## App: ${appTitle}

### What to build
${appDescription}

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
export const DEFAULT_CHAIN: ChainId = "${chainNameMap[allChains[0] ?? ''] ?? (allChains[0] ?? 'eth') + '-mainnet'}";
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
${componentNames.map((f, i) => `import ${toSlug(skills[i]!.title)} from "@/components/${f.replace('.tsx', '')}";`).join('\n')}

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
        ${componentNames.map((_f, i) => `<${toSlug(skills[i]!.title)} chain={chain} address={address} />`).join('\n        ')}
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
