import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ToolsConfig, Category, Tool } from '../src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const skillPairsPath = path.join(__dirname, '../src/data/skill-pairs.json');
const skillPairs: Record<string, string[]> = fs.existsSync(skillPairsPath)
    ? JSON.parse(fs.readFileSync(skillPairsPath, 'utf-8'))
    : {};

console.log('🔧 Generating individual tool metadata files...\n');

// Paths
const toolsPath = path.join(__dirname, '../src/data/tools.json');
const metadataPath = path.join(__dirname, '../src/data/metadata.json');
const outputDir = path.join(__dirname, '../src/data/tool-metadata');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created directory: ${outputDir}`);
}

try {
    // Read tools.json
    if (!fs.existsSync(toolsPath)) {
        throw new Error(`tools.json not found at ${toolsPath}`);
    }
    const toolsData: ToolsConfig = JSON.parse(fs.readFileSync(toolsPath, 'utf-8'));

    // Read metadata.json
    let metadataMap: Record<string, any> = {};
    if (fs.existsSync(metadataPath)) {
        metadataMap = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        console.log(`✅ Loaded metadata.json with ${Object.keys(metadataMap).length} entries`);
    } else {
        console.log('⚠️  metadata.json not found, will use tool data only');
    }

    let totalFiles = 0;
    let totalSize = 0;

    // Process each category and tool
    toolsData.tools.forEach((category: Category) => {
        category.content.forEach((tool: Tool) => {
            if (!tool.slug) {
                console.log(`⚠️  Skipping tool without slug: ${tool.title}`);
                return;
            }

            // Get metadata if available
            const meta = metadataMap[tool.slug] || {};

            // Create base metadata object (always current from tools.json)
            const baseMetadata = {
                title: meta.title || tool.title,
                description: meta.description || tool.body,
                category: category.category,
                url: tool.url,
                tag: tool.tag,
                'date-added': tool['date-added'],
                slug: tool.slug
            };

            // Merge with existing file to preserve enrichment fields (snippet, chains, etc.)
            const outputPath = path.join(outputDir, `${tool.slug}.json`);
            let toolMetadata: Record<string, any> = baseMetadata;
            if (fs.existsSync(outputPath)) {
                try {
                    const existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
                    toolMetadata = { ...existing, ...baseMetadata };
                } catch {}
            }

            // Seed buildsWith from skill-pairs co-occurrence (overrides empty/missing only)
            if (tool.slug && (!toolMetadata.buildsWith || toolMetadata.buildsWith.length === 0)) {
                const pairs = skillPairs[tool.slug];
                if (pairs && pairs.length > 0) {
                    toolMetadata.buildsWith = pairs.slice(0, 4);
                }
            }

            const jsonContent = JSON.stringify(toolMetadata, null, 2);
            // Retry write up to 3 times for Windows file-lock transients
            let written = false;
            for (let attempt = 0; attempt < 3 && !written; attempt++) {
                try {
                    fs.writeFileSync(outputPath, jsonContent, 'utf-8');
                    written = true;
                } catch (writeErr: any) {
                    if (attempt < 2) {
                        const waitMs = 50 * (attempt + 1);
                        const end = Date.now() + waitMs;
                        while (Date.now() < end) { /* spin wait */ }
                    } else {
                        throw writeErr;
                    }
                }
            }

            totalFiles++;
            totalSize += jsonContent.length;
        });
    });

    const avgSize = Math.round(totalSize / totalFiles);
    console.log(`\n✨ Successfully generated ${totalFiles} metadata files`);
    console.log(`📊 Total size: ${(totalSize / 1024).toFixed(2)} KB`);
    console.log(`📊 Average size per file: ${avgSize} bytes (~${(avgSize / 1024).toFixed(2)} KB)`);
    console.log(`📁 Output directory: ${outputDir}`);

    // Compare with original metadata.json size
    if (fs.existsSync(metadataPath)) {
        const originalSize = fs.statSync(metadataPath).size;
        const reduction = ((1 - (totalSize / originalSize)) * 100).toFixed(1);
        console.log(`\n💡 Size comparison:`);
        console.log(`   Original metadata.json: ${(originalSize / 1024).toFixed(2)} KB`);
        console.log(`   New individual files: ${(totalSize / 1024).toFixed(2)} KB`);
        console.log(`   Per-page load: ~${(avgSize / 1024).toFixed(2)} KB (${reduction}% reduction)`);
    }

} catch (error: any) {
    console.error('❌ Error generating tool metadata:', error.message);
    process.exit(1);
}
