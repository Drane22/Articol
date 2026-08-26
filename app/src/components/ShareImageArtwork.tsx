import React from 'react';
import type { ShareAlbumData } from '@/lib/shareImageData';
import {
  getPaletteArtStyleLabel,
  normalizePaletteArtColors,
  MAX_DISPLAY_ART_COLORS,
  type PaletteArtStyle,
} from '@/lib/paletteArtwork';

interface ShareImageArtworkProps {
  album: ShareAlbumData;
  format: 'landscape' | 'portrait';
  variant?: 'cover' | 'palette';
  paletteStyle?: PaletteArtStyle;
  paletteArtworkUrl?: string;
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function PaletteLegend({ colors, size = 26 }: { colors: string[]; size?: number }) {
  const displayColors = colors.slice(0, MAX_DISPLAY_ART_COLORS);
  return (
    <div style={{ display: 'flex', gap: Math.round(size * 0.32), alignItems: 'center' }}>
      {displayColors.map((color, index) => (
        <div
          key={`legend-${color}-${index}`}
          style={{
            display: 'flex',
            width: size,
            height: size,
            borderRadius: 999,
            backgroundColor: color,
            border: '1.5px solid rgba(255, 255, 255, 0.35)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
          }}
        />
      ))}
    </div>
  );
}

function ArtworkMedia({
  album,
  colors,
  size,
  radius = 24,
}: {
  album: ShareAlbumData;
  colors: string[];
  size: number;
  radius?: number;
}) {
  return album.artworkUrl ? (
    <img
      src={album.artworkUrl}
      alt=""
      width={size}
      height={size}
      style={{
        display: 'flex',
        width: size,
        height: size,
        objectFit: 'cover',
        borderRadius: radius,
      }}
    />
  ) : (
    <div
      style={{
        display: 'flex',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius,
        backgroundImage: `linear-gradient(145deg, ${colors[1] || '#2a2b30'}, #121316 70%)`,
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

export function ShareImageArtwork({
  album,
  format,
  variant = 'cover',
  paletteStyle,
  paletteArtworkUrl,
}: ShareImageArtworkProps) {
  const colors = normalizePaletteArtColors(album.palette);
  const primaryColor = colors[0] || '#1c1e24';

  if (format === 'portrait') {
    const isPaletteArtwork = variant === 'palette' && Boolean(paletteStyle);
    const styleLabel = isPaletteArtwork
      ? getPaletteArtStyleLabel(paletteStyle!)
      : 'Original Cover';
    const editionSubtitle = isPaletteArtwork
      ? `${styleLabel} / palette edition`
      : 'Original cover / portrait edition';

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 1080,
          height: 1350,
          padding: 44,
          backgroundImage: `linear-gradient(160deg, ${primaryColor} 0%, #0d0e12 35%, #15161b 100%)`,
          color: '#f5f1ea',
          fontFamily: 'sans-serif',
          boxSizing: 'border-box',
        }}
      >
        {/* Outer Card Enclosure */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            padding: 24,
            borderRadius: 36,
            backgroundColor: 'rgba(18, 19, 24, 0.94)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.6)',
            boxSizing: 'border-box',
          }}
        >
          {/* Primary Artwork Canvas Area */}
          <div
            style={{
              display: 'flex',
              width: 944,
              height: 944,
              borderRadius: 24,
              overflow: 'hidden',
              backgroundColor: '#090a0d',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxSizing: 'border-box',
            }}
          >
            {isPaletteArtwork && paletteArtworkUrl ? (
              <img
                src={paletteArtworkUrl}
                alt=""
                width="944"
                height="944"
                style={{
                  display: 'flex',
                  width: 944,
                  height: 944,
                  objectFit: 'contain',
                }}
              />
            ) : isPaletteArtwork ? (
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9e9891',
                  fontSize: 24,
                }}
              >
                Generating generative art...
              </div>
            ) : (
              <ArtworkMedia album={album} colors={colors} size={944} radius={22} />
            )}
          </div>

          {/* Editorial Footer Section */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              flex: 1,
              padding: '24px 8px 6px',
            }}
          >
            {/* Header / Style Tag */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#a39d96',
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: 2.8,
                textTransform: 'uppercase',
              }}
            >
              <span style={{ display: 'flex' }}>{editionSubtitle}</span>
              <span style={{ display: 'flex', color: '#827c76' }}>articol / visual discovery</span>
            </div>

            {/* Title & Palette Legend Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 20,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: 0,
                  maxWidth: 640,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    color: '#fbf8f3',
                    fontFamily: 'serif',
                    fontSize: 48,
                    fontWeight: 600,
                    lineHeight: 1.05,
                    letterSpacing: -1.2,
                    textOverflow: 'ellipsis',
                  }}
                >
                  {truncate(album.title, 42)}
                </div>
                <div
                  style={{
                    display: 'flex',
                    marginTop: 6,
                    color: '#c8c2ba',
                    fontSize: 23,
                    fontWeight: 450,
                  }}
                >
                  {truncate(album.artistName, 36)}
                </div>
                {album.releaseYear ? (
                  <div
                    style={{
                      display: 'flex',
                      marginTop: 8,
                      color: '#8c857f',
                      fontSize: 15,
                      letterSpacing: 1.8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Released {album.releaseYear}
                  </div>
                ) : null}
              </div>

              {/* Single Palette Swatch Row (Exactly 5 display swatches) */}
              <div style={{ display: 'flex', marginBottom: 4 }}>
                <PaletteLegend colors={colors} size={30} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Landscape Open Graph Layout (1200×630)
  return (
    <div
      style={{
        display: 'flex',
        width: 1200,
        height: 630,
        padding: 36,
        backgroundImage: `linear-gradient(140deg, ${primaryColor} 0%, #0d0d0f 40%, #151518 100%)`,
        color: '#f5f1ea',
        fontFamily: 'sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          padding: 24,
          borderRadius: 32,
          backgroundColor: 'rgba(18, 19, 24, 0.94)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          boxSizing: 'border-box',
        }}
      >
        <ArtworkMedia album={album} colors={colors} size={510} radius={20} />

        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '24px 32px 24px 44px',
          }}
        >
          <div
            style={{
              display: 'flex',
              color: '#9f9993',
              fontSize: 14,
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}
          >
            articol / visual album discovery
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 18,
              color: '#fbf8f3',
              fontFamily: 'serif',
              fontSize: 48,
              lineHeight: 1.05,
              letterSpacing: -1.2,
              maxWidth: 520,
            }}
          >
            {truncate(album.title, 48)}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 10,
              color: '#c2bbb4',
              fontSize: 24,
              maxWidth: 520,
            }}
          >
            {truncate(album.artistName, 34)}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 20,
              color: '#8f8984',
              fontSize: 16,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {album.country}{album.releaseYear ? ` / ${album.releaseYear}` : ''}
          </div>
          <div style={{ display: 'flex', marginTop: 28 }}>
            <PaletteLegend colors={colors} size={28} />
          </div>
        </div>
      </div>
    </div>
  );
}
