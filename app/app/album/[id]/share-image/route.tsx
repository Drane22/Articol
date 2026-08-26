import React from 'react';
import { ImageResponse } from 'next/og';
import { ShareImageArtwork } from '@/components/ShareImageArtwork';
import { SHARE_IMAGE_SIZES } from '@/lib/share';
import { parsePaletteArtStyle } from '@/lib/paletteArtwork';
import { getShareAlbumData, getSuppliedPaletteShareAlbumData } from '@/lib/shareImageData';
import { normalizeStorefront } from '@/lib/storefronts';
import { renderPaletteArtworkDataUrl } from '@/lib/renderPaletteArt';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const searchParams = new URL(request.url).searchParams;
  const country = normalizeStorefront(searchParams.get('country') || 'PH');
  const variant = searchParams.get('variant');
  const style = searchParams.get('style');
  const parsedPaletteStyle = parsePaletteArtStyle(style);
  const isPaletteArtwork = variant === 'palette' && Boolean(parsedPaletteStyle);
  const suppliedAlbum = isPaletteArtwork
    ? getSuppliedPaletteShareAlbumData(searchParams, country)
    : null;
  const album = suppliedAlbum || await getShareAlbumData(id, country);
  const paletteArtworkUrl = isPaletteArtwork
    ? await renderPaletteArtworkDataUrl({
      colors: album.palette,
      artStyle: parsedPaletteStyle!,
      seed: id,
      visualFeatures: album.visualFeatures,
    })
    : undefined;

  return new ImageResponse(
    <ShareImageArtwork
      album={album}
      format="portrait"
      variant={isPaletteArtwork ? 'palette' : 'cover'}
      paletteStyle={isPaletteArtwork ? parsedPaletteStyle : undefined}
      paletteArtworkUrl={paletteArtworkUrl}
    />,
    {
      ...SHARE_IMAGE_SIZES.portrait,
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        'Content-Disposition': 'inline; filename="articol-album-artwork.png"',
      },
    },
  );
}
