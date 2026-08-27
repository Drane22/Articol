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
  return value.length > limit ? `${value.slice(0, limit - 3).trimEnd()}...` : value;
}

function isLightColor(hex: string): boolean {
  if (!hex || typeof hex !== 'string') return false;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return false;
  const fullHex = cleanHex.length === 3 ? cleanHex.split('').map(c => c + c).join('') : cleanHex;
  const num = parseInt(fullHex, 16);
  if (Number.isNaN(num)) return false;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  // Perceptual relative luminance (BT.709)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.42;
}

function PaletteLegend({ colors, size, gap }: { colors: string[]; size: number; gap: number }) {
  return (
    <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap }}>
      {colors.slice(0, MAX_DISPLAY_ART_COLORS).map((color, index) => (
        <div
          key={`legend-${color}-${index}`}
          style={{
            display: 'flex',
            flexShrink: 0,
            width: size,
            height: size,
            borderRadius: 999,
            backgroundColor: color,
            border: '3px solid rgba(255,255,255,0.65)',
            boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
          }}
        />
      ))}
    </div>
  );
}

function CoverArtwork({ album, colors, size, radius }: {
  album: ShareAlbumData;
  colors: string[];
  size: number;
  radius: number;
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
        border: '1.5px solid rgba(255,255,255,0.22)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
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
        border: '1.5px solid rgba(255,255,255,0.16)',
        backgroundImage: `linear-gradient(145deg, ${colors[1] || '#2a2b30'}, #111216 72%)`,
        color: '#d0c8bf',
        fontSize: 30,
        fontWeight: 650,
        letterSpacing: 3.2,
        textTransform: 'uppercase',
      }}
    >
      Artwork unavailable
    </div>
  );
}

