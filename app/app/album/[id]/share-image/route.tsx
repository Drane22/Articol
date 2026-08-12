import { ImageResponse } from 'next/og';
import { ShareImageArtwork } from '@/components/ShareImageArtwork';
import { SHARE_IMAGE_SIZES } from '@/lib/share';
import { getShareAlbumData } from '@/lib/shareImageData';
import { normalizeStorefront } from '@/lib/storefronts';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const country = normalizeStorefront(new URL(request.url).searchParams.get('country') || 'PH');
  const album = await getShareAlbumData(id, country);

  return new ImageResponse(
    <ShareImageArtwork album={album} format="portrait" />,
    {
      ...SHARE_IMAGE_SIZES.portrait,
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        'Content-Disposition': 'inline; filename="articol-album-artwork.png"',
      },
    },
  );
}
