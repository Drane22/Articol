import { describe, it, expect } from 'vitest';
import { hexToRgb, rgbToLab, rgbToHex, ciede2000, calculateColorSimilarity, getColorCategory } from '../src/lib/colorUtils';
import { DominantColor } from '../src/lib/types';

describe('Color Utilities & CIEDE2000', () => {
  it('correctly converts hex to RGB and back', () => {
    const [r, g, b] = hexToRgb('#d02020');
    expect(r).toBe(208);
    expect(g).toBe(32);
    expect(b).toBe(32);
    expect(rgbToHex(r, g, b).toLowerCase()).toBe('#d02020');
  });

  it('converts RGB to CIELAB correctly', () => {
    const [L, a, b] = rgbToLab(255, 255, 255);
    expect(L).toBeCloseTo(100, 0);
    expect(Math.abs(a)).toBeLessThan(1);
    expect(Math.abs(b)).toBeLessThan(1);
  });

  it('calculates CIEDE2000 color difference accurately', () => {
    const labRed1 = rgbToLab(220, 20, 20);
    const labRed2 = rgbToLab(210, 25, 25);
    const labBlue = rgbToLab(20, 20, 220);

    const deltaClose = ciede2000(labRed1, labRed2);
    const deltaFar = ciede2000(labRed1, labBlue);

    expect(deltaClose).toBeLessThan(10);
    expect(deltaFar).toBeGreaterThan(30);
  });

  it('categorizes hex colors into color families', () => {
    expect(getColorCategory('#000000')).toBe('black');
    expect(getColorCategory('#ffffff')).toBe('white');
    expect(getColorCategory('#ff0000')).toBe('red');
    expect(getColorCategory('#0000ff')).toBe('blue');
  });

  it('computes color similarity score between palettes', () => {
    const redPalette: DominantColor[] = [{ hex: '#e02020', lab: rgbToLab(224, 32, 32), weight: 1 }];
    const closeRedPalette: DominantColor[] = [{ hex: '#d52525', lab: rgbToLab(213, 37, 37), weight: 1 }];
    const bluePalette: DominantColor[] = [{ hex: '#1020d0', lab: rgbToLab(16, 32, 208), weight: 1 }];

    const simHigh = calculateColorSimilarity(redPalette, closeRedPalette);
    const simLow = calculateColorSimilarity(redPalette, bluePalette);

    expect(simHigh).toBeGreaterThan(0.7);
    expect(simLow).toBeLessThan(0.45);
  });
});
