import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const kitsPath = path.join(__dirname, '../src/data/kits.json');
const outPath = path.join(__dirname, '../src/data/skill-pairs.json');

const { kits } = JSON.parse(fs.readFileSync(kitsPath, 'utf-8')) as {
    kits: Array<{ id: string; skills: string[] }>;
};

// Build co-occurrence counts across all kits
const counts: Record<string, Record<string, number>> = {};
for (const kit of kits) {
    for (const slug of kit.skills) {
        if (!counts[slug]) counts[slug] = {};
        for (const other of kit.skills) {
            if (other !== slug) {
                counts[slug][other] = (counts[slug][other] ?? 0) + 1;
            }
        }
    }
}

// Top 4 co-occurring skills per slug
const pairs: Record<string, string[]> = {};
for (const [slug, co] of Object.entries(counts)) {
    pairs[slug] = Object.entries(co)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([s]) => s);
}

fs.writeFileSync(outPath, JSON.stringify(pairs, null, 2));
console.log(`✅ Generated skill-pairs.json — ${Object.keys(pairs).length} skills`);
