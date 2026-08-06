import { Album } from './types';

/**
 * A record is visually usable when it contains a real extracted descriptor.
 * v1 is produced by scripts/index_catalog.py; visual-grid-v2 is produced by
 * the Next.js artwork extractor.
 */
export function isReliableVisualAnalysis(album: Album): boolean {
  const hasIndexedStatus = album.visualAnalysisStatus === 'indexed' || album.visualAnalysisStatus === 'analyzed';
  const supportedVersion = album.embeddingVersion === 'v1' || album.embeddingVersion === 'visual-grid-v2';
  return hasIndexedStatus && supportedVersion && Boolean(album.perceptualHash) && album.embedding?.length === 512;
}
