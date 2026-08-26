import React from 'react';
import {
  buildPaletteArtModel,
  colorWithAlpha,
  mixHexColors,
  seededUnit,
  type PaletteArtColor,
  type PaletteArtModel,
  type PaletteArtStyle,
} from '@/lib/paletteArtwork';

interface PaletteArtCanvasProps {
  colors: string[];
  artStyle: PaletteArtStyle;
  seed: string;
  size?: number;
}

interface Point {
  x: number;
  y: number;
}

const ART_SIZE = 900;
const CENTER = ART_SIZE / 2;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function polarPoint(radius: number, angle: number, centerX = CENTER, centerY = CENTER): Point {
  return {
    x: round(centerX + Math.cos(angle) * radius),
    y: round(centerY + Math.sin(angle) * radius),
  };
}

function linePath(points: Point[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
}

function petalPath(
  centerX: number,
  centerY: number,
  angle: number,
  innerRadius: number,
  outerRadius: number,
  width: number,
): string {
  const start = polarPoint(innerRadius, angle, centerX, centerY);
  const tip = polarPoint(outerRadius, angle, centerX, centerY);
  const controlRadius = innerRadius + (outerRadius - innerRadius) * 0.62;
  const left = polarPoint(controlRadius, angle - width, centerX, centerY);
  const right = polarPoint(controlRadius, angle + width, centerX, centerY);
  return `M ${start.x} ${start.y} Q ${left.x} ${left.y} ${tip.x} ${tip.y} Q ${right.x} ${right.y} ${start.x} ${start.y} Z`;
}

function CanvasFrame({ model }: { model: PaletteArtModel }) {
  const accent = model.colors[0]?.hex || '#ffffff';
  return (
    <>
      <rect x="0" y="0" width={ART_SIZE} height={ART_SIZE} rx="26" fill={model.background} />
      <rect x="28" y="28" width="844" height="844" rx="22" fill="none" stroke={colorWithAlpha(accent, 0.42)} strokeWidth="2" />
      <rect x="54" y="54" width="792" height="792" rx="18" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
    </>
  );
}

function PaletteSignature({ colors }: { colors: PaletteArtColor[] }) {
  const width = Math.min(620, colors.length * 54);
  const startX = CENTER - width / 2;
  return (
    <>
      {colors.map((color, index) => (
        <circle
          key={`signature-${color.hex}-${index}`}
          cx={round(startX + (index + 0.5) * (width / colors.length))}
          cy="824"
          r={round(4 + color.prominence * 4)}
          fill={color.hex}
        />
      ))}
    </>
  );
}

function ChromaticBloom({ model }: { model: PaletteArtModel }) {
  const layerCount = model.contrast > 0.45 ? 2 : 1;
  const phase = seededUnit(model.seed, 2) * Math.PI * 2;
  return (
    <>
      <CanvasFrame model={model} />
      <circle
        cx={CENTER}
        cy="424"
        r={round(225 + model.hueSpread * 70)}
        fill={colorWithAlpha(model.colors[0].hex, 0.08)}
      />
      {Array.from({ length: layerCount }, (_, layer) => model.colors.map((color, index) => {
        const step = (Math.PI * 2) / model.colors.length;
        const angle = phase + index * step + layer * step * 0.5;
        const innerRadius = 58 + layer * 52;
        const outerRadius = 235 + color.prominence * 105 - layer * 34;
        const width = 0.1 + color.saturation * 0.12 + model.hueSpread * 0.04;
        return (
          <path
            key={`bloom-${layer}-${color.hex}-${index}`}
            d={petalPath(CENTER, 424, angle, innerRadius, outerRadius, width)}
            fill={color.hex}
            fillOpacity={round((0.46 + color.prominence * 0.38) / (layer + 1))}
            stroke={mixHexColors(color.hex, '#ffffff', 0.2)}
            strokeOpacity="0.24"
            strokeWidth="2"
          />
        );
      }))}
      {model.colors.slice(0, 4).map((color, index) => (
        <circle
          key={`bloom-core-${color.hex}-${index}`}
          cx={CENTER}
          cy="424"
          r={round(82 - index * 15)}
          fill={color.hex}
          fillOpacity={round(0.72 + index * 0.05)}
        />
      ))}
      <PaletteSignature colors={model.colors} />
    </>
  );
}

function PaletteDna({ model }: { model: PaletteArtModel }) {
  const rungCount = Math.max(18, model.colors.length * 3);
  const amplitude = 125 + model.hueSpread * 65;
  const phase = seededUnit(model.seed, 5) * Math.PI;
  const phaseSpan = Math.PI * (3.2 + model.averageSaturation * 1.8);
  const points = Array.from({ length: rungCount }, (_, index) => {
    const progress = index / (rungCount - 1);
    const wave = Math.sin(phase + progress * phaseSpan);
    const y = 100 + progress * 650;
    return {
      first: { x: round(CENTER + wave * amplitude), y: round(y) },
      second: { x: round(CENTER - wave * amplitude), y: round(y) },
      color: model.colors[index % model.colors.length],
    };
  });
  return (
    <>
      <CanvasFrame model={model} />
      {points.map((rung, index) => (
        <g key={`dna-rung-${index}`}>
          <line
            x1={rung.first.x}
            y1={rung.first.y}
            x2={rung.second.x}
            y2={rung.second.y}
            stroke={rung.color.hex}
            strokeOpacity={round(0.5 + rung.color.prominence * 0.4)}
            strokeWidth={round(4 + rung.color.saturation * 7)}
          />
          <circle cx={rung.first.x} cy={rung.first.y} r={round(6 + rung.color.prominence * 5)} fill={rung.color.hex} />
          <circle cx={rung.second.x} cy={rung.second.y} r={round(6 + rung.color.prominence * 5)} fill={rung.color.hex} />
        </g>
      ))}
      <path
        d={linePath(points.map((point) => point.first))}
        fill="none"
        stroke={model.colors[0].hex}
        strokeWidth={round(7 + model.averageSaturation * 5)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={linePath(points.map((point) => point.second))}
        fill="none"
        stroke={model.colors[1 % model.colors.length].hex}
        strokeWidth={round(7 + model.averageSaturation * 5)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <PaletteSignature colors={model.colors} />
    </>
  );
}

function ChordMap({ model }: { model: PaletteArtModel }) {
  const phase = seededUnit(model.seed, 8) * Math.PI * 2;
  const nodes = model.colors.map((color, index) => {
    const angle = phase + (index / model.colors.length) * Math.PI * 2;
    const radius = 235 + color.luminance * 105;
    return { ...polarPoint(radius, angle, CENTER, 420), color, angle };
  });
  return (
    <>
      <CanvasFrame model={model} />
      {[118, 206, 302].map((radius, index) => (
        <circle
          key={`chord-ring-${radius}`}
          cx={CENTER}
          cy="420"
          r={radius}
          fill="none"
          stroke={colorWithAlpha(model.colors[index % model.colors.length].hex, 0.22)}
          strokeWidth={index === 2 ? 2 : 1}
        />
      ))}
      {nodes.map((node, index) => {
        const targetOffset = 1 + Math.round((1 - node.color.saturation) * Math.max(1, nodes.length / 2));
        const target = nodes[(index + targetOffset) % nodes.length];
        return (
          <line
            key={`chord-${node.color.hex}-${index}`}
            x1={node.x}
            y1={node.y}
            x2={target.x}
            y2={target.y}
            stroke={node.color.hex}
            strokeOpacity={round(0.28 + model.contrast * 0.42)}
            strokeWidth={round(2 + node.color.prominence * 5)}
          />
        );
      })}
      {nodes.map((node, index) => (
        <g key={`chord-node-${node.color.hex}-${index}`}>
          <circle cx={node.x} cy={node.y} r={round(16 + node.color.prominence * 18)} fill={colorWithAlpha(node.color.hex, 0.2)} />
          <circle cx={node.x} cy={node.y} r={round(7 + node.color.prominence * 10)} fill={node.color.hex} />
        </g>
      ))}
      <circle cx={CENTER} cy="420" r={round(44 + model.hueSpread * 28)} fill={model.colors[0].hex} />
      <circle cx={CENTER} cy="420" r={round(22 + model.contrast * 12)} fill={model.colors[model.colors.length - 1].hex} />
      <PaletteSignature colors={model.colors} />
    </>
  );
}

function SpectrumCode({ model }: { model: PaletteArtModel }) {
  const bandGap = 610 / Math.max(1, model.colors.length - 1);
  return (
    <>
      <CanvasFrame model={model} />
      {model.colors.map((color, index) => {
        const baseY = model.colors.length === 1 ? 420 : 118 + index * bandGap;
        const amplitude = 18 + color.luminance * 48 + model.contrast * 20;
        const frequency = 1.4 + color.saturation * 3.4 + model.hueSpread;
        const phase = seededUnit(model.seed, index + 40) * Math.PI * 2;
        const points = Array.from({ length: 42 }, (_, pointIndex) => {
          const progress = pointIndex / 41;
          const envelope = Math.sin(progress * Math.PI);
          return {
            x: round(70 + progress * 760),
            y: round(baseY + Math.sin(phase + progress * Math.PI * 2 * frequency) * amplitude * envelope),
          };
        });
        return (
          <g key={`spectrum-${color.hex}-${index}`}>
            <line x1="70" y1={round(baseY)} x2="830" y2={round(baseY)} stroke={colorWithAlpha(color.hex, 0.16)} strokeWidth="1" />
            <path
              d={linePath(points)}
              fill="none"
              stroke={color.hex}
              strokeWidth={round(3 + color.saturation * 8 + color.prominence * 2)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="70" cy={round(baseY)} r={round(4 + color.prominence * 4)} fill={color.hex} />
          </g>
        );
      })}
      <PaletteSignature colors={model.colors} />
    </>
  );
}

function OrbitalWeave({ model }: { model: PaletteArtModel }) {
  const phase = seededUnit(model.seed, 16) * Math.PI * 2;
  const orbits = model.colors.map((color, index) => {
    const progress = model.colors.length === 1 ? 0 : index / (model.colors.length - 1);
    const radiusX = 130 + progress * 255;
    const radiusY = 82 + progress * (120 + model.hueSpread * 75);
    const angle = phase + index * (0.72 + model.warmBalance * 0.18);
    const centerX = CENTER + Math.sin(index * 1.7) * 16;
    const centerY = 420 + Math.cos(index * 1.3) * 14;
    return {
      color,
      radiusX,
      radiusY,
      centerX,
      centerY,
      point: {
        x: round(centerX + Math.cos(angle) * radiusX),
        y: round(centerY + Math.sin(angle) * radiusY),
      },
      trail: [0.13, 0.25].map((offset) => ({
        x: round(centerX + Math.cos(angle - offset) * radiusX),
        y: round(centerY + Math.sin(angle - offset) * radiusY),
      })),
    };
  });
  return (
    <>
      <CanvasFrame model={model} />
      {orbits.map((orbit, index) => (
        <ellipse
          key={`orbit-path-${orbit.color.hex}-${index}`}
          cx={round(orbit.centerX)}
          cy={round(orbit.centerY)}
          rx={round(orbit.radiusX)}
          ry={round(orbit.radiusY)}
          fill="none"
          stroke={orbit.color.hex}
          strokeOpacity={round(0.28 + orbit.color.prominence * 0.25)}
          strokeWidth={round(2 + orbit.color.saturation * 3)}
        />
      ))}
      {orbits.map((orbit, index) => {
        const next = orbits[(index + 1) % orbits.length];
        return (
          <line
            key={`orbit-thread-${index}`}
            x1={orbit.point.x}
            y1={orbit.point.y}
            x2={next.point.x}
            y2={next.point.y}
            stroke={orbit.color.hex}
            strokeOpacity={round(0.18 + model.contrast * 0.3)}
            strokeWidth="2"
          />
        );
      })}
      {orbits.map((orbit, index) => (
        <g key={`orbit-body-${orbit.color.hex}-${index}`}>
          {orbit.trail.map((point, trailIndex) => (
            <circle
              key={`trail-${trailIndex}`}
              cx={point.x}
              cy={point.y}
              r={round(3 + orbit.color.prominence * (5 - trailIndex))}
              fill={orbit.color.hex}
              fillOpacity={trailIndex === 0 ? 0.3 : 0.16}
            />
          ))}
          <circle cx={orbit.point.x} cy={orbit.point.y} r={round(8 + orbit.color.prominence * 12)} fill={orbit.color.hex} />
        </g>
      ))}
      <circle cx={CENTER} cy="420" r={round(58 + model.averageLuminance * 26)} fill={model.colors[0].hex} />
      <circle cx={CENTER} cy="420" r={round(28 + model.averageSaturation * 18)} fill={model.colors[model.colors.length - 1].hex} />
      <PaletteSignature colors={model.colors} />
    </>
  );
}

export function PaletteArtCanvas({ colors, artStyle, seed, size = ART_SIZE }: PaletteArtCanvasProps) {
  const model = buildPaletteArtModel(colors, seed, artStyle);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${ART_SIZE} ${ART_SIZE}`}
      role="img"
      aria-label={`${artStyle} generated from ${model.colors.length} album colors`}
    >
      {artStyle === 'palette-dna' && <PaletteDna model={model} />}
      {artStyle === 'chord-map' && <ChordMap model={model} />}
      {artStyle === 'spectrum-code' && <SpectrumCode model={model} />}
      {artStyle === 'orbital-weave' && <OrbitalWeave model={model} />}
      {artStyle === 'chromatic-bloom' && <ChromaticBloom model={model} />}
    </svg>
  );
}
