import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalogPath = path.join(__dirname, '../src/data/skills-catalog.json');
const toolsPath = path.join(__dirname, '../src/data/tools.json');
const outputPath = path.join(__dirname, '../public/llms-full.txt');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8')) as Record<string, {
    title: string; description: string; useCase: string; chains: string[];
    snippet: string; endpoints: string[]; keyParams: Record<string, string>;
    responseFields: string[]; creditCost: string; complexity: string;
}>;

const toolsData = JSON.parse(fs.readFileSync(toolsPath, 'utf-8')) as {
    tools: Array<{ title: string; category: string; content: Array<{ slug?: string; title: string; body: string }> }>
};

const totalSkills = toolsData.tools.reduce((acc, cat) => acc + cat.content.length, 0);

// Fix Windows-1252 mojibake
const clean = (s: string) => s
    .replace(/\u00e2\u20ac\u201d/g, '\u2014')
    .replace(/\u00e2\u20ac\u2018/g, '\u2013')
    .replace(/\u00e2\u20ac\u2122/g, '\u2019')
    .replace(/\u00e2\u20ac\u0153/g, '\u201c')
    .replace(/\u00e2\u20ac\u009d/g, '\u201d');

const lines: string[] = [];

lines.push(`# GoldRush Skills — Full Reference (with code)`);
lines.push(`> ${totalSkills} skills with complete TypeScript snippets for the GoldRush API (by Covalent).`);
lines.push('');
lines.push('This is the full version of llms.txt — each skill includes its ready-to-use TypeScript snippet.');
lines.push('Lightweight index (no snippets): https://skills.goldrush.dev/llms.txt');
lines.push('');
lines.push('GoldRush (by Covalent) is a unified blockchain data API supporting 200+ EVM and non-EVM chains.');
lines.push('SDK: @covalenthq/client-sdk  |  UI Kit: @covalenthq/goldrush-kit  |  Docs: https://goldrush.dev/docs');
lines.push('');
lines.push('## Quick start');
lines.push('```typescript');
lines.push('import { GoldRushClient } from "@covalenthq/client-sdk";');
lines.push('const client = new GoldRushClient(process.env.GOLDRUSH_API_KEY!);');
lines.push('```');
lines.push('');
lines.push('## Skills — Full Reference');
lines.push('');

let snippetCount = 0;

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
        lines.push(`  Description: ${clean(meta.description || tool.body)}`);
        if (meta.useCase) lines.push(`  Use case: ${clean(meta.useCase)}`);
        if (meta.endpoints?.length > 0) lines.push(`  Endpoints: ${meta.endpoints.join(', ')}`);
        if (meta.creditCost) lines.push(`  Cost: ${meta.creditCost}`);
        if (meta.complexity) lines.push(`  Level: ${meta.complexity}`);
        if (meta.chains?.length > 0) lines.push(`  Chains: ${meta.chains.slice(0, 8).join(', ')}${meta.chains.length > 8 ? ` +${meta.chains.length - 8} more` : ''}`);
        if (meta.keyParams && Object.keys(meta.keyParams).length > 0) {
            lines.push(`  Key params: ${Object.entries(meta.keyParams).map(([k, v]) => `${k} (${v})`).join(', ')}`);
        }
        if (meta.responseFields?.length > 0) {
            lines.push(`  Response fields: ${meta.responseFields.join(', ')}`);
        }
        lines.push(`  URL: https://skills.goldrush.dev/tools/${slug}`);
        if (meta.snippet) {
            lines.push('  ```typescript');
            for (const line of meta.snippet.split('\n')) {
                lines.push(`  ${line}`);
            }
            lines.push('  ```');
            snippetCount++;
        }
        lines.push('');
    }
}

lines.push('---');
lines.push(`Generated: ${new Date().toISOString().split('T')[0]}`);
lines.push(`Total: ${totalSkills} skills, ${snippetCount} with code snippets`);
lines.push('API key: https://goldrush.dev  |  Docs: https://goldrush.dev/docs/unified-api/sdk/');

fs.writeFileSync(outputPath, lines.join('\n'));
console.log(`✅ Generated llms-full.txt with ${totalSkills} skills, ${snippetCount} snippets (${lines.length} lines)`);
