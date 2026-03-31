import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalogPath = path.join(__dirname, '../src/data/skills-catalog.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8')) as Record<string, {
    title: string; description: string; useCase: string; chains: string[];
    snippet: string; endpoints: string[]; keyParams: Record<string, string>;
    responseFields: string[]; creditCost: string; complexity: string;
}>;

type Field = 'snippet' | 'endpoints' | 'keyParams' | 'responseFields' | 'useCase' | 'description';
const FIELDS: Field[] = ['snippet', 'endpoints', 'keyParams', 'responseFields', 'useCase', 'description'];

interface AuditRow {
    slug: string;
    score: number;
    missing: string[];
}

const rows: AuditRow[] = [];

for (const [slug, entry] of Object.entries(catalog)) {
    const missing: string[] = [];
    if (!entry.snippet) missing.push('snippet');
    if (!entry.endpoints?.length) missing.push('endpoints');
    if (!entry.keyParams || Object.keys(entry.keyParams).length === 0) missing.push('keyParams');
    if (!entry.responseFields?.length) missing.push('responseFields');
    if (!entry.useCase) missing.push('useCase');
    if (!entry.description) missing.push('description');
    rows.push({ slug, score: FIELDS.length - missing.length, missing });
}

rows.sort((a, b) => a.score - b.score);

const incomplete = rows.filter(r => r.missing.length > 0);
const complete = rows.filter(r => r.missing.length === 0);

console.log(`\n📊 Catalog Audit — ${Object.keys(catalog).length} skills\n`);
console.log(`✅ Complete (${complete.length}/${rows.length})`);
console.log(`⚠️  Incomplete (${incomplete.length}/${rows.length})\n`);

if (incomplete.length > 0) {
    console.log('Slug'.padEnd(48) + 'Score'.padEnd(8) + 'Missing fields');
    console.log('─'.repeat(80));
    for (const { slug, score, missing } of incomplete) {
        console.log(slug.padEnd(48) + `${score}/${FIELDS.length}`.padEnd(8) + missing.join(', '));
    }
}

// Summary by field
console.log('\n📋 Missing by field:');
for (const field of FIELDS) {
    const count = rows.filter(r => r.missing.includes(field)).length;
    const bar = '█'.repeat(Math.round(count / rows.length * 20));
    console.log(`  ${field.padEnd(16)} ${String(count).padStart(3)} skills  ${bar}`);
}

// Score distribution
console.log('\n📈 Score distribution:');
for (let s = FIELDS.length; s >= 0; s--) {
    const count = rows.filter(r => r.score === s).length;
    if (count > 0) {
        const bar = '█'.repeat(count);
        console.log(`  ${s}/${FIELDS.length} dots  ${String(count).padStart(3)} skills  ${bar}`);
    }
}

console.log('');
