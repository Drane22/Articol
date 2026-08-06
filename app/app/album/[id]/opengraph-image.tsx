import { ImageResponse } from 'next/og';
import { normalizeStorefront } from '@/lib/storefronts';

export const runtime = 'edge';
export const alt = 'Articol album artwork share card';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface ItunesItem {
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  releaseDate?: string;
}

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

  let item: ItunesItem = {};
  try {
    const response = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&country=${country}`, {
      next: { revalidate: 300 },
    });
    const data = await response.json();
    item = data.results?.find((result: { wrapperType?: string }) => result.wrapperType === 'collection') || data.results?.[0] || {};
  } catch {
    // Keep the share image useful even if iTunes is temporarily unavailable.
  }

  const artworkUrl = (item.artworkUrl100 || item.artworkUrl60 || '').replace(/\d+x\d+(bb)?\.(jpe?g|png|webp)/i, '600x600bb.$2');
  const releaseYear = item.releaseDate ? new Date(item.releaseDate).getFullYear() : '';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '54px', color: '#f0f0f3', background: '#0d0d0e', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', width: '100%', height: '100%', borderRadius: 28, overflow: 'hidden', background: '#151518', border: '1px solid #34343a' }}>
          {artworkUrl ? (
            <img src={artworkUrl} alt="" style={{ width: 520, height: 520, objectFit: 'cover', alignSelf: 'center', marginLeft: 54, borderRadius: 18 }} />
          ) : (
            <div style={{ width: 520, height: 520, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 54, borderRadius: 18, background: '#222228', color: '#8e8e96', fontSize: 28 }}>Cover unavailable</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '48px 54px' }}>
            <div style={{ display: 'flex', color: '#8e8e96', fontSize: 22, letterSpacing: 4, textTransform: 'uppercase' }}>articol · visual album discovery</div>
            <div style={{ display: 'flex', marginTop: 24, color: '#f0f0f3', fontSize: 58, lineHeight: 1.05, maxWidth: 470 }}>{item.collectionName || 'Album artwork'}</div>
            <div style={{ display: 'flex', marginTop: 14, color: '#b0b0b8', fontSize: 30 }}>{item.artistName || 'Visual album discovery'}</div>
            <div style={{ display: 'flex', marginTop: 44, color: '#8e8e96', fontSize: 22 }}>{country}{releaseYear ? ` · ${releaseYear}` : ''}</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
