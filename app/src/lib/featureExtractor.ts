import { ColorProfile, DominantColor, VisualFeatures } from './types';
import { hexToRgb, rgbToHex, rgbToLab } from './colorUtils';
import { MAX_PALETTE_COLORS } from './palette';

// ─────────────────────────────────────────────────────────────
// Seeded PRNG (Mulberry32) — produces repeatable per-album values
// ─────────────────────────────────────────────────────────────
function createRng(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  // Ensure non-zero start
  if (h === 0) h = 123456789;
  return () => {
    h |= 0;
    h = h + 0x6D2B79F5 | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────
// HSL → RGB helper
// ─────────────────────────────────────────────────────────────
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const hNorm = h / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, hNorm + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, hNorm) * 255),
    Math.round(hue2rgb(p, q, hNorm - 1 / 3) * 255),
  ];
}

// ─────────────────────────────────────────────────────────────
// Generate UNIQUE dominant palette from a seed string
// ─────────────────────────────────────────────────────────────
function generateSeedPalette(seed: string): DominantColor[] {
  const rng = createRng('palette-' + seed);
  // Base hue that varies per album
  const baseHue = rng() * 360;
  // Palette harmony: analogous vs complementary vs triadic
  const harmonyType = rng();
  const colors: DominantColor[] = [];

  for (let i = 0; i < 5; i++) {
    let hueShift: number;
    if (harmonyType < 0.35) {
      // Analogous: hues spread within ~60°
      hueShift = (i - 2) * (15 + rng() * 15);
    } else if (harmonyType < 0.65) {
      // Complementary: alternating sides
      hueShift = i % 2 === 0 ? rng() * 30 : 150 + rng() * 60;
    } else {
      // Triadic / spread
      hueShift = i * (72 + rng() * 30);
    }

    const hue = (baseHue + hueShift + 360) % 360;
    const sat = 0.12 + rng() * 0.75;
    const lum = 0.08 + rng() * 0.78;

    const [r, g, b] = hslToRgb(hue, sat, lum);
    const hex = rgbToHex(r, g, b);
    const lab = rgbToLab(r, g, b);
    const weight = [0.35, 0.25, 0.18, 0.13, 0.09][i];

    colors.push({ hex, lab, weight });
  }

  return colors;
}

// ─────────────────────────────────────────────────────────────
// Generate UNIQUE visual features from a seed string
// ─────────────────────────────────────────────────────────────
const r2 = (v: number) => Math.round(v * 100) / 100;

