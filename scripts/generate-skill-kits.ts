import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const kitsPath = path.join(__dirname, '../src/data/kits.json');
const outPath = path.join(__dirname, '../src/data/skill-kits.json');

const { kits } = JSON.parse(fs.readFileSync(kitsPath, 'utf-8')) as {
    kits: Array<{ id: string; title: string; emoji: string; complexity: string; skills: string[] }>;
};

// Build reverse index: slug → list of kits it belongs to
const skillKits: Record<string, Array<{ id: string; title: string; emoji: string; complexity: string }>> = {};
for (const kit of kits) {
    for (const slug of kit.skills) {
        if (!skillKits[slug]) skillKits[slug] = [];
        skillKits[slug].push({ id: kit.id, title: kit.title, emoji: kit.emoji, complexity: kit.complexity });
    }
}

fs.writeFileSync(outPath, JSON.stringify(skillKits, null, 2));
console.log(`✅ Generated skill-kits.json — ${Object.keys(skillKits).length} skills mapped to kits`);
