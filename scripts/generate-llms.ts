import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalogPath = path.join(__dirname, '../src/data/skills-catalog.json');
const toolsPath = path.join(__dirname, '../src/data/tools.json');
const outputPath = path.join(__dirname, '../public/llms.txt');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8')) as Record<string, {
    title: string; description: string; useCase: string; chains: string[];
    endpoints: string[]; keyParams: Record<string, string>;
    responseFields: string[]; creditCost: string; complexity: string;
}>;

const toolsData = JSON.parse(fs.readFileSync(toolsPath, 'utf-8')) as {
    tools: Array<{ title: string; category: string; content: Array<{ slug?: string; title: string; body: string }> }>
};

const totalSkills = toolsData.tools.reduce((acc, cat) => acc + cat.content.length, 0);

const lines: string[] = [];

lines.push(`# GoldRush Skills`);
lines.push(`> ${totalSkills} copy-paste code skills for building onchain products with the GoldRush API (by Covalent).`);
lines.push('');
lines.push('GoldRush Skills is a developer resource directory for the GoldRush multichain data API.');
lines.push('Each skill is a focused, production-ready code snippet using the @covalenthq/client-sdk');
lines.push('or @covalenthq/goldrush-kit that solves a specific onchain data problem.');
lines.push('');
lines.push('## What is GoldRush?');
lines.push('GoldRush (by Covalent) is a unified blockchain data API supporting 200+ EVM and non-EVM chains.');
lines.push('SDK: @covalenthq/client-sdk');
lines.push('UI Kit: @covalenthq/goldrush-kit');
lines.push('Docs: https://goldrush.dev/docs');
lines.push('API Key: https://goldrush.dev');
lines.push('');
lines.push('## Core Services');
lines.push('- BalanceService — token balances, ERC-20 transfers, historical portfolio, NFT holdings');
lines.push('- TransactionService — transaction history, summaries, decoded receipts, block transactions');
lines.push('- NftService — NFT metadata, collection traits, rarity, transfer history, chain collections');
lines.push('- PricingService — historical token prices, spot prices, market cap');
lines.push('- SecurityService — wallet approvals (ERC-20 + NFT), risk scoring');
lines.push('- BaseService — event logs, blocks, chain status, multi-chain activity scan');
lines.push('- AllChainsService — cross-chain wallet discovery, portfolio aggregation');
lines.push('');
lines.push('## Supported Chains (sample)');
lines.push('eth-mainnet, base-mainnet, matic-mainnet, arbitrum-mainnet, optimism-mainnet,');
lines.push('bsc-mainnet, avalanche-mainnet, linea-mainnet, scroll-mainnet, zksync-mainnet,');
lines.push('blast-mainnet, mantle-mainnet, fantom-mainnet, gnosis-mainnet, celo-mainnet,');
lines.push('moonbeam-mainnet, zora-mainnet, solana-mainnet, btc-mainnet, aptos-mainnet,');
lines.push('sui-mainnet, cosmos-mainnet, osmosis-mainnet, aurora-mainnet, tron-mainnet,');
lines.push('and 200+ more.');
lines.push('');
lines.push('## Skills Reference');
lines.push('');
lines.push('Each entry: slug | description | use case | endpoint (first) | cost | complexity');
lines.push('');

for (const cat of toolsData.tools) {
    lines.push(`### ${cat.title} (${cat.content.length} skills)`);
    lines.push('');
    for (const tool of cat.content) {
        const slug = tool.slug ?? '';
        const meta = catalog[slug];
        if (!meta) {
            lines.push(`**${slug}**`);
            lines.push(`  Description: ${tool.body}`);
            lines.push(`  URL: https://skills.goldrush.dev/tools/${slug}`);
            lines.push('');
            continue;
        }
        lines.push(`**${slug}**`);
        lines.push(`  Description: ${meta.description || tool.body}`);
        if (meta.useCase) lines.push(`  Use case: ${meta.useCase}`);
        if (meta.endpoints?.length > 0) lines.push(`  Endpoint: ${meta.endpoints[0]}`);
        if (meta.creditCost) lines.push(`  Cost: ${meta.creditCost}`);
        if (meta.complexity) lines.push(`  Level: ${meta.complexity}`);
        if (meta.chains?.length > 0) lines.push(`  Chains: ${meta.chains.slice(0, 6).join(', ')}${meta.chains.length > 6 ? ` +${meta.chains.length - 6} more` : ''}`);
        lines.push(`  URL: https://skills.goldrush.dev/tools/${slug}`);
        lines.push('');
    }
}

lines.push('## How to use these skills');
lines.push('Each skill page at https://skills.goldrush.dev/tools/{slug} contains:');
lines.push('- A working TypeScript/JavaScript code snippet using @covalenthq/client-sdk');
lines.push('- The GoldRush API endpoint(s) used');
lines.push('- Supported chains');
lines.push('- Complexity level (beginner / intermediate / advanced)');
lines.push('- Use case description');
lines.push('- Key parameters and response fields');
lines.push('- Credit cost estimate');
lines.push('');
lines.push('## Quick start');
lines.push('```typescript');
lines.push('import { GoldRushClient } from "@covalenthq/client-sdk";');
lines.push('const client = new GoldRushClient("YOUR_API_KEY");');
lines.push('');
lines.push('// Get all token balances for a wallet');
lines.push('const resp = await client.BalanceService.getTokenBalancesForWalletAddress(');
lines.push('  "eth-mainnet",');
lines.push('  "0xwalletAddress"');
lines.push(');');
lines.push('if (resp.error) throw new Error(resp.error_message ?? "API error");');
lines.push('const items = resp.data?.items ?? [];');
lines.push('```');
lines.push('');
lines.push('Get a free API key: https://goldrush.dev');
lines.push('Full SDK docs: https://goldrush.dev/docs/unified-api/sdk/');
lines.push('GoldRush Kit (React components): https://goldrush.dev/docs/goldrush-kit/');

fs.writeFileSync(outputPath, lines.join('\n'));
console.log(`✅ Generated llms.txt with ${totalSkills} skills (${lines.length} lines)`);
