import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const metadataDir = path.join(__dirname, '../src/data/tool-metadata');
const outputPath = path.join(__dirname, '../src/data/skills-catalog.json');

console.log('📚 Generating skills-catalog.json...\n');

const catalog: Record<string, {
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
}> = {};

let count = 0;

for (const file of fs.readdirSync(metadataDir).filter(f => f.endsWith('.json'))) {
    const slug = file.replace('.json', '');
    try {
        const meta = JSON.parse(fs.readFileSync(path.join(metadataDir, file), 'utf-8'));
        catalog[slug] = {
            title: meta.title || slug,
            description: meta.description || '',
            useCase: meta.useCase || '',
            chains: meta.chains || [],
            snippet: meta.snippet || '',
            endpoints: meta.endpoints || [],
            keyParams: meta.keyParams || {},
            responseFields: meta.responseFields || [],
            creditCost: meta.creditCost || '1 credit/call',
            complexity: meta.complexity || 'Beginner',
        };
        count++;
    } catch (e) {
        console.warn(`⚠️  Skipping ${file}: invalid JSON`);
    }
}

fs.writeFileSync(outputPath, JSON.stringify(catalog, null, 2));
console.log(`✅ Generated skills-catalog.json with ${count} entries`);
