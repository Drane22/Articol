import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const DIRS_TO_CLEAN = [
  '.articol-cache',
  'tmp',
  'temp',
  'downloads',
  'downloaded-images',
  'data/artwork',
  'data/covers',
  'public/album-art',
  'public/covers',
  'scripts/tmp',
  'scripts/cache',
];

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

let cleanedCount = 0;
let dirCount = 0;

console.log('🧹 [Articol] Starting artwork and temporary cache cleanup...');

for (const relDir of DIRS_TO_CLEAN) {
  const fullPath = path.join(projectRoot, relDir);
  if (fs.existsSync(fullPath)) {
    try {
      const stats = fs.statSync(fullPath);
      if (stats.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`  ✓ Removed directory: ${relDir}`);
        dirCount++;
      }
    } catch (err) {
      console.error(`  ✕ Error cleaning ${relDir}:`, err.message);
    }
  }
}

// Clean any standalone generated image files inside data/ folder if it exists
const dataDir = path.join(projectRoot, 'data');
if (fs.existsSync(dataDir)) {
  function cleanImagesRecursively(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        cleanImagesRecursively(entryPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTENSIONS.has(ext)) {
          try {
            fs.unlinkSync(entryPath);
            cleanedCount++;
          } catch (e) {
            console.error(`  ✕ Could not remove file ${entryPath}:`, e.message);
          }
        }
      }
    }
  }
  try {
    cleanImagesRecursively(dataDir);
  } catch (e) {
    // ignore missing or permission error gracefully
  }
}

console.log(`✨ [Articol] Cleanup finished. Removed ${dirCount} directories and ${cleanedCount} temporary image files.`);
process.exit(0);