function rgbHueDegrees(r: number, g: number, b: number): number {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  if (delta === 0) return 0;

  let hue = max === rNorm
    ? ((gNorm - bNorm) / delta) % 6
    : max === gNorm
      ? (bNorm - rNorm) / delta + 2
      : (rNorm - gNorm) / delta + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

function generateSeedFeatures(seed: string): VisualFeatures {
  const rng = createRng('features-' + seed);

  const luminance = 0.12 + rng() * 0.72;
  const contrast = 0.15 + rng() * 0.75;
  const saturation = 0.05 + rng() * 0.85;
  const warmCool = (rng() - 0.5) * 2; // -1 … 1
  const monochromeScore = rng() * 0.85;
  const edgeDensity = 0.08 + rng() * 0.72;
  const visualEntropy = 0.08 + rng() * 0.82;
  const symmetryScore = 0.25 + rng() * 0.65;
  const centroidX = 0.2 + rng() * 0.6;
  const centroidY = 0.15 + rng() * 0.7;
  const foregroundRatio = 0.15 + rng() * 0.7;
  const textRatio = rng() * 0.42;
  const textRegionCount = Math.floor(rng() * 6);

  // Style probabilities – sum doesn't need to be 1; they are independent
  const portraitProb = rng();
  const illustrationProb = rng();
  const photographyProb = rng();
  const abstractProb = rng();
  const collageProb = rng();
  const minimalismScore = rng();

  return {
    luminance: r2(luminance),
    contrast: r2(contrast),
    saturation: r2(saturation),
    warmCool: r2(warmCool),
    monochromeScore: r2(monochromeScore),
    edgeDensity: r2(edgeDensity),
    visualEntropy: r2(visualEntropy),
    symmetryScore: r2(symmetryScore),
    centroidX: r2(centroidX),
    centroidY: r2(centroidY),
    foregroundRatio: r2(foregroundRatio),
    textRatio: r2(textRatio),
    textRegionCount,
    portraitProb: r2(portraitProb),
    illustrationProb: r2(illustrationProb),
    photographyProb: r2(photographyProb),
    abstractProb: r2(abstractProb),
    collageProb: r2(collageProb),
    minimalismScore: r2(minimalismScore),
  };
}

// ─────────────────────────────────────────────────────────────
// Deterministic 512-d CLIP-style embedding from seed
// ─────────────────────────────────────────────────────────────
export function generateDeterministicEmbedding(seedStr: string): number[] {
  const rng = createRng('emb-' + seedStr);
  const vector: number[] = [];

  for (let i = 0; i < 512; i++) {
    vector.push(rng() * 2 - 1); // -1 … 1
  }

  // L2-normalise
  const norm = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  return vector.map(v => (norm > 0 ? v / norm : 0));
}

/**
 * Builds a 512-dimensional descriptor using artwork measurements only.
 * Metadata is deliberately absent so changing an album ID/title/artist cannot
 * change visual similarity.
 */
export function buildVisualDescriptor(
  palette: DominantColor[],
  features: VisualFeatures,
  spatialColorGrid: number[] = [],
): number[] {
  const vector: number[] = spatialColorGrid.map(value => Math.max(-1, Math.min(1, value)));

  for (const color of palette.slice(0, 5)) {
    const [r, g, b] = hexToRgb(color.hex);
    vector.push(
      r / 127.5 - 1,
      g / 127.5 - 1,
      b / 127.5 - 1,
      color.lab[0] / 50 - 1,
      color.lab[1] / 128,
      color.lab[2] / 128,
      (color.weight || 0.2) * 2 - 1,
    );
  }

  vector.push(
    features.luminance * 2 - 1,
    features.contrast * 2 - 1,
    features.saturation * 2 - 1,
    features.warmCool,
    features.monochromeScore * 2 - 1,
    features.edgeDensity * 2 - 1,
    features.visualEntropy * 2 - 1,
    features.symmetryScore * 2 - 1,
    features.centroidX * 2 - 1,
    features.centroidY * 2 - 1,
    features.foregroundRatio * 2 - 1,
    features.textRatio * 2 - 1,
    Math.min(1, features.textRegionCount / 5) * 2 - 1,
    features.portraitProb * 2 - 1,
    features.illustrationProb * 2 - 1,
    features.photographyProb * 2 - 1,
    features.abstractProb * 2 - 1,
    features.collageProb * 2 - 1,
    features.minimalismScore * 2 - 1,
  );

  const source = vector.length ? [...vector] : [0];
  while (vector.length < 512) vector.push(source[vector.length % source.length]);
  vector.length = 512;
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map(value => norm > 0 ? value / norm : 0);
}

function createSpatialColorGrid(data: Buffer, width: number, height: number, channels: number): number[] {
  const grid: number[] = [];
  for (let cellY = 0; cellY < 8; cellY++) {
    for (let cellX = 0; cellX < 8; cellX++) {
      const startX = Math.floor(cellX * width / 8);
      const endX = Math.max(startX + 1, Math.floor((cellX + 1) * width / 8));
      const startY = Math.floor(cellY * height / 8);
      const endY = Math.max(startY + 1, Math.floor((cellY + 1) * height / 8));
      let red = 0; let green = 0; let blue = 0; let count = 0;
      for (let y = startY; y < Math.min(endY, height); y++) {
        for (let x = startX; x < Math.min(endX, width); x++) {
          const index = (y * width + x) * channels;
          red += data[index]; green += data[index + 1]; blue += data[index + 2]; count++;
        }
      }
      grid.push(red / count / 127.5 - 1, green / count / 127.5 - 1, blue / count / 127.5 - 1);
    }
  }
  return grid;
}

// ─────────────────────────────────────────────────────────────
// Sharp-based real image analysis (server-side only)
// ─────────────────────────────────────────────────────────────
function createPerceptualHash(data: Buffer, width: number, height: number, channels: number): string {
  const cells: number[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const sampleX = Math.min(width - 1, Math.floor(((x + 0.5) / 8) * width));
      const sampleY = Math.min(height - 1, Math.floor(((y + 0.5) / 8) * height));
      const index = (sampleY * width + sampleX) * channels;
      cells.push(0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]);
    }
  }
  const average = cells.reduce((sum, value) => sum + value, 0) / cells.length;
  return cells.map(value => value >= average ? '1' : '0').join('');
}