function PortraitPoster({
  album,
  colors,
  variant,
  paletteStyle,
  paletteArtworkUrl,
}: {
  album: ShareAlbumData;
  colors: string[];
  variant: 'cover' | 'palette';
  paletteStyle?: PaletteArtStyle;
  paletteArtworkUrl?: string;
}) {
  const primaryColor = colors[0] || '#1c1e24';
  const secondaryColor = colors[1] || '#0d0e12';
  const isLightTop = isLightColor(primaryColor);
  const isPaletteArtwork = variant === 'palette' && Boolean(paletteStyle);
  const edition = isPaletteArtwork
    ? `${getPaletteArtStyleLabel(paletteStyle!)} / palette edition`
    : 'Original cover / archive edition';

  // Adaptive contrast for top header
  const headerBrandColor = isLightTop ? 'rgba(18, 20, 26, 0.95)' : '#ffffff';
  const headerEditionColor = isLightTop ? 'rgba(32, 35, 42, 0.78)' : '#ded8cf';
  const headerBorderColor = isLightTop ? 'rgba(18, 20, 26, 0.22)' : 'rgba(255,255,255,0.16)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 1080,
        height: 1350,
        padding: '36px 58px 40px',
        backgroundImage: `linear-gradient(165deg, ${primaryColor} 0%, ${secondaryColor} 26%, #0d0e12 58%, #07080b 100%)`,
        color: '#f6f2eb',
        fontFamily: 'sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          flexShrink: 0,
          width: '100%',
          height: 68,
          position: 'relative',
          alignItems: 'center',
          borderBottom: `1.5px solid ${headerBorderColor}`,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2.2,
          textTransform: 'uppercase',
        }}
      >
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 0,
            top: 0,
            height: 68,
            alignItems: 'center',
            color: headerBrandColor,
            fontWeight: 800,
          }}
        >
          articol / visual discovery
        </div>
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            right: 0,
            top: 0,
            height: 68,
            alignItems: 'center',
            justifyContent: 'flex-end',
            color: headerEditionColor,
            textAlign: 'right',
            fontWeight: 650,
          }}
        >
          {edition}
        </div>
      </div>

      {/* Main Artwork Frame */}
      <div
        style={{
          display: 'flex',
          flexShrink: 0,
          width: '100%',
          height: 840,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isPaletteArtwork && paletteArtworkUrl ? (
          <img
            src={paletteArtworkUrl}
            alt=""
            width="820"
            height="820"
            style={{ display: 'flex', width: 820, height: 820, objectFit: 'contain' }}
          />
        ) : isPaletteArtwork ? (
          <div
            style={{
              display: 'flex',
              width: 820,
              height: 820,
              alignItems: 'center',
              justifyContent: 'center',
              color: '#b8b0a7',
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: 1.2,
            }}
          >
            Generating artwork...
          </div>
        ) : (
          <CoverArtwork album={album} colors={colors} size={820} radius={18} />
        )}
      </div>

      {/* Bottom Metadata Section */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderTop: '1.5px solid rgba(255,255,255,0.16)',
          paddingTop: 28,
          paddingBottom: 4,
        }}
      >
        {/* Title & Artist */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              maxWidth: 960,
              maxHeight: 140,
              overflow: 'hidden',
              color: '#ffffff',
              fontFamily: 'sans-serif',
              fontSize: 62,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -1.4,
            }}
          >
            {truncate(album.title, 66)}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 10,
              maxWidth: 920,
              overflow: 'hidden',
              color: '#f0ebe4',
              fontSize: 38,
              fontWeight: 600,
              lineHeight: 1.25,
              paddingBottom: 4,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {truncate(album.artistName, 42)}
          </div>
        </div>

        {/* Footer: Release Year & Palette Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              color: '#d6cec4',
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 2.4,
              textTransform: 'uppercase',
            }}
          >
            {album.releaseYear ? `Released ${album.releaseYear}` : 'Archive edition'}
          </div>
          <PaletteLegend colors={colors} size={48} gap={14} />
        </div>
      </div>
    </div>
  );
}

function LandscapePoster({ album, colors }: { album: ShareAlbumData; colors: string[] }) {
  const primaryColor = colors[0] || '#1c1e24';
  const secondaryColor = colors[1] || '#0d0e12';
  const isLightTop = isLightColor(primaryColor);

  const headerBrandColor = isLightTop ? 'rgba(18, 20, 26, 0.95)' : '#ffffff';

  return (
    <div
      style={{
        display: 'flex',
        width: 1200,
        height: 630,
        padding: '38px 44px',
        backgroundImage: `linear-gradient(145deg, ${primaryColor} 0%, ${secondaryColor} 30%, #0d0e12 67%, #07080b 100%)`,
        color: '#f6f2eb',
        fontFamily: 'sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <CoverArtwork album={album} colors={colors} size={510} radius={18} />
      <div
        style={{
          display: 'flex',
          flex: 1,
          minWidth: 0,
          flexDirection: 'column',
          justifyContent: 'space-between',
          marginLeft: 48,
          paddingLeft: 42,
          paddingTop: 4,
          paddingBottom: 4,
          borderLeft: '1.5px solid rgba(255,255,255,0.16)',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              color: headerBrandColor,
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: 2.4,
              textTransform: 'uppercase',
            }}
          >
            articol / visual discovery
          </div>
          <div
            style={{
              display: 'flex',
              maxWidth: 520,
              maxHeight: 124,
              marginTop: 22,
              overflow: 'hidden',
              color: '#ffffff',
              fontFamily: 'sans-serif',
              fontSize: 54,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: -1.2,
            }}
          >
            {truncate(album.title, 54)}
          </div>
          <div
            style={{
              display: 'flex',
              maxWidth: 520,
              marginTop: 10,
              overflow: 'hidden',
              color: '#f0ebe4',
              fontSize: 32,
              fontWeight: 600,
              lineHeight: 1.25,
              paddingBottom: 4,
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {truncate(album.artistName, 34)}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              color: '#d6cec4',
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 2.2,
              textTransform: 'uppercase',
            }}
          >
            {album.country ? `${album.country} / ` : ''}{album.releaseYear ? `Released ${album.releaseYear}` : 'Archive'}
          </div>
          <PaletteLegend colors={colors} size={42} gap={12} />
        </div>
      </div>
    </div>
  );
}

export function ShareImageArtwork({ album, format, variant = 'cover', paletteStyle, paletteArtworkUrl }: ShareImageArtworkProps) {
  const colors = normalizePaletteArtColors(album.palette);
  if (format === 'portrait') {
    return <PortraitPoster album={album} colors={colors} variant={variant} paletteStyle={paletteStyle} paletteArtworkUrl={paletteArtworkUrl} />;
  }
  return <LandscapePoster album={album} colors={colors} />;
}
