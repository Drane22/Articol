import React from 'react';
import type { ShareAlbumData } from '@/lib/shareImageData';

interface ShareImageArtworkProps {
  album: ShareAlbumData;
  format: 'landscape' | 'portrait';
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function Palette({ colors, size }: { colors: string[]; size: number }) {
  return (
    <div style={{ display: 'flex', gap: Math.round(size * 0.28) }}>
      {colors.map((color, index) => (
        <div
          key={`${color}-${index}`}
          style={{
            width: size,
            height: size,
            borderRadius: 999,
            background: color,
            border: '1px solid rgba(255,255,255,0.28)',
          }}
        />
      ))}
    </div>
  );
}

function Artwork({ album, size, radius }: { album: ShareAlbumData; size: number; radius: number }) {
  return album.artworkUrl ? (
    <img
      src={album.artworkUrl}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: radius }}
    />
  ) : (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius,
        background: `linear-gradient(145deg, ${album.palette[1]}, #1a1a1c 68%)`,
        color: '#b6afa8',
        fontSize: 28,
        letterSpacing: 3,
        textTransform: 'uppercase',
      }}
    >
      Artwork unavailable
    </div>
  );
}

export function ShareImageArtwork({ album, format }: ShareImageArtworkProps) {
  if (format === 'portrait') {
    return (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', padding: 48,
          background: `linear-gradient(150deg, ${album.palette[0]} 0%, #0d0d0f 44%, #161214 100%)`,
          color: '#f5f1e9', fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex', width: '100%', height: '100%', padding: 10, borderRadius: 48,
            background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.16)',
          }}
        >
          <div
            style={{
              display: 'flex', flexDirection: 'column', width: '100%', height: '100%', padding: 32,
              borderRadius: 38, background: 'rgba(16,16,18,0.93)',
              boxShadow: 'inset 0 1px rgba(255,255,255,0.12)',
            }}
          >
            <Artwork album={album} size={900} radius={26} />
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', padding: '24px 12px 4px' }}>
              <div style={{ display: 'flex', color: '#a39d97', fontSize: 15, letterSpacing: 4, textTransform: 'uppercase' }}>
                articol · visual album discovery
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 15 }}>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, paddingRight: 28 }}>
                  <div style={{ display: 'flex', color: '#f5f1e9', fontFamily: 'serif', fontSize: 52, lineHeight: 1.02, letterSpacing: -1.5 }}>
                    {truncate(album.title, 42)}
                  </div>
                  <div style={{ display: 'flex', marginTop: 8, color: '#c2bbb4', fontSize: 24 }}>
                    {truncate(album.artistName, 36)}
                  </div>
                  <div style={{ display: 'flex', marginTop: 12, color: '#8f8984', fontSize: 16, letterSpacing: 2, textTransform: 'uppercase' }}>
                    {album.country}{album.releaseYear ? ` · ${album.releaseYear}` : ''}
                  </div>
                </div>
                <Palette colors={album.palette} size={28} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%', height: '100%', display: 'flex', padding: 30,
        background: `linear-gradient(140deg, ${album.palette[0]} 0%, #0d0d0e 34%, #151517 100%)`,
        color: '#f5f1e9', fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', width: '100%', height: '100%', padding: 8, borderRadius: 36, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)' }}>
        <div style={{ display: 'flex', width: '100%', height: '100%', padding: 20, borderRadius: 28, background: 'rgba(18,18,20,0.94)' }}>
          <Artwork album={album} size={514} radius={22} />
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', padding: '30px 36px 30px 46px' }}>
            <div style={{ display: 'flex', color: '#9f9993', fontSize: 15, letterSpacing: 3, textTransform: 'uppercase' }}>
              articol · visual album discovery
            </div>
            <div style={{ display: 'flex', marginTop: 22, color: '#f5f1e9', fontFamily: 'serif', fontSize: 51, lineHeight: 1.02, letterSpacing: -1.2, maxWidth: 500 }}>
              {truncate(album.title, 48)}
            </div>
            <div style={{ display: 'flex', marginTop: 12, color: '#c2bbb4', fontSize: 26, maxWidth: 500 }}>
              {truncate(album.artistName, 34)}
            </div>
            <div style={{ display: 'flex', marginTop: 24, color: '#8f8984', fontSize: 17, letterSpacing: 2, textTransform: 'uppercase' }}>
              {album.country}{album.releaseYear ? ` · ${album.releaseYear}` : ''}
            </div>
            <div style={{ display: 'flex', marginTop: 30 }}>
              <Palette colors={album.palette} size={30} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
