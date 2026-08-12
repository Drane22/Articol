import { ImageResponse } from 'next/og';
import { ShareImageArtwork } from '@/components/ShareImageArtwork';
import { SHARE_IMAGE_SIZES } from '@/lib/share';
import { getShareAlbumData } from '@/lib/shareImageData';
import { normalizeStorefront } from '@/lib/storefronts';

export const runtime = 'nodejs';
export const alt = 'Articol album artwork share card';
export const size = SHARE_IMAGE_SIZES.landscape;
export const contentType = 'image/png';

export default async function OpenGraphImage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const requestedCountry = typeof query.country === 'string' ? query.country : 'PH';
  const country = normalizeStorefront(requestedCountry);
  const album = await getShareAlbumData(id, country);

  return new ImageResponse(
    <ShareImageArtwork album={album} format="landscape" />,
    { ...size },
  );
}
