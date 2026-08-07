import { ImageResponse } from 'next/og';
import { getAlbumFromDb } from '@/lib/db';
import { getItunesAlbumById } from '@/lib/itunes';
import { normalizeStorefront } from '@/lib/storefronts';
import type { Album } from '@/lib/types';

export const runtime = 'nodejs';
export const alt = 'Articol album artwork share card';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

interface ShareAlbumData {
  title: string;
  artistName: string;
  artworkUrl: string;
  releaseYear: number | '';
  country: string;
  palette: string[];
}

const FALLBACK_PALETTE = ['#2a2a2e', '#4b4b52', '#77777f', '#a6a6ad', '#dedee2'];

function artworkUrlFor(album?: Album | null): string {
  return (album?.artworkUrl || '').replace(/\d+x\d+(bb)?\.(jpe?g|png|webp)/i, '1000x1000bb.$2');
}

async function getShareAlbumData(id: string, country: string): Promise<ShareAlbumData> {
  const collectionId = Number.parseInt(id, 10);
  let storedAlbum: Album | null = null;
  let liveAlbum: Album | null = null;

  try {
    if (Number.isFinite(collectionId)) storedAlbum = await getAlbumFromDb(collectionId);
  } catch {
    // A share image should still render from live catalog data when storage is unavailable.
  }

  try {
    if (Number.isFinite(collectionId)) {
      const liveResult = await getItunesAlbumById(collectionId, country);
      liveAlbum = liveResult.album;
    }
  } catch {
    // Keep stored album metadata when iTunes is temporarily unavailable.
  }

  const album = liveAlbum || storedAlbum;
  const palette = (storedAlbum?.dominantPalette || album?.dominantPalette || [])
    .slice(0, 5)
    .map((color) => color.hex)
    .filter(Boolean);

  return {
    title: album?.title || 'Album artwork',
    artistName: album?.artistName || 'Visual album discovery',
    artworkUrl: artworkUrlFor(album),
    releaseYear: album?.releaseYear || '',
    country: normalizeStorefront(album?.country || country),
    palette: palette.length > 0 ? palette : FALLBACK_PALETTE,
  };
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
  const album = await getShareAlbumData(id, country);
  const title = album.title.length > 48 ? `${album.title.slice(0, 45)}…` : album.title;
  const artist = album.artistName.length > 34 ? `${album.artistName.slice(0, 31)}…` : album.artistName;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: 32,
          background: '#0d0d0e',
          color: '#f0f0f3',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: '100%',
            height: '100%',
            padding: 22,
            borderRadius: 32,
            overflow: 'hidden',
            background: '#151518',
            border: '1px solid #34343a',
          }}
        >
          {album.artworkUrl ? (
            <img
              src={album.artworkUrl}
              alt=""
              style={{
                width: 520,
                height: 520,
                objectFit: 'cover',
                alignSelf: 'center',
                borderRadius: 22,
              }}
            />
          ) : (
            <div
              style={{
                width: 520,
                height: 520,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'center',
                borderRadius: 22,
                background: '#222228',
                color: '#8e8e96',
                fontSize: 28,
              }}
            >
              Cover unavailable
            </div>
          )}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '40px 40px 40px 48px',
              flex: 1,
            }}
          >
            <div style={{ display: 'flex', color: '#8e8e96', fontSize: 18, letterSpacing: 3, textTransform: 'uppercase' }}>
              articol · visual album discovery
            </div>
            <div style={{ display: 'flex', marginTop: 24, color: '#f0f0f3', fontSize: 54, lineHeight: 1.04, maxWidth: 470 }}>
              {title}
            </div>
            <div style={{ display: 'flex', marginTop: 14, color: '#b0b0b8', fontSize: 28, maxWidth: 470 }}>
              {artist}
            </div>
            <div style={{ display: 'flex', marginTop: 28, color: '#8e8e96', fontSize: 20 }}>
              {album.country}{album.releaseYear ? ` · ${album.releaseYear}` : ''}
            </div>
            <div style={{ display: 'flex', marginTop: 34, gap: 8 }}>
              {album.palette.map((color, index) => (
                <div
                  key={`${color}-${index}`}
                  style={{ width: 30, height: 30, borderRadius: 999, background: color, border: '1px solid rgba(255,255,255,0.26)' }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