async function extractFromBuffer(
  imageBuffer: Buffer,
  fallbackSeed: string,
): Promise<{ palette: DominantColor[]; features: VisualFeatures; embedding: number[]; perceptualHash: string } | null> {
  let sharp: any;
  try {
    const sharpModule = await import('sharp');
    sharp = sharpModule.default || sharpModule;
  } catch {
    return null;
  }

  try {
    const resized = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { data, info } = resized;
    const pixelCount = info.width * info.height;
    const channels = info.channels; // should be 3 after removeAlpha

    let totalL = 0;
    let totalLightnessSq = 0;
    let minL = 255;
    let maxL = 0;
    let warmSum = 0;
    let satSum = 0;
    let monoCount = 0;
    let neutralPixelCount = 0;
    let chromaticPixelCount = 0;
    let hueVectorX = 0;
    let hueVectorY = 0;
    let hueWeight = 0;
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;

    const colorBuckets: Record<string, { r: number; g: number; b: number; count: number }> = {};

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalR += r;
      totalG += g;
      totalB += b;

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      totalL += lum;
      totalLightnessSq += (lum / 255) ** 2;
      if (lum < minL) minL = lum;
      if (lum > maxL) maxL = lum;

      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
      satSum += sat;
      warmSum += (r - b) / 255;

      if (sat < 0.12) {
        neutralPixelCount++;
      } else {
        chromaticPixelCount++;
        const hueRadians = rgbHueDegrees(r, g, b) * (Math.PI / 180);
        hueVectorX += Math.cos(hueRadians) * sat;
        hueVectorY += Math.sin(hueRadians) * sat;
        hueWeight += sat;
      }

      if (Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b)) < 18) {
        monoCount++;
      }

      // 32-step quantisation → 8 × 8 × 8 = 512 buckets
      const qR = Math.floor(r / 32) * 32;
      const qG = Math.floor(g / 32) * 32;
      const qB = Math.floor(b / 32) * 32;
      const key = `${qR},${qG},${qB}`;
      if (!colorBuckets[key]) colorBuckets[key] = { r: qR, g: qG, b: qB, count: 0 };
      colorBuckets[key].count++;
    }

    const avgLuminance = totalL / (pixelCount * 255);
    const contrast = (maxL - minL) / 255;
    const saturation = satSum / pixelCount;
    const warmCool = Math.max(-1, Math.min(1, warmSum / pixelCount));
    const monochromeScore = monoCount / pixelCount;
    const meanLightness = totalL / (pixelCount * 255);
    const lightnessVariance = Math.max(0, totalLightnessSq / pixelCount - meanLightness ** 2);
    const hueMagnitude = Math.sqrt(hueVectorX ** 2 + hueVectorY ** 2);
    const colorProfile: ColorProfile = {
      neutralCoverage: r2(neutralPixelCount / pixelCount),
      chromaticCoverage: r2(chromaticPixelCount / pixelCount),
      dominantHue: hueWeight > 0
        ? Math.round(((Math.atan2(hueVectorY, hueVectorX) * 180 / Math.PI + 360) % 360) * 10) / 10
        : 0,
      hueConcentration: hueWeight > 0 ? r2(hueMagnitude / hueWeight) : 0,
      meanLightness: r2(meanLightness),
      lightnessSpread: r2(Math.sqrt(lightnessVariance)),
    };

    // Preserve up to ten meaningful buckets for richer palette inspection.
    // The descriptor above intentionally keeps its established top-five input
    // so its dimensions and embedding version remain compatible.
    const sortedBuckets = Object.values(colorBuckets)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_PALETTE_COLORS);

    const palette: DominantColor[] = sortedBuckets.map(c => ({
      hex: rgbToHex(c.r, c.g, c.b),
      lab: rgbToLab(c.r, c.g, c.b),
      weight: c.count / pixelCount,
    }));

    // Edge density (Sobel-lite)
    let edgeSum = 0;
    const w = info.width;
    for (let y = 0; y < info.height - 1; y++) {
      for (let x = 0; x < w - 1; x++) {
        const idx = (y * w + x) * channels;
        const diffX = Math.abs(data[idx] - data[(y * w + (x + 1)) * channels]);
        const diffY = Math.abs(data[idx] - data[((y + 1) * w + x) * channels]);
        edgeSum += (diffX + diffY) / 2;
      }
    }
    const edgeDensity = Math.min(1.0, edgeSum / (pixelCount * 100));

    // Left-right symmetry — compare columns
    let symmDiff = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < Math.floor(w / 2); x++) {
        const idxL = (y * w + x) * channels;
        const idxR = (y * w + (w - 1 - x)) * channels;
        symmDiff += Math.abs(data[idxL] - data[idxR]);
      }
    }
    const symmetryScore = Math.max(0, 1 - symmDiff / (pixelCount * 128));

    // Centroid of luminance mass
    let cxSum = 0;
    let cySum = 0;
    let lumTotal = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * channels;
        const l = data[idx] * 0.33 + data[idx + 1] * 0.33 + data[idx + 2] * 0.33;
        cxSum += x * l;
        cySum += y * l;
        lumTotal += l;
      }
    }
    const centroidX = lumTotal > 0 ? (cxSum / lumTotal) / w : 0.5;
    const centroidY = lumTotal > 0 ? (cySum / lumTotal) / info.height : 0.5;

    const visualEntropy = Math.min(1.0, edgeDensity * 1.1 + saturation * 0.35 + (1 - monochromeScore) * 0.15);
    const minimalismScore = Math.max(0.0, 1.0 - (edgeDensity * 0.55 + (1 - monochromeScore) * 0.3 + saturation * 0.15));
    const textRatio = edgeDensity > 0.35 && monochromeScore > 0.25 ? 0.28 : edgeDensity > 0.25 ? 0.12 : 0.05;
    const foregroundRatio = 1 - minimalismScore * 0.6;

    const features: VisualFeatures = {
      luminance: r2(avgLuminance),
      contrast: r2(contrast),
      saturation: r2(saturation),
      warmCool: r2(warmCool),
      monochromeScore: r2(monochromeScore),
      edgeDensity: r2(edgeDensity),
      visualEntropy: r2(visualEntropy),
      symmetryScore: r2(symmetryScore),
      centroidX: r2(centroidX),
      centroidY: r2(centroidY),
      foregroundRatio: r2(foregroundRatio),
      textRatio: r2(textRatio),
      textRegionCount: textRatio > 0.2 ? 3 : textRatio > 0.1 ? 2 : 1,
      portraitProb: r2(Math.max(0, (1 - edgeDensity) * 0.75 * (symmetryScore > 0.45 ? 1.2 : 0.7))),
      illustrationProb: r2(Math.min(1, saturation * (1 - monochromeScore) * 1.3)),
      photographyProb: r2(Math.min(1, (1 - monochromeScore * 0.5) * 0.85)),
      abstractProb: r2(Math.min(1, visualEntropy * 0.85)),
      collageProb: r2(Math.min(1, edgeDensity * (1 - symmetryScore) * 1.8)),
      minimalismScore: r2(minimalismScore),
      colorProfile,
    };

    const embedding = buildVisualDescriptor(
      palette,
      features,
      createSpatialColorGrid(data, info.width, info.height, channels),
    );

    return { palette, features, embedding, perceptualHash: createPerceptualHash(data, info.width, info.height, channels) };
  } catch (err) {
    console.warn('Sharp extraction failed, falling back to seed:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Main public API — from buffer or seed fallback
// ─────────────────────────────────────────────────────────────
export async function extractVisualFeaturesFromImage(
  imageBuffer?: Buffer | null,
  fallbackSeed: string = 'album',
): Promise<{ palette: DominantColor[]; features: VisualFeatures; embedding: number[]; perceptualHash?: string }> {
  if (imageBuffer && imageBuffer.length > 100) {
    const result = await extractFromBuffer(imageBuffer, fallbackSeed);
    if (result) return result;
  }

  // Seed-deterministic (but unique-per-album) fallback
  const palette = generateSeedPalette(fallbackSeed);
  const features = generateSeedFeatures(fallbackSeed);
  const embedding = generateDeterministicEmbedding(
    fallbackSeed + palette.map(p => p.hex).join('')
  );

  return { palette, features, embedding };
}

// ─────────────────────────────────────────────────────────────
// Download artwork from URL → extract real features
// ─────────────────────────────────────────────────────────────
export async function extractFeaturesFromUrl(
  artworkUrl: string,
  fallbackSeed: string,
): Promise<{ palette: DominantColor[]; features: VisualFeatures; embedding: number[]; perceptualHash?: string; analyzed: boolean; resolvedArtworkUrl?: string }> {
  if (!artworkUrl) {
    const fallback = await extractVisualFeaturesFromImage(null, fallbackSeed);
    return { ...fallback, analyzed: false };
  }

  const candidates = Array.from(new Set([
    artworkUrl,
    artworkUrl.replace(/\d+x\d+(bb)?\.(jpe?g|png|webp)/i, '300x300bb.$2'),
    artworkUrl.replace(/\d+x\d+(bb)?\.(jpe?g|png|webp)/i, '100x100bb.$2'),
  ]));

  let lastError: unknown;
  for (const candidateUrl of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    try {
      const res = await fetch(candidateUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Articol-FeatureExtractor/1.0)',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        signal: controller.signal,
        // Artwork is analyzed in memory and must not enter Next's persistent
        // data cache. The database stores only the extracted descriptors.
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) throw new Error(`Unexpected content type: ${contentType || 'unknown'}`);

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 500) throw new Error('Image too small');

      const extracted = await extractVisualFeaturesFromImage(buffer, fallbackSeed);
      return {
        ...extracted,
        analyzed: Boolean(extracted.perceptualHash),
        resolvedArtworkUrl: candidateUrl,
      };
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  console.warn(`Artwork download failed for ${fallbackSeed}:`, lastError);
  const fallback = await extractVisualFeaturesFromImage(null, fallbackSeed);
  return { ...fallback, analyzed: false };
}
