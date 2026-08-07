export interface DominantColor {
  hex: string;
  lab: [number, number, number]; // [L*, a*, b*]
  weight: number;
}

export type FeatureValue<T = number> = {
  value: T;
  available: boolean;
  confidence?: number;
};

export type HorizontalAlignment = 'left' | 'center' | 'right' | 'mixed' | 'unknown';
export type VerticalPlacement = 'top' | 'middle' | 'bottom' | 'distributed' | 'unknown';

export interface FontCategoryProbabilities {
  serif: number;
  sansSerif: number;
  display: number;
  handwritten: number;
  monospaced: number;
  decorative: number;
  unknown: number;
}

export interface FontWeightProbabilities {
  light: number;
  regular: number;
  medium: number;
  bold: number;
  heavy: number;
  unknown: number;
}

export interface FontWidthProbabilities {
  condensed: number;
  normal: number;
  extended: number;
  unknown: number;
}

export interface TypographyFeatures {
  textPresence?: FeatureValue<boolean>;
  textRatio?: FeatureValue<number>;
  textRegionCount?: FeatureValue<number>;
  textCentroidX?: FeatureValue<number>;
  textCentroidY?: FeatureValue<number>;
  largestTextRegionRatio?: FeatureValue<number>;
  avgTextRegionRatio?: FeatureValue<number>;
  horizontalAlignment?: FeatureValue<HorizontalAlignment>;
  verticalPlacement?: FeatureValue<VerticalPlacement>;
  textOrientation?: FeatureValue<number>;
  uppercaseRatio?: FeatureValue<number>;
  characterDensity?: FeatureValue<number>;
  lineCount?: FeatureValue<number>;
  ocrConfidence?: FeatureValue<number>;
  fontCategory?: FeatureValue<FontCategoryProbabilities>;
  fontWeight?: FeatureValue<FontWeightProbabilities>;
  fontWidth?: FeatureValue<FontWidthProbabilities>;
  typographyConfidence?: number;
}

export interface ComplexityFeatures {
  visualEntropy?: FeatureValue<number>;
  colorEntropy?: FeatureValue<number>;
  edgeDensity?: FeatureValue<number>;
  edgeOrientationEntropy?: FeatureValue<number>;
  localContrast?: FeatureValue<number>;
  globalContrast?: FeatureValue<number>;
  textureEnergy?: FeatureValue<number>;
  grainEstimate?: FeatureValue<number>;
  detailDensity?: FeatureValue<number>;
  regionCount?: FeatureValue<number>;
  foregroundRatio?: FeatureValue<number>;
  negativeSpaceRatio?: FeatureValue<number>;
  complexityConfidence?: number;
}

export interface ColorProfile {
  /** Fraction of decoded pixels that are visually neutral (low chroma). */
  neutralCoverage: number;
  /** Fraction of decoded pixels with a meaningful hue. */
  chromaticCoverage: number;
  /** Circular mean hue of chromatic pixels, in degrees from 0 to <360. */
  dominantHue: number;
  /** 0 for dispersed hues and 1 for one concentrated hue family. */
  hueConcentration: number;
  /** Mean CIE-style perceptual lightness on a 0..1 scale. */
  meanLightness: number;
  /** Standard deviation of perceptual lightness on a 0..1 scale. */
  lightnessSpread: number;
}

export interface VisualFeatures {
  luminance: number; // 0 to 1
  contrast: number; // 0 to 1
  saturation: number; // 0 to 1
  warmCool: number; // -1 (cool blue) to 1 (warm red/yellow)
  monochromeScore: number; // 0 to 1
  edgeDensity: number; // 0 to 1
  visualEntropy: number; // 0 to 1
  symmetryScore: number; // 0 to 1
  centroidX: number; // 0 to 1
  centroidY: number; // 0 to 1
  foregroundRatio: number; // 0 to 1
  textRatio: number; // 0 to 1
  textRegionCount: number;
  portraitProb: number; // 0 to 1
  illustrationProb: number; // 0 to 1
  photographyProb: number; // 0 to 1
  abstractProb: number; // 0 to 1
  collageProb: number; // 0 to 1
  minimalismScore: number; // 0 to 1
  layoutType?: 'centered_subject' | 'off_center' | 'minimal_text' | 'dense_pattern' | 'grid_collage';
  colorProfile?: ColorProfile;
  
  // Extended modular feature blocks
  typography?: TypographyFeatures;
  complexity?: ComplexityFeatures;
}

export interface AlbumTrack {
  trackId: number;
  trackName: string;
  trackNumber: number;
  durationMs: number;
  previewUrl?: string;
}

export type VisualAnalysisStatus = 'pending' | 'processing' | 'indexed' | 'failed' | 'fallback' | 'analyzed';

export interface Album {
  id: string;
  itunesCollectionId: number;
  itunesArtistId?: number;
  musicbrainzReleaseId?: string;
  musicbrainzReleaseGroupId?: string;
  discogsReleaseId?: string;
  upc?: string;
  title: string;
  normalizedTitle: string;
  artistName: string;
  normalizedArtistName: string;
  genre: string;
  styles?: string[];
  label?: string;
  releaseDate: string;
  releaseYear: number;
  country: string;
  trackCount: number;
  explicitness?: string;
  price?: number;
  currency?: string;
  artworkUrl: string;
  artworkSource: string;
  storeUrl?: string;
  dominantPalette: DominantColor[];
  visualFeatures: VisualFeatures;
  perceptualHash?: string;
  embedding?: number[];
  embeddingModel?: string;
  embeddingVersion?: string;
  featureExtractionVersion?: string;
  scoringVersion?: string;
  artworkChecksum?: string;
  visualAnalysisStatus?: VisualAnalysisStatus;
  visualAnalysisError?: string;
  createdAt?: string;
  updatedAt?: string;
  tracks?: AlbumTrack[];
}

export type SearchMode = 'art_style' | 'balanced' | 'music_relation';
export type SearchScope = 'all' | 'title' | 'artist';

export interface MatchReason {
  label: string;
  category: 'color' | 'layout' | 'typography' | 'texture' | 'mood' | 'music';
}

export interface SharedAttribute {
  name: string;
  value: string;
  matchType: 'high' | 'medium' | 'close';
}

export interface ComponentScores {
  embedding: number | null;
  color: number | null;
  layout: number | null;
  typography: number | null;
  complexity: number | null;
  medium?: number | null;
}

export interface SimilarityResult {
  album: Album;
  finalScore: number; // 0 to 1
  finalConfidence: number; // 0 to 1
  visualScore: number | null; // 0 to 1
  visualConfidence: number; // 0 to 1
  musicScore: number | null; // 0 to 1
  musicConfidence: number; // 0 to 1
  componentScores: ComponentScores;
  matchReasons: MatchReason[];
  explanation: string;
  sharedAttributes: SharedAttribute[];
  paletteComparison?: {
    query: string[];
    candidate: string[];
  };
}

export type RecommendationTiers = Record<SearchMode, SimilarityResult[]>;

export interface DiscoverFilter {
  query?: string;
  collection?: string;
  filter?: string;
  color?: string; // Hex code
  decade?: string;
  genre?: string;
  style?: string;
  minimalism?: boolean;
  monochrome?: boolean;
  portrait?: boolean;
}
