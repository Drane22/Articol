import React from 'react';
import {
  buildPaletteArtModel,
  mixHexColors,
  seededUnit,
  type PaletteArtColor,
  type PaletteArtInputColor,
  type PaletteArtModel,
  type PaletteArtStyle,
} from '@/lib/paletteArtwork';
import type { VisualFeatures } from '@/lib/types';

interface PaletteArtCanvasProps {
  colors: Array<string | PaletteArtInputColor>;
  artStyle: PaletteArtStyle;
  seed: string;
  size?: number;
  visualFeatures?: VisualFeatures | null;
}

interface Point {
  x: number;
  y: number;
}

const CANVAS_SIZE = 900;
const CENTER = CANVAS_SIZE / 2;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function polarPoint(radius: number, angleRad: number, cx = CENTER, cy = CENTER): Point {
  return {
    x: round(cx + Math.cos(angleRad) * radius),
    y: round(cy + Math.sin(angleRad) * radius),
  };
}

// ─────────────────────────────────────────────────────────────
// 1. CHROMATIC BLOOM
// ─────────────────────────────────────────────────────────────
function ChromaticBloom({ model }: { model: PaletteArtModel }) {
  const { colors, dominant, seed } = model;
  const baseRotation = seededUnit(seed, 1) * Math.PI * 2;
  const coreRadius = round(38 + dominant.normalizedWeight * 54);

  // Group colors into major petal layers and minor interior accents
  const primaryColors = colors.slice(0, 5);

  const petals: Array<{
    d: string;
    fill: string;
    fillOpacity: number;
    stroke: string;
    strokeWidth: number;
    strokeOpacity: number;
  }> = [];

  // Outer and mid-tier organic petals
  primaryColors.forEach((color, colorIdx) => {
    const petalsPerColor = color.normalizedWeight > 0.28 ? 3 : 2;

    for (let p = 0; p < petalsPerColor; p++) {
      const angleOffset = baseRotation + (colorIdx / primaryColors.length) * Math.PI * 2 + (p * 0.42);
      const reach = round(170 + color.salience * 150 + color.normalizedWeight * 80);
      const span = 0.28 + color.normalizedWeight * 0.35;
      const innerR = round(coreRadius * 0.7);

      const start = polarPoint(innerR, angleOffset - span * 0.5);
      const tip = polarPoint(reach, angleOffset);
      const end = polarPoint(innerR, angleOffset + span * 0.5);

      const ctrlRadius = reach * (0.55 + color.lightness * 0.2);
      const ctrlLeft = polarPoint(ctrlRadius, angleOffset - span * 0.85);
      const ctrlRight = polarPoint(ctrlRadius, angleOffset + span * 0.85);

      const d = `M ${start.x} ${start.y} Q ${ctrlLeft.x} ${ctrlLeft.y} ${tip.x} ${tip.y} Q ${ctrlRight.x} ${ctrlRight.y} ${end.x} ${end.y} Z`;

      petals.push({
        d,
        fill: color.displayHex,
        fillOpacity: round(0.42 + color.salience * 0.45),
        stroke: mixHexColors(color.displayHex, '#ffffff', 0.25),
        strokeWidth: round(1.5 + color.normalizedWeight * 3),
        strokeOpacity: 0.7,
      });
    }
  });

  return (
    <g id="chromatic-bloom">
      <rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill={model.background} />

      {/* Atmospheric radial halo */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={round(260 + dominant.salience * 80)}
        fill={dominant.displayHex}
        fillOpacity={0.12}
      />

      {/* Organic Petal Array */}
      {petals.map((petal, index) => (
        <path
          key={`petal-${index}`}
          d={petal.d}
          fill={petal.fill}
          fillOpacity={petal.fillOpacity}
          stroke={petal.stroke}
          strokeWidth={petal.strokeWidth}
          strokeOpacity={petal.strokeOpacity}
        />
      ))}

      {/* Radiant Veins */}
      {primaryColors.map((color, index) => {
        const angle = baseRotation + (index / primaryColors.length) * Math.PI * 2;
        const outer = polarPoint(210 + color.salience * 100, angle);
        return (
          <line
            key={`vein-${index}`}
            x1={CENTER}
            y1={CENTER}
            x2={outer.x}
            y2={outer.y}
            stroke={color.displayHex}
            strokeWidth={round(1.5 + color.normalizedWeight * 2.5)}
            strokeOpacity={0.65}
            strokeDasharray="4 6"
          />
        );
      })}

      {/* Concentric Dominant Core */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={coreRadius}
        fill={dominant.displayHex}
        stroke={mixHexColors(dominant.displayHex, '#ffffff', 0.4)}
        strokeWidth="3"
      />
      {colors.length > 1 ? (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={round(coreRadius * 0.55)}
          fill={colors[1].displayHex}
          fillOpacity={0.9}
        />
      ) : null}
      {colors.length > 2 ? (
        <circle
          cx={CENTER}
          cy={CENTER}
          r={round(coreRadius * 0.25)}
          fill={colors[2].displayHex}
        />
      ) : null}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. PALETTE DNA
// ─────────────────────────────────────────────────────────────
function PaletteDna({ model }: { model: PaletteArtModel }) {
  const { colors, dominant, seed } = model;
  const pairCount = Math.max(12, colors.length * 3);
  const amplitude = round(130 + model.lightnessRange * 70);
  const phase = seededUnit(seed, 3) * Math.PI;

  const leftColor = dominant.displayHex;
  const rightColor = (colors[1] || dominant).displayHex;

  const rungs: Array<{
    y: number;
    leftX: number;
    rightX: number;
    color: string;
    weight: number;
    salience: number;
  }> = [];

  const leftPoints: Point[] = [];
  const rightPoints: Point[] = [];

  for (let i = 0; i < pairCount; i++) {
    const progress = i / (pairCount - 1);
    const wave = Math.sin(phase + progress * Math.PI * 3.6);
    const y = round(110 + progress * 680);
    const leftX = round(CENTER + wave * amplitude);
    const rightX = round(CENTER - wave * amplitude);

    leftPoints.push({ x: leftX, y });
    rightPoints.push({ x: rightX, y });

    const swatch = colors[i % colors.length];
    rungs.push({
      y,
      leftX,
      rightX,
      color: swatch.displayHex,
      weight: swatch.normalizedWeight,
      salience: swatch.salience,
    });
  }

  // Smooth cubic path generator
  function makeRibbonPath(points: Point[]): string {
    if (!points.length) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midY = (p0.y + p1.y) / 2;
      path += ` C ${p0.x} ${midY} ${p1.x} ${midY} ${p1.x} ${p1.y}`;
    }
    return path;
  }

  return (
    <g id="palette-dna">
      <rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill={model.background} />

      {/* Woven Harmonic Rungs */}
      {rungs.map((rung, idx) => (
        <g key={`rung-${idx}`}>
          <line
            x1={rung.leftX}
            y1={rung.y}
            x2={rung.rightX}
            y2={rung.y}
            stroke={rung.color}
            strokeWidth={round(3 + rung.weight * 10)}
            strokeOpacity={round(0.45 + rung.salience * 0.45)}
            strokeLinecap="round"
          />
          <circle
            cx={rung.leftX}
            cy={rung.y}
            r={round(5 + rung.weight * 8)}
            fill={rung.color}
          />
          <circle
            cx={rung.rightX}
            cy={rung.y}
            r={round(5 + rung.weight * 8)}
            fill={rung.color}
          />
        </g>
      ))}

      {/* Main Braided Strands */}
      <path
        d={makeRibbonPath(leftPoints)}
        fill="none"
        stroke={leftColor}
        strokeWidth={round(9 + dominant.normalizedWeight * 14)}
        strokeLinecap="round"
      />
      <path
        d={makeRibbonPath(rightPoints)}
        fill="none"
        stroke={rightColor}
        strokeWidth={round(9 + (colors[1]?.normalizedWeight || 0.2) * 14)}
        strokeLinecap="round"
      />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. CHORD MAP
// ─────────────────────────────────────────────────────────────
function ChordMap({ model }: { model: PaletteArtModel }) {
  const { colors, dominant, seed } = model;
  const baseAngle = seededUnit(seed, 4) * Math.PI * 2;

  // Position nodes along perceptual coordinates: angle = hue, radius = lightness
  const nodes = colors.map((color, idx) => {
    const angleRad = baseAngle + (color.hue * Math.PI) / 180;
    const radius = round(130 + color.lightness * 220);
    const pt = polarPoint(radius, angleRad);
    const nodeR = round(14 + Math.sqrt(color.normalizedWeight) * 44);

    return {
      ...pt,
      color,
      radius,
      angleRad,
      nodeR,
      index: idx,
    };
  });

  // Meaningful connections: between dominant and accents, and between close hues
  const chords: Array<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    width: number;
    opacity: number;
  }> = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const n1 = nodes[i];
      const n2 = nodes[j];
      const hueDiff = Math.min(
        Math.abs(n1.color.hue - n2.color.hue),
        360 - Math.abs(n1.color.hue - n2.color.hue),
      );
      const isDominantPair = i === 0 || j === 0;

      if (isDominantPair || hueDiff < 60 || hueDiff > 140) {
        chords.push({
          x1: n1.x,
          y1: n1.y,
          x2: n2.x,
          y2: n2.y,
          color: n1.color.displayHex,
          width: round(2 + (n1.color.normalizedWeight + n2.color.normalizedWeight) * 5),
          opacity: round(0.28 + (n1.color.salience + n2.color.salience) * 0.28),
        });
      }
    }
  }

  return (
    <g id="chord-map">
      <rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill={model.background} />

      {/* Harmonic Polar Grids */}
      {[140, 220, 310].map((ringR, idx) => (
        <circle
          key={`ring-${idx}`}
          cx={CENTER}
          cy={CENTER}
          r={ringR}
          fill="none"
          stroke={dominant.displayHex}
          strokeOpacity={0.18}
          strokeWidth={idx === 1 ? '1.5' : '1'}
          strokeDasharray={idx === 0 ? '4 6' : undefined}
        />
      ))}

      {/* Relational Chords */}
      {chords.map((chord, idx) => {
        // Curve chord slightly towards center
        const midX = (chord.x1 + chord.x2) / 2;
        const midY = (chord.y1 + chord.y2) / 2;
        const ctrlX = round(midX * 0.7 + CENTER * 0.3);
        const ctrlY = round(midY * 0.7 + CENTER * 0.3);
        const path = `M ${chord.x1} ${chord.y1} Q ${ctrlX} ${ctrlY} ${chord.x2} ${chord.y2}`;

        return (
          <path
            key={`chord-${idx}`}
            d={path}
            fill="none"
            stroke={chord.color}
            strokeWidth={chord.width}
            strokeOpacity={chord.opacity}
          />
        );
      })}

      {/* Central Harmonic Anchor */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={round(22 + dominant.normalizedWeight * 20)}
        fill={dominant.displayHex}
        stroke={mixHexColors(dominant.displayHex, '#ffffff', 0.35)}
        strokeWidth="2"
      />

      {/* Harmonic Nodes */}
      {nodes.map((node) => (
        <g key={`node-${node.index}`}>
          {/* Luminous Salience Halo */}
          <circle
            cx={node.x}
            cy={node.y}
            r={round(node.nodeR + node.color.salience * 14)}
            fill={node.color.displayHex}
            fillOpacity={0.22}
          />
          {/* Main Node Body */}
          <circle
            cx={node.x}
            cy={node.y}
            r={node.nodeR}
            fill={node.color.displayHex}
            stroke={mixHexColors(node.color.displayHex, '#ffffff', 0.3)}
            strokeWidth={round(2 + node.color.normalizedWeight * 3)}
          />
        </g>
      ))}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. SPECTRUM CODE
// ─────────────────────────────────────────────────────────────
function SpectrumCode({ model }: { model: PaletteArtModel }) {
  const { colors, dominant, seed } = model;
  const count = colors.length;
  const spacing = 580 / Math.max(1, count);

  return (
    <g id="spectrum-code">
      <rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill={model.background} />

      {colors.map((color, index) => {
        const baseY = round(160 + index * spacing + color.lightness * 28);
        const amplitude = round(20 + color.normalizedWeight * 65 + color.salience * 25);
        const frequency = 1.2 + (color.hue / 360) * 3.2;
        const phase = seededUnit(seed, index + 10) * Math.PI * 2;
        const strokeW = round(7 + color.normalizedWeight * 28);

        // Build continuous wave ribbon points
        const pointsTop: Point[] = [];
        const pointsBottom: Point[] = [];
        const steps = 48;

        for (let s = 0; s <= steps; s++) {
          const progress = s / steps;
          const x = round(70 + progress * 760);
          const envelope = Math.sin(progress * Math.PI);
          const y = baseY + Math.sin(phase + progress * Math.PI * 2 * frequency) * amplitude * envelope;
          pointsTop.push({ x, y: round(y - strokeW * 0.4) });
          pointsBottom.push({ x, y: round(y + strokeW * 0.4) });
        }

        const ribbonPath = `M ${pointsTop[0].x} ${pointsTop[0].y} `
          + pointsTop.map((p) => `L ${p.x} ${p.y}`).join(' ')
          + pointsBottom.reverse().map((p) => `L ${p.x} ${p.y}`).join(' ')
          + ' Z';

        return (
          <g key={`spectrum-band-${index}`}>
            {/* Guide Grid line */}
            <line
              x1="70"
              y1={baseY}
              x2="830"
              y2={baseY}
              stroke={color.displayHex}
              strokeOpacity={0.15}
              strokeWidth="1"
            />

            {/* Filled Signal Ribbon */}
            <path
              d={ribbonPath}
              fill={color.displayHex}
              fillOpacity={round(0.72 + color.salience * 0.25)}
            />

            {/* Terminal Signal Nodes */}
            <circle
              cx="70"
              cy={baseY}
              r={round(5 + color.normalizedWeight * 6)}
              fill={color.displayHex}
            />
            <circle
              cx="830"
              cy={baseY}
              r={round(5 + color.normalizedWeight * 6)}
              fill={color.displayHex}
            />
          </g>
        );
      })}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. ORBITAL WEAVE
// ─────────────────────────────────────────────────────────────
function OrbitalWeave({ model }: { model: PaletteArtModel }) {
  const { colors, dominant, seed } = model;
  const basePhase = seededUnit(seed, 7) * Math.PI * 2;

  const orbits = colors.map((color, index) => {
    const rx = round(140 + index * 52 + color.lightness * 45);
    const ry = round(85 + index * 42 + color.chroma * 90);
    const angle = basePhase + (color.hue * Math.PI) / 180 + index * 0.65;
    const bodyR = round(16 + Math.sqrt(color.normalizedWeight) * 36);
    const pos = polarPoint(rx, angle, CENTER, CENTER);

    return {
      color,
      rx,
      ry,
      angle,
      bodyR,
      pos,
      index,
    };
  });

  return (
    <g id="orbital-weave">
      <rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill={model.background} />

      {/* Central Sun Mass */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={round(44 + dominant.normalizedWeight * 42)}
        fill={dominant.displayHex}
        stroke={mixHexColors(dominant.displayHex, '#ffffff', 0.35)}
        strokeWidth="3"
      />

      {/* Luminous Core Corona */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={round(80 + dominant.salience * 50)}
        fill={dominant.displayHex}
        fillOpacity={0.14}
      />

      {/* Elliptical Orbital Paths */}
      {orbits.map((orbit) => (
        <ellipse
          key={`orbit-ellipse-${orbit.index}`}
          cx={CENTER}
          cy={CENTER}
          rx={orbit.rx}
          ry={orbit.ry}
          fill="none"
          stroke={orbit.color.displayHex}
          strokeWidth={round(1.5 + orbit.color.normalizedWeight * 4)}
          strokeOpacity={round(0.24 + orbit.color.salience * 0.35)}
          strokeDasharray={orbit.index % 2 === 1 ? '6 8' : undefined}
        />
      ))}

      {/* Orbital Bodies and Particle Trails */}
      {orbits.map((orbit) => {
        const trail1 = polarPoint(orbit.rx, orbit.angle - 0.22, CENTER, CENTER);
        const trail2 = polarPoint(orbit.rx, orbit.angle - 0.44, CENTER, CENTER);

        return (
          <g key={`body-${orbit.index}`}>
            {/* Trail particles */}
            <circle
              cx={trail2.x}
              cy={trail2.y}
              r={round(orbit.bodyR * 0.35)}
              fill={orbit.color.displayHex}
              fillOpacity={0.25}
            />
            <circle
              cx={trail1.x}
              cy={trail1.y}
              r={round(orbit.bodyR * 0.55)}
              fill={orbit.color.displayHex}
              fillOpacity={0.45}
            />
            {/* Planetary Body */}
            <circle
              cx={orbit.pos.x}
              cy={orbit.pos.y}
              r={orbit.bodyR}
              fill={orbit.color.displayHex}
              stroke={mixHexColors(orbit.color.displayHex, '#ffffff', 0.3)}
              strokeWidth="2"
            />
          </g>
        );
      })}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN CANVAS EXPORT
// ─────────────────────────────────────────────────────────────
export function PaletteArtCanvas({
  colors,
  artStyle,
  seed,
  size = CANVAS_SIZE,
  visualFeatures,
}: PaletteArtCanvasProps) {
  const model = buildPaletteArtModel(colors, seed, artStyle, visualFeatures);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {artStyle === 'chromatic-bloom' && <ChromaticBloom model={model} />}
      {artStyle === 'palette-dna' && <PaletteDna model={model} />}
      {artStyle === 'chord-map' && <ChordMap model={model} />}
      {artStyle === 'spectrum-code' && <SpectrumCode model={model} />}
      {artStyle === 'orbital-weave' && <OrbitalWeave model={model} />}
    </svg>
  );
}
