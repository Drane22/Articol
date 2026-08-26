import { ImageResponse } from 'next/og';
import { ShareImageArtwork } from '@/components/ShareImageArtwork';
import { SHARE_IMAGE_SIZES } from '@/lib/share';
import { parsePaletteArtStyle } from '@/lib/paletteArtwork';
import { getShareAlbumData } from '@/lib/shareImageData';
import { normalizeStorefront } from '@/lib/storefronts';

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
  const album = await getShareAlbumData(id, country);
  const parsedPaletteStyle = parsePaletteArtStyle(style);
  const isPaletteArtwork = variant === 'palette' && Boolean(parsedPaletteStyle);

  return new ImageResponse(
    <ShareImageArtwork
      album={album}
      format="portrait"
      variant={isPaletteArtwork ? 'palette' : 'cover'}
      paletteStyle={isPaletteArtwork ? parsedPaletteStyle : undefined}
      seed={id}
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
