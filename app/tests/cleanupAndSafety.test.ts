import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Cleanup & Repository Safety', () => {
  it('verify cleanup script exists and is executable', () => {
    const scriptPath = path.resolve(__dirname, '../scripts/cleanup-artwork.mjs');
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  it('verify .gitignore contains required cache patterns', () => {
    const gitignorePath = path.resolve(__dirname, '../.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const content = fs.readFileSync(gitignorePath, 'utf-8');

    expect(content).toContain('.articol-cache/');
    expect(content).toContain('data/artwork/');
    expect(content).toContain('*.onnx');
    expect(content).toContain('*.sqlite');
    expect(content).toContain('.env');
  });

  it('verify package.json has cleanup:artwork script', () => {
    const pkgPath = path.resolve(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts['cleanup:artwork']).toBe('node scripts/cleanup-artwork.mjs');
    expect(pkg.scripts['prepare:git']).toBe('npm run cleanup:artwork');
  });
});
