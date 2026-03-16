/**
 * rebuild-goldrush.cjs
 *
 * 1. Reads the 10 GoldRush category JSON files from src/data/tools/
 * 2. Rebuilds src/data/tools.json with all GoldRush tools
 * 3. Deletes 22 non-GoldRush category files
 * 4. Removes stale non-GoldRush metadata files from src/data/tool-metadata/
 * 5. Rebuilds src/data/slug-map.json with only valid slugs
 */

const fs   = require("fs");
const path = require("path");

const BASE  = path.join(__dirname, "..", "src", "data");
const TOOLS_DIR = path.join(BASE, "tools");
const META_DIR  = path.join(BASE, "tool-metadata");

// ─── GoldRush categories to KEEP ─────────────────────────────────────────────
const GOLDRUSH_CATEGORIES = [
  { file: "wallet",     title: "Wallet",       category: "wallet"     },
  { file: "defi",       title: "DeFi",         category: "defi"       },
  { file: "nft",        title: "NFT",          category: "nft"        },
  { file: "analytics",  title: "Analytics",    category: "analytics"  },
  { file: "agents",     title: "AI Agents",    category: "agents"     },
  { file: "developer",  title: "Developer",    category: "developer"  },
  { file: "crosschain", title: "Cross-chain",  category: "crosschain" },
  { file: "token",      title: "Tokens",       category: "token"      },
  { file: "identity",   title: "Identity",     category: "identity"   },
  { file: "security",   title: "Security",     category: "security"   },
];

// ─── Step 1: Rebuild tools.json ───────────────────────────────────────────────
const validSlugs = new Set();
const toolsJson  = { tools: [] };

GOLDRUSH_CATEGORIES.forEach(({ file, title, category }) => {
  const fp = path.join(TOOLS_DIR, `${file}.json`);
  if (!fs.existsSync(fp)) {
    console.warn(`  MISSING: ${file}.json — skipping`);
    return;
  }
  const items = JSON.parse(fs.readFileSync(fp, "utf8"));
  items.forEach(item => validSlugs.add(item.slug));
  toolsJson.tools.push({ title, category, content: items });
  console.log(`  ✓ ${file.padEnd(12)} ${items.length} tools`);
});

fs.writeFileSync(
  path.join(BASE, "tools.json"),
  JSON.stringify(toolsJson, null, 2)
);
console.log(`\n✓ tools.json rebuilt — ${validSlugs.size} total GoldRush tools across ${toolsJson.tools.length} categories`);

// ─── Step 2: Delete non-GoldRush category files ───────────────────────────────
const keepFiles = new Set(GOLDRUSH_CATEGORIES.map(c => `${c.file}.json`));
const allCatFiles = fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith(".json"));
let deletedCats = 0;
allCatFiles.forEach(f => {
  if (!keepFiles.has(f)) {
    fs.unlinkSync(path.join(TOOLS_DIR, f));
    deletedCats++;
  }
});
console.log(`✓ Deleted ${deletedCats} non-GoldRush category files`);

// ─── Step 3: Delete non-GoldRush metadata files ───────────────────────────────
const metaFiles = fs.readdirSync(META_DIR).filter(f => f.endsWith(".json"));
let deletedMeta = 0;
let keptMeta    = 0;
metaFiles.forEach(f => {
  const slug = f.replace(".json", "");
  if (!validSlugs.has(slug)) {
    fs.unlinkSync(path.join(META_DIR, f));
    deletedMeta++;
  } else {
    keptMeta++;
  }
});
console.log(`✓ Deleted ${deletedMeta} non-GoldRush metadata files, kept ${keptMeta}`);

// ─── Step 4: Rebuild slug-map.json ───────────────────────────────────────────
const slugMap = {};
toolsJson.tools.forEach(({ category, content }) => {
  content.forEach(({ slug }) => {
    slugMap[slug] = [category];
  });
});
fs.writeFileSync(
  path.join(BASE, "slug-map.json"),
  JSON.stringify(slugMap, null, 2)
);
console.log(`✓ slug-map.json rebuilt — ${Object.keys(slugMap).length} slugs`);

// ─── Step 5: Ensure every tool has a metadata file ───────────────────────────
let missingMeta = 0;
validSlugs.forEach(slug => {
  const fp = path.join(META_DIR, `${slug}.json`);
  if (!fs.existsSync(fp)) {
    console.warn(`  MISSING metadata: ${slug}`);
    missingMeta++;
  }
});
if (missingMeta === 0) {
  console.log(`✓ All ${validSlugs.size} tools have metadata files`);
} else {
  console.warn(`⚠ ${missingMeta} tools are missing metadata files`);
}

console.log("\nDone!");
