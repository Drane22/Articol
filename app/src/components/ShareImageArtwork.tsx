import React, { type CSSProperties } from 'react';
import type { ShareAlbumData } from '@/lib/shareImageData';
import {
  colorWithAlpha,
  getPaletteArtColor,
  normalizePaletteArtColors,
  paletteArtSeed,
  seededUnit,
  type PaletteArtStyle,
} from '@/lib/paletteArtwork';

interface ShareImageArtworkProps {
  album: ShareAlbumData;
  format: 'landscape' | 'portrait';
  variant?: 'cover' | 'palette';
  paletteStyle?: PaletteArtStyle;
  seed?: string;
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

function absolute(style: CSSProperties): CSSProperties {
  return { position: 'absolute', ...style };
}

function SpectralField({ colors, seed }: { colors: string[]; seed: number }) {
  return (
    <div style={{ position: 'relative', width: 900, height: 900, overflow: 'hidden', borderRadius: 26, background: `linear-gradient(145deg, ${getPaletteArtColor(colors, 0)} 0%, #111216 54%, ${getPaletteArtColor(colors, 1)} 100%)` }}>
      {colors.map((color, index) => {
        const size = 300 + Math.round(seededUnit(seed, index) * 300);
        const left = -120 + Math.round(seededUnit(seed, index + 20) * 690);
        const top = -90 + Math.round(seededUnit(seed, index + 40) * 680);
        return (
          <div
            key={`${color}-${index}`}
            style={absolute({
              left,
              top,
              width: size,
              height: Math.round(size * 0.78),
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 35%, ${colorWithAlpha(color, 0.94)} 0%, ${colorWithAlpha(color, 0.58)} 42%, transparent 78%)`,
              opacity: 0.82,
              transform: `rotate(${Math.round(seededUnit(seed, index + 60) * 70 - 35)}deg)`,
            })}
          />
        );
      })}
      <div style={absolute({ inset: 28, border: '1px solid rgba(255,255,255,0.24)', borderRadius: 22 })} />
      <div style={absolute({ inset: 0, background: 'linear-gradient(180deg, rgba(8,9,12,0.08) 20%, rgba(8,9,12,0.32) 100%)' })} />
    </div>
  );
}

function OrbitAtlas({ colors, seed }: { colors: string[]; seed: number }) {
  const ringSizes = [790, 650, 510, 370, 230];
  return (
    <div style={{ position: 'relative', width: 900, height: 900, overflow: 'hidden', borderRadius: 26, background: `radial-gradient(circle at 50% 46%, ${colorWithAlpha(getPaletteArtColor(colors, 2), 0.58)} 0%, #14161b 42%, ${getPaletteArtColor(colors, 0)} 100%)` }}>
      {ringSizes.map((size, index) => (
        <div
          key={size}
          style={absolute({
            left: (900 - size) / 2,
            top: (900 - size) / 2,
            width: size,
            height: Math.round(size * (0.64 + seededUnit(seed, index) * 0.2)),
            border: `${index === 0 ? 2 : 1}px solid ${colorWithAlpha(getPaletteArtColor(colors, index), 0.42)}`,
            borderRadius: '50%',
            transform: `rotate(${Math.round(seededUnit(seed, index + 30) * 80 - 40)}deg)`,
          })}
        />
      ))}
      {colors.map((color, index) => {
        const angle = seededUnit(seed, index + 70) * Math.PI * 2;
        const radius = 130 + seededUnit(seed, index + 90) * 270;
        const dotSize = 10 + Math.round(seededUnit(seed, index + 110) * 16);
        return (
          <div
            key={`${color}-${index}`}
            style={absolute({
              left: 450 + Math.cos(angle) * radius - dotSize / 2,
              top: 430 + Math.sin(angle) * radius * 0.68 - dotSize / 2,
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              background: color,
              boxShadow: `0 0 0 6px ${colorWithAlpha(color, 0.12)}`,
            })}
          />
        );
      })}
      <div style={absolute({ left: 390, top: 370, width: 120, height: 120, borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${getPaletteArtColor(colors, 8)} 0%, ${getPaletteArtColor(colors, 3)} 55%, #121319 100%)`, border: '2px solid rgba(255,255,255,0.34)' })} />
      <div style={absolute({ inset: 28, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 22 })} />
    </div>
  );
}

function CutPaperDrift({ colors, seed }: { colors: string[]; seed: number }) {
  return (
    <div style={{ position: 'relative', width: 900, height: 900, overflow: 'hidden', borderRadius: 26, background: `linear-gradient(155deg, ${getPaletteArtColor(colors, 0)} 0%, #16161a 50%, ${getPaletteArtColor(colors, 2)} 100%)` }}>
      {colors.map((color, index) => {
        const width = 210 + Math.round(seededUnit(seed, index) * 260);
        const height = 130 + Math.round(seededUnit(seed, index + 20) * 220);
        return (
          <div
            key={`${color}-${index}`}
            style={absolute({
              left: -60 + Math.round(seededUnit(seed, index + 40) * 700),
              top: -40 + Math.round(seededUnit(seed, index + 60) * 700),
              width,
              height,
              borderRadius: 28 + Math.round(seededUnit(seed, index + 80) * 22),
              background: color,
              opacity: 0.52 + seededUnit(seed, index + 100) * 0.32,
              transform: `rotate(${Math.round(seededUnit(seed, index + 120) * 70 - 35)}deg)`,
              boxShadow: `14px 18px 0 ${colorWithAlpha('#000000', 0.2)}`,
            })}
          />
        );
      })}
      <div style={absolute({ left: 84, top: 84, width: 730, height: 730, border: '1px solid rgba(255,255,255,0.24)', borderRadius: 30 })} />
      <div style={absolute({ left: 120, top: 120, width: 660, height: 660, background: 'linear-gradient(135deg, rgba(255,255,255,0.12), transparent 34%, rgba(0,0,0,0.22))', borderRadius: 24 })} />
    </div>
  );
}

function MoirePulse({ colors, seed }: { colors: string[]; seed: number }) {
  const lines = Array.from({ length: 22 }, (_, index) => index);
  return (
    <div style={{ position: 'relative', width: 900, height: 900, overflow: 'hidden', borderRadius: 26, background: `linear-gradient(145deg, ${getPaletteArtColor(colors, 1)} 0%, #111318 46%, ${getPaletteArtColor(colors, 5)} 100%)` }}>
      {lines.map((index) => (
        <div
          key={index}
          style={absolute({
            left: -120,
            top: 20 + index * 44 + Math.round(seededUnit(seed, index) * 18),
            width: 1180,
            height: 5 + Math.round(seededUnit(seed, index + 30) * 5),
            borderRadius: 999,
            background: getPaletteArtColor(colors, index),
            opacity: 0.18 + (index % 3) * 0.06,
            transform: `rotate(${Math.round(seededUnit(seed, index + 60) * 24 - 12)}deg)`,
          })}
        />
      ))}
      {[0, 1, 2, 3].map((index) => {
        const size = 430 + index * 130;
        return (
          <div
            key={size}
            style={absolute({
              left: 450 - size / 2,
              top: 430 - size / 2,
              width: size,
              height: size,
              border: `${index + 2}px solid ${colorWithAlpha(getPaletteArtColor(colors, index + 4), 0.28)}`,
              borderRadius: '50%',
              transform: `rotate(${Math.round(seededUnit(seed, index + 100) * 45)}deg) scaleY(0.58)`,
            })}
          />
        );
      })}
      <div style={absolute({ inset: 28, border: '1px solid rgba(255,255,255,0.22)', borderRadius: 22 })} />
    </div>
  );
}

function InkBloom({ colors, seed }: { colors: string[]; seed: number }) {
  return (
    <div style={{ position: 'relative', width: 900, height: 900, overflow: 'hidden', borderRadius: 26, background: `radial-gradient(circle at 48% 40%, ${colorWithAlpha(getPaletteArtColor(colors, 2), 0.42)} 0%, #131317 48%, ${getPaletteArtColor(colors, 0)} 100%)` }}>
      {colors.map((color, index) => {
        const size = 190 + Math.round(seededUnit(seed, index) * 350);
        return (
          <div
            key={`${color}-${index}`}
            style={absolute({
              left: -100 + Math.round(seededUnit(seed, index + 30) * 760),
              top: -100 + Math.round(seededUnit(seed, index + 50) * 760),
              width: size,
              height: Math.round(size * (0.72 + seededUnit(seed, index + 70) * 0.42)),
              borderRadius: '50%',
              background: `radial-gradient(circle at 45% 45%, ${colorWithAlpha(color, 0.74)} 0%, ${colorWithAlpha(color, 0.34)} 48%, transparent 78%)`,
              opacity: 0.76,
              transform: `rotate(${Math.round(seededUnit(seed, index + 90) * 90 - 45)}deg)`,
            })}
          />
        );
      })}
      {Array.from({ length: 22 }, (_, index) => (
        <div
          key={index}
          style={absolute({
            left: 48 + Math.round(seededUnit(seed, index + 120) * 800),
            top: 48 + Math.round(seededUnit(seed, index + 140) * 800),
            width: 4 + Math.round(seededUnit(seed, index + 160) * 9),
            height: 4 + Math.round(seededUnit(seed, index + 180) * 9),
            borderRadius: '50%',
            background: getPaletteArtColor(colors, index + 4),
            opacity: 0.4,
          })}
        />
      ))}
      <div style={absolute({ inset: 28, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 22 })} />
      <div style={absolute({ inset: 0, background: 'linear-gradient(180deg, transparent 45%, rgba(7,7,10,0.34) 100%)' })} />
    </div>
  );
}

function PaletteArtwork({ colors, artStyle, seed }: { colors: string[]; artStyle: PaletteArtStyle; seed: string }) {
  const normalizedColors = normalizePaletteArtColors(colors);
  const seedValue = paletteArtSeed(`${seed}:${artStyle}`);

  if (artStyle === 'orbit-atlas') return <OrbitAtlas colors={normalizedColors} seed={seedValue} />;
  if (artStyle === 'cut-paper-drift') return <CutPaperDrift colors={normalizedColors} seed={seedValue} />;
  if (artStyle === 'moire-pulse') return <MoirePulse colors={normalizedColors} seed={seedValue} />;
  if (artStyle === 'ink-bloom') return <InkBloom colors={normalizedColors} seed={seedValue} />;
  return <SpectralField colors={normalizedColors} seed={seedValue} />;
}

export function ShareImageArtwork({ album, format, variant = 'cover', paletteStyle, seed = '' }: ShareImageArtworkProps) {
  if (format === 'portrait') {
    const isPaletteArtwork = variant === 'palette' && Boolean(paletteStyle);
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
            {isPaletteArtwork ? (
              <PaletteArtwork colors={album.palette} artStyle={paletteStyle!} seed={seed || `${album.title}-${album.artistName}`} />
            ) : (
              <Artwork album={album} size={900} radius={26} />
            )}
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
