import { getColorCategory } from './colorUtils';
import { isReliableVisualAnalysis } from './visualValidation';
import type { Album } from './types';

export interface CuratedVisualCollection {
  id: string;
  label: string;
  eyebrow: string;
  description: string;
  accent: string;
  matches: (album: Album) => boolean;
  score: (album: Album) => number;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function profile(album: Album) {
  return album.visualFeatures.colorProfile;
}

function redAndBlack(album: Album): boolean {
  const categories = (album.dominantPalette || []).map((color) => getColorCategory(color.hex));
  return categories.includes('red') && categories.some((category) => category === 'black' || category === 'monochrome');
}

export const CURATED_VISUAL_COLLECTIONS: CuratedVisualCollection[] = [
  {
    id: 'quiet-minimalism',
    label: 'Quiet Minimalism',
    eyebrow: 'low-noise / high-space',
    description: 'Covers that let one gesture breathe.',
    accent: '#b9c7bd',
    matches: (album) => album.visualFeatures.minimalismScore >= 0.68 && album.visualFeatures.visualEntropy <= 0.46 && album.visualFeatures.textRatio <= 0.14,
    score: (album) => 0.45 * album.visualFeatures.minimalismScore + 0.30 * (1 - album.visualFeatures.visualEntropy) + 0.25 * (1 - Math.min(album.visualFeatures.textRatio * 3, 1)),
  },
  {
    id: 'red-and-black',
    label: 'Red and Black',
    eyebrow: 'signal / shadow',
    description: 'A charged palette with a dark counterweight.',
    accent: '#d85b4f',
    matches: redAndBlack,
    score: (album) => redAndBlack(album) ? clamp((album.visualFeatures.monochromeScore + album.visualFeatures.contrast + album.visualFeatures.saturation) / 3) : 0,
  },
  {
    id: 'dreamlike-portraits',
    label: 'Dreamlike Portraits',
    eyebrow: 'face / haze',
    description: 'Human presence softened into atmosphere.',
    accent: '#d6a8c2',
    matches: (album) => album.visualFeatures.portraitProb >= 0.68 && album.visualFeatures.visualEntropy >= 0.28,
    score: (album) => 0.60 * album.visualFeatures.portraitProb + 0.20 * album.visualFeatures.visualEntropy + 0.20 * album.visualFeatures.photographyProb,
  },
  {
    id: 'hand-drawn-worlds',
    label: 'Hand-Drawn Worlds',
    eyebrow: 'ink / imagination',
    description: 'Illustration-led sleeves with their own gravity.',
    accent: '#d9a75d',
    matches: (album) => album.visualFeatures.illustrationProb >= 0.68 && album.visualFeatures.photographyProb <= 0.58,
    score: (album) => 0.65 * album.visualFeatures.illustrationProb + 0.20 * album.visualFeatures.abstractProb + 0.15 * (1 - album.visualFeatures.photographyProb),
  },
  {
    id: 'brutalist-type',
    label: 'Brutalist Type',
    eyebrow: 'letter / structure',
    description: 'Typography treated as architecture, not caption.',
    accent: '#e1d3b4',
    matches: (album) => album.visualFeatures.textRatio >= 0.24 && album.visualFeatures.contrast >= 0.48 && album.visualFeatures.edgeDensity >= 0.12,
    score: (album) => 0.50 * clamp(album.visualFeatures.textRatio * 2.2) + 0.30 * album.visualFeatures.contrast + 0.20 * album.visualFeatures.edgeDensity,
  },
  {
    id: 'analog-grain',
    label: 'Analog Grain',
    eyebrow: 'film / friction',
    description: 'Texture-forward images with a little weather on them.',
    accent: '#b88c6f',
    matches: (album) => album.visualFeatures.photographyProb >= 0.68 && album.visualFeatures.edgeDensity >= 0.22 && album.visualFeatures.visualEntropy >= 0.42,
    score: (album) => 0.45 * album.visualFeatures.photographyProb + 0.30 * album.visualFeatures.edgeDensity + 0.25 * album.visualFeatures.visualEntropy,
  },
  {
    id: 'soft-pastels',
    label: 'Soft Pastels',
    eyebrow: 'powder / light',
    description: 'Low-contrast color stories with a lifted finish.',
    accent: '#d8b8bf',
    matches: (album) => {
      const color = profile(album);
      return Boolean(color && color.meanLightness >= 0.64 && color.lightnessSpread <= 0.28 && album.visualFeatures.contrast <= 0.58 && album.visualFeatures.saturation >= 0.18);
    },
    score: (album) => {
      const color = profile(album);
      if (!color) return 0;
      return 0.35 * color.meanLightness + 0.30 * (1 - color.lightnessSpread) + 0.20 * (1 - album.visualFeatures.contrast) + 0.15 * album.visualFeatures.saturation;
    },
  },
  {
    id: 'dark-monochrome',
    label: 'Dark Monochrome',
    eyebrow: 'black / quiet voltage',
    description: 'Near-neutrals that make silhouette do the work.',
    accent: '#87929d',
    matches: (album) => {
      const color = profile(album);
      return album.visualFeatures.monochromeScore >= 0.68 && album.visualFeatures.luminance <= 0.36 && Boolean(color && color.neutralCoverage >= 0.56);
    },
    score: (album) => 0.45 * album.visualFeatures.monochromeScore + 0.30 * (1 - album.visualFeatures.luminance) + 0.25 * (profile(album)?.neutralCoverage || 0),
  },
  {
    id: 'maximalist-collage',
    label: 'Maximalist Collage',
    eyebrow: 'layer / overload',
    description: 'Dense visual worlds where every corner has a subplot.',
    accent: '#9d83c8',
    matches: (album) => album.visualFeatures.collageProb >= 0.62 || (album.visualFeatures.visualEntropy >= 0.70 && album.visualFeatures.edgeDensity >= 0.34),
    score: (album) => 0.50 * Math.max(album.visualFeatures.collageProb, album.visualFeatures.visualEntropy) + 0.30 * album.visualFeatures.edgeDensity + 0.20 * album.visualFeatures.saturation,
  },
];

export function getCuratedVisualCollection(value: string | null | undefined): CuratedVisualCollection | null {
  const normalized = String(value || '').trim().toLowerCase();
  return CURATED_VISUAL_COLLECTIONS.find((collection) => collection.id === normalized || collection.label.toLowerCase() === normalized) || null;
}

export function rankCuratedVisualAlbums(albums: Album[], collection: CuratedVisualCollection): Album[] {
  return albums
    .filter(isReliableVisualAnalysis)
    .filter(collection.matches)
    .sort((first, second) => collection.score(second) - collection.score(first) || second.updatedAt?.localeCompare(first.updatedAt || '') || 0);
}
