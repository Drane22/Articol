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
    <div
      style={{
        display: 'flex',
        flexShrink: 0,
        gap: Math.round(size * 0.28),
        alignItems: 'center',
      }}
    >
      {displayColors.map((color, index) => (
        <div
          key={`legend-${color}-${index}`}
          style={{
            display: 'flex',
            flexShrink: 0,
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
  const secondaryColor = colors[1] || '#0d0e12';

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
          backgroundImage: `linear-gradient(165deg, ${primaryColor} 0%, ${secondaryColor} 28%, #0d0e12 60%, #08090c 100%)`,
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
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            padding: 24,
            borderRadius: 32,
            backgroundColor: 'rgba(14, 15, 20, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: '0 24px 56px rgba(0, 0, 0, 0.65)',
            boxSizing: 'border-box',
          }}
        >
          {/* Primary Artwork Canvas Area */}
          <div
            style={{
              display: 'flex',
              flexShrink: 0,
              width: 944,
              height: 944,
              borderRadius: 20,
              overflow: 'hidden',
              backgroundColor: '#07080b',
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
              <ArtworkMedia album={album} colors={colors} size={944} radius={20} />
            )}
          </div>

          {/* Editorial Footer Section (Guaranteed fixed height to prevent out-of-bounds overflow) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: 246,
              padding: '16px 8px 4px',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {/* Header / Style Tag */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: '#9d9790',
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 2.5,
                textTransform: 'uppercase',
              }}
            >
              <span style={{ display: 'flex' }}>{editionSubtitle}</span>
              <span style={{ display: 'flex', color: '#7e7872' }}>articol / visual discovery</span>
            </div>

            {/* Title & Palette Legend Row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                width: '100%',
                gap: 16,
                boxSizing: 'border-box',
              }}
            >
              {/* Left Text Container (flex shrinkable & line-clamped) */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: '1 1 auto',
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    color: '#fbf8f3',
                    fontFamily: 'serif',
                    fontSize: 42,
                    fontWeight: 600,
                    lineHeight: 1.08,
                    letterSpacing: -1,
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    maxWidth: 640,
                  }}
                >
                  {truncate(album.title, 38)}
                </div>
                <div
                  style={{
                    display: 'flex',
                    marginTop: 4,
                    color: '#c8c2ba',
                    fontSize: 22,
                    fontWeight: 450,
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    maxWidth: 640,
                  }}
                >
                  {truncate(album.artistName, 34)}
                </div>
                {album.releaseYear ? (
                  <div
                    style={{
                      display: 'flex',
                      marginTop: 6,
                      color: '#8c857f',
                      fontSize: 14,
                      letterSpacing: 1.8,
                      textTransform: 'uppercase',
                    }}
                  >
                    Released {album.releaseYear}
                  </div>
                ) : null}
              </div>

              {/* Palette Legend Swatches (Locked with flexShrink: 0 so it NEVER goes out of bounds) */}
              <div
                style={{
                  display: 'flex',
                  flexShrink: 0,
                  alignItems: 'center',
                  marginBottom: 2,
                }}
              >
                <PaletteLegend colors={colors} size={28} />
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
        backgroundImage: `linear-gradient(145deg, ${primaryColor} 0%, ${secondaryColor} 30%, #0d0d0f 65%, #08090b 100%)`,
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
          borderRadius: 28,
          backgroundColor: 'rgba(14, 15, 20, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <ArtworkMedia album={album} colors={colors} size={510} radius={18} />

        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '20px 28px 20px 38px',
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              color: '#9d9790',
              fontSize: 13,
              letterSpacing: 2.8,
              textTransform: 'uppercase',
            }}
          >
            articol / visual album discovery
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 16,
              color: '#fbf8f3',
              fontFamily: 'serif',
              fontSize: 44,
              lineHeight: 1.08,
              letterSpacing: -1,
              maxWidth: 520,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {truncate(album.title, 42)}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 8,
              color: '#c2bbb4',
              fontSize: 23,
              maxWidth: 520,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}
          >
            {truncate(album.artistName, 32)}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 16,
              color: '#8f8984',
              fontSize: 15,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {album.country}{album.releaseYear ? ` / ${album.releaseYear}` : ''}
          </div>
          <div style={{ display: 'flex', marginTop: 24, flexShrink: 0 }}>
            <PaletteLegend colors={colors} size={26} />
          </div>
        </div>
      </div>
    </div>
  );
}
