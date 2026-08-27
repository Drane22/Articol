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
            border: '2.5px solid rgba(255,255,255,0.56)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.46)',
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
        border: '1px solid rgba(255,255,255,0.18)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.62)',
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
        border: '1px solid rgba(255,255,255,0.16)',
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
  const isPaletteArtwork = variant === 'palette' && Boolean(paletteStyle);
  const edition = isPaletteArtwork
    ? `${getPaletteArtStyleLabel(paletteStyle!)} / palette edition`
    : 'Original cover / archive edition';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 1080,
        height: 1350,
        padding: '38px 58px 42px',
        backgroundImage: `linear-gradient(165deg, ${primaryColor} 0%, ${secondaryColor} 25%, #0d0e12 60%, #07080b 100%)`,
        color: '#f6f2eb',
        fontFamily: 'sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexShrink: 0,
          width: '100%',
          height: 70,
          position: 'relative',
          alignItems: 'center',
          borderBottom: '1.5px solid rgba(255,255,255,0.14)',
          color: '#ded8cf',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2.2,
          textTransform: 'uppercase',
        }}
      >
        <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, height: 70, alignItems: 'center' }}>articol / visual discovery</div>
        <div style={{ display: 'flex', position: 'absolute', right: 0, top: 0, height: 70, alignItems: 'center', justifyContent: 'flex-end', color: '#b8b0a7', textAlign: 'right' }}>{edition}</div>
      </div>

      <div
        style={{
          display: 'flex',
          flexShrink: 0,
          width: '100%',
          height: 900,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isPaletteArtwork && paletteArtworkUrl ? (
          <img
            src={paletteArtworkUrl}
            alt=""
            width="860"
            height="860"
            style={{ display: 'flex', width: 860, height: 860, objectFit: 'contain' }}
          />
        ) : isPaletteArtwork ? (
          <div
            style={{
              display: 'flex',
              width: 860,
              height: 860,
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
          <CoverArtwork album={album} colors={colors} size={860} radius={16} />
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          flexDirection: 'column',
          justifyContent: 'flex-start',
          borderTop: '1.5px solid rgba(255,255,255,0.14)',
          paddingTop: 26,
        }}
      >
        <div
          style={{
            display: 'flex',
            maxWidth: 900,
            maxHeight: 124,
            overflow: 'hidden',
            color: '#ffffff',
            fontFamily: 'sans-serif',
            fontSize: 58,
            fontWeight: 650,
            lineHeight: 1.04,
            letterSpacing: -1.2,
          }}
        >
          {truncate(album.title, 66)}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 8,
            maxWidth: 830,
            overflow: 'hidden',
            color: '#f0ebe4',
            fontSize: 34,
            fontWeight: 600,
            lineHeight: 1.1,
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {truncate(album.artistName, 42)}
        </div>
        <div
          style={{
            display: 'flex',
            flex: 1,
            minHeight: 0,
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingBottom: 2,
          }}
        >
          <div
            style={{
              display: 'flex',
              color: '#b8b0a7',
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            {album.releaseYear ? `Released ${album.releaseYear}` : 'Archive edition'}
          </div>
          <PaletteLegend colors={colors} size={44} gap={12} />
        </div>
      </div>
    </div>
  );
}

function LandscapePoster({ album, colors }: { album: ShareAlbumData; colors: string[] }) {
  const primaryColor = colors[0] || '#1c1e24';
  const secondaryColor = colors[1] || '#0d0e12';
  return (
    <div
      style={{
        display: 'flex',
        width: 1200,
        height: 630,
        padding: 44,
        backgroundImage: `linear-gradient(145deg, ${primaryColor} 0%, ${secondaryColor} 30%, #0d0e12 67%, #07080b 100%)`,
        color: '#f6f2eb',
        fontFamily: 'sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <CoverArtwork album={album} colors={colors} size={510} radius={16} />
      <div
        style={{
          display: 'flex',
          flex: 1,
          minWidth: 0,
          flexDirection: 'column',
          justifyContent: 'center',
          marginLeft: 48,
          paddingLeft: 42,
          borderLeft: '1.5px solid rgba(255,255,255,0.14)',
        }}
      >
        <div style={{ display: 'flex', color: '#ded8cf', fontSize: 18, fontWeight: 700, letterSpacing: 2.4, textTransform: 'uppercase' }}>
          articol / visual discovery
        </div>
        <div style={{ display: 'flex', maxWidth: 500, maxHeight: 116, marginTop: 24, overflow: 'hidden', color: '#ffffff', fontFamily: 'sans-serif', fontSize: 52, fontWeight: 650, lineHeight: 1.04, letterSpacing: -1 }}>
          {truncate(album.title, 54)}
        </div>
        <div style={{ display: 'flex', maxWidth: 500, marginTop: 10, overflow: 'hidden', color: '#f0ebe4', fontSize: 28, fontWeight: 600, whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {truncate(album.artistName, 34)}
        </div>
        <div style={{ display: 'flex', marginTop: 24, color: '#b8b0a7', fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>
          {album.country}{album.releaseYear ? ` / ${album.releaseYear}` : ''}
        </div>
        <div style={{ display: 'flex', marginTop: 30 }}>
          <PaletteLegend colors={colors} size={38} gap={10} />
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
