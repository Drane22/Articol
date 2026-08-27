import React from 'react';
import {
  buildPaletteArtModel,
  colorWithAlpha,
  getPaletteArtStyleLabel,
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

interface Point { x: number; y: number }

const CANVAS_SIZE = 900;
const CENTER = CANVAS_SIZE / 2;

function round(value: number): number { return Math.round(value * 100) / 100; }
function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }

function pointsPath(points: Point[], close = true): string {
  if (points.length === 0) return '';
  return `M ${points.map((point) => `${round(point.x)} ${round(point.y)}`).join(' L ')}${close ? ' Z' : ''}`;
}

function smoothClosedPath(points: Point[]): string {
  if (points.length < 3) return '';
  const tension = 0.17;
  let path = `M ${round(points[0].x)} ${round(points[0].y)}`;
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const afterNext = points[(index + 2) % points.length];
    path += ` C ${round(current.x + (next.x - previous.x) * tension)} ${round(current.y + (next.y - previous.y) * tension)} ${round(next.x - (afterNext.x - current.x) * tension)} ${round(next.y - (afterNext.y - current.y) * tension)} ${round(next.x)} ${round(next.y)}`;
  }
  return `${path} Z`;
}

function polarPoint(radius: number, angle: number, cx = CENTER, cy = CENTER): Point {
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

function weightedColor(colors: PaletteArtColor[], slot: number, totalSlots: number): PaletteArtColor {
  const target = (slot + 0.5) / totalSlots;
  let cumulative = 0;
  for (const color of colors) {
    cumulative += color.normalizedWeight;
    if (target <= cumulative) return color;
  }
  return colors[colors.length - 1];
}

function materialId(system: string, seed: number, index: number): string {
  return `${system}-${seed}-${index}`;
}

function MaterialDefinitions({ system, model }: { system: string; model: PaletteArtModel }) {
  const { colors, traits, seed } = model;
  const lightX = round(20 + traits.focalX * 28);
  const lightY = round(12 + traits.focalY * 20);
  return (
    <defs>
      {colors.map((color, index) => (
        <React.Fragment key={`${system}-material-${index}`}>
          <linearGradient id={`${materialId(system, seed, index)}-linear`} x1={`${lightX}%`} y1={`${lightY}%`} x2="82%" y2="90%">
            <stop offset="0%" stopColor={mixHexColors(color.displayHex, '#ffffff', 0.5)} />
            <stop offset="34%" stopColor={mixHexColors(color.displayHex, '#ffffff', 0.12)} />
            <stop offset="72%" stopColor={color.displayHex} />
            <stop offset="100%" stopColor={mixHexColors(color.displayHex, '#02040a', 0.54)} />
          </linearGradient>
          <radialGradient id={`${materialId(system, seed, index)}-sphere`} cx={`${lightX}%`} cy={`${lightY}%`} r="72%">
            <stop offset="0%" stopColor={mixHexColors(color.displayHex, '#ffffff', 0.78)} />
            <stop offset="28%" stopColor={mixHexColors(color.displayHex, '#ffffff', 0.24)} />
            <stop offset="68%" stopColor={color.displayHex} />
            <stop offset="100%" stopColor={mixHexColors(color.displayHex, '#010208', 0.76)} />
          </radialGradient>
        </React.Fragment>
      ))}
      <radialGradient id={`${system}-${seed}-atmosphere`} cx="50%" cy="48%" r="50%">
        <stop offset="0%" stopColor={model.dominant.displayHex} stopOpacity="0.2" />
        <stop offset="58%" stopColor={model.dominant.displayHex} stopOpacity="0.055" />
        <stop offset="100%" stopColor={model.dominant.displayHex} stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

function Atmosphere({ system, model, radius = 390 }: { system: string; model: PaletteArtModel; radius?: number }) {
  return <circle cx={CENTER} cy={CENTER} r={radius} fill={`url(#${system}-${model.seed}-atmosphere)`} aria-hidden="true" />;
}

function succulentLeafPath(cx: number, cy: number, angle: number, inner: number, reach: number, width: number, bend: number): string {
  const rootLeft = polarPoint(inner, angle - width * 0.18, cx, cy);
  const rootRight = polarPoint(inner, angle + width * 0.18, cx, cy);
  const tip = polarPoint(reach, angle + bend * 0.08, cx, cy);
  const leftShoulder = polarPoint(reach * 0.58, angle - width + bend, cx, cy);
  const rightShoulder = polarPoint(reach * 0.58, angle + width + bend, cx, cy);
  const leftTip = polarPoint(reach * 0.91, angle - width * 0.2, cx, cy);
  const rightTip = polarPoint(reach * 0.91, angle + width * 0.2, cx, cy);
  return `M ${round(rootLeft.x)} ${round(rootLeft.y)} C ${round(leftShoulder.x)} ${round(leftShoulder.y)} ${round(leftTip.x)} ${round(leftTip.y)} ${round(tip.x)} ${round(tip.y)} C ${round(rightTip.x)} ${round(rightTip.y)} ${round(rightShoulder.x)} ${round(rightShoulder.y)} ${round(rootRight.x)} ${round(rootRight.y)} Q ${round(cx)} ${round(cy)} ${round(rootLeft.x)} ${round(rootLeft.y)} Z`;
}

function SucculentSculpture({ model }: { model: PaletteArtModel }) {
  const { colors, dominant, seed, traits } = model;
  const baseRotation = seededUnit(seed, 2) * Math.PI * 2;
  const cx = CENTER + (traits.focalX - 0.5) * 36;
  const cy = CENTER + (traits.focalY - 0.5) * 28;
  const layers = [
    { count: 9, inner: 74, reach: 365, width: 0.34, rotation: 0 },
    { count: 7, inner: 48, reach: 275, width: 0.40, rotation: 0.38 },
    { count: 6, inner: 22, reach: 175, width: 0.46, rotation: 0.72 },
  ];
  const totalLeaves = layers.reduce((sum, layer) => sum + layer.count, 0);
  let slot = 0;
  return (
    <g id="succulent-bloom" data-art-system="succulent-bloom" data-render-mode="material-2.5d">
      <MaterialDefinitions system="succulent" model={model} />
      <Atmosphere system="succulent" model={model} radius={415} />
      <ellipse cx={round(cx + 16)} cy={round(cy + 295)} rx="300" ry="78" fill="#010207" fillOpacity="0.38" data-art-layer="ground-shadow" />
      {layers.map((layer, layerIndex) => (
        <g key={`succulent-tier-${layerIndex}`} data-depth-tier={layerIndex}>
          {Array.from({ length: layer.count }, (_, index) => {
            const color = weightedColor(colors, slot, totalLeaves);
            const variation = seededUnit(seed, 30 + slot);
            const angle = baseRotation + layer.rotation + (index / layer.count) * Math.PI * 2 + (variation - 0.5) * (1 - traits.symmetry) * 0.3;
            const reach = layer.reach * (0.92 + color.salience * 0.12 + variation * 0.06);
            const leafWidth = layer.width * (0.92 + color.chroma * 1.2 + color.normalizedWeight * 0.4);
            const bend = (seededUnit(seed, 90 + slot) - 0.5) * 0.2;
            const path = succulentLeafPath(cx, cy, angle, layer.inner, reach, leafWidth, bend);
            const shadowPath = succulentLeafPath(cx + 8, cy + 12, angle, layer.inner, reach, leafWidth, bend);
            const veinRoot = polarPoint(layer.inner + 12, angle, cx, cy);
            const veinTip = polarPoint(reach * 0.8, angle + bend * 0.05, cx, cy);
            const colorIndex = colors.indexOf(color);
            slot += 1;
            return (
              <g key={`succulent-leaf-${layerIndex}-${index}`} data-art-layer="dimensional-leaf">
                <path d={shadowPath} fill={mixHexColors(color.displayHex, '#010208', 0.82)} fillOpacity="0.58" />
                <path d={path} fill={`url(#${materialId('succulent', seed, colorIndex)}-linear)`} stroke={mixHexColors(color.displayHex, '#ffffff', 0.38)} strokeOpacity="0.64" strokeWidth="2.2" strokeLinejoin="round" />
                <path d={`M ${round(veinRoot.x)} ${round(veinRoot.y)} Q ${round((veinRoot.x + veinTip.x) / 2 + Math.sin(angle) * 13)} ${round((veinRoot.y + veinTip.y) / 2 - Math.cos(angle) * 13)} ${round(veinTip.x)} ${round(veinTip.y)}`} fill="none" stroke={mixHexColors(color.displayHex, '#ffffff', 0.72)} strokeOpacity="0.38" strokeWidth="3" strokeLinecap="round" />
              </g>
            );
          })}
        </g>
      ))}
      <circle cx={round(cx + 7)} cy={round(cy + 10)} r={round(36 + dominant.normalizedWeight * 20)} fill={mixHexColors(dominant.displayHex, '#010208', 0.68)} />
      <circle cx={round(cx)} cy={round(cy)} r={round(33 + dominant.normalizedWeight * 18)} fill={`url(#${materialId('succulent', seed, 0)}-sphere)`} />
    </g>
  );
}

interface GenomeFacet { depth: number; ribbon: number; index: number; path: string; shadowPath: string; color: PaletteArtColor }

function GenomeSculpture({ model }: { model: PaletteArtModel }) {
  const { colors, dominant, seed, traits } = model;
  const segments = 18 + Math.round(traits.segmentation * 6);
  const amplitude = 160 + traits.depthRange * 50;
  const turns = 2.1 + traits.complexity * 1.15;
  const top = 64;
  const height = 760;
  const lean = (traits.focalX - 0.5) * 60;
  const facets: GenomeFacet[] = [];
  for (let ribbon = 0; ribbon < 2; ribbon += 1) {
    for (let index = 0; index < segments; index += 1) {
      const t0 = index / segments;
      const t1 = (index + 1) / segments;
      const phase0 = t0 * Math.PI * 2 * turns + ribbon * Math.PI;
      const phase1 = t1 * Math.PI * 2 * turns + ribbon * Math.PI;
      const x0 = CENTER + Math.sin(phase0) * amplitude * (0.78 + t0 * 0.18) + lean * (t0 - 0.5);
      const x1 = CENTER + Math.sin(phase1) * amplitude * (0.78 + t1 * 0.18) + lean * (t1 - 0.5);
      const y0 = top + t0 * height;
      const y1 = top + t1 * height;
      const width0 = 48 + Math.max(0, Math.cos(phase0)) * 36 + traits.materialRichness * 18;
      const width1 = 48 + Math.max(0, Math.cos(phase1)) * 36 + traits.materialRichness * 18;
      const color = weightedColor(colors, index + ribbon * segments, segments * 2);
      const path = pointsPath([{ x: x0 - width0 / 2, y: y0 }, { x: x0 + width0 / 2, y: y0 }, { x: x1 + width1 / 2, y: y1 + 2 }, { x: x1 - width1 / 2, y: y1 + 2 }]);
      const shadowPath = pointsPath([{ x: x0 - width0 / 2 + 9, y: y0 + 12 }, { x: x0 + width0 / 2 + 9, y: y0 + 12 }, { x: x1 + width1 / 2 + 9, y: y1 + 14 }, { x: x1 - width1 / 2 + 9, y: y1 + 14 }]);
      facets.push({ depth: (Math.cos(phase0) + Math.cos(phase1)) / 2, ribbon, index, path, shadowPath, color });
    }
  }
  facets.sort((a, b) => a.depth - b.depth);
  const coreWidth = 96 + traits.coverageConcentration * 50;
  return (
    <g id="cover-genome" data-art-system="cover-genome" data-render-mode="material-2.5d">
      <MaterialDefinitions system="genome" model={model} />
      <Atmosphere system="genome" model={model} radius={415} />
      <ellipse cx={round(CENTER + lean * 0.46)} cy="828" rx={round(180 + traits.depthRange * 40)} ry="50" fill="#010207" fillOpacity="0.46" data-art-layer="ground-shadow" />
      <path d={pointsPath([{ x: CENTER - coreWidth / 2, y: 72 }, { x: CENTER + coreWidth / 2, y: 72 }, { x: CENTER + coreWidth * 0.72 + lean / 2, y: 815 }, { x: CENTER - coreWidth * 0.72 + lean / 2, y: 815 }])} fill={`url(#${materialId('genome', seed, 0)}-linear)`} fillOpacity="0.28" stroke={colorWithAlpha(dominant.displayHex, 0.56)} strokeWidth="3" data-art-layer="translucent-core" />
      {facets.map((facet) => {
        const colorIndex = colors.indexOf(facet.color);
        return (
          <g key={`genome-facet-${facet.ribbon}-${facet.index}`} data-art-layer={facet.depth >= 0 ? 'front-ribbon-facet' : 'rear-ribbon-facet'}>
            <path d={facet.shadowPath} fill={mixHexColors(facet.color.displayHex, '#010208', 0.82)} fillOpacity={facet.depth >= 0 ? 0.48 : 0.26} />
            <path d={facet.path} fill={`url(#${materialId('genome', seed, colorIndex)}-linear)`} fillOpacity={facet.depth >= 0 ? 0.98 : 0.58} stroke={mixHexColors(facet.color.displayHex, '#ffffff', 0.42)} strokeOpacity={facet.depth >= 0 ? 0.66 : 0.28} strokeWidth="1.8" />
          </g>
        );
      })}
      {Array.from({ length: 7 }, (_, index) => {
        const progress = (index + 0.5) / 7;
        const phase = progress * Math.PI * 2 * turns;
        const x = CENTER + Math.sin(phase) * amplitude * (0.78 + progress * 0.18) + lean * (progress - 0.5);
        const y = top + progress * height;
        const color = colors[index % colors.length];
        const colorIndex = colors.indexOf(color);
        const radius = 13 + color.salience * 15;
        return (
          <g key={`genome-mutation-${index}`} data-art-layer="raised-mutation">
            <ellipse cx={round(x + 8)} cy={round(y + 11)} rx={round(radius * 1.18)} ry={round(radius * 0.62)} fill="#010207" fillOpacity="0.48" />
            <circle cx={round(x)} cy={round(y)} r={round(radius)} fill={`url(#${materialId('genome', seed, colorIndex)}-sphere)`} stroke={mixHexColors(color.displayHex, '#ffffff', 0.58)} strokeWidth="2" />
          </g>
        );
      })}
    </g>
  );
}

function planePoint(u: number, v: number, traits: PaletteArtModel['traits'], z = 0): Point {
  const left = 80 + v * 48;
  const right = 820 - v * 28;
  const fold = Math.sin(u * Math.PI * 2) * traits.complexity * 22 * Math.sin(v * Math.PI);
  return { x: left + (right - left) * u, y: 90 + 720 * v + fold - z };
}

function bandQuad(u0: number, u1: number, v0: number, v1: number, traits: PaletteArtModel['traits'], z = 0): Point[] {
  return [planePoint(u0, v0, traits, z), planePoint(u1, v0, traits, z), planePoint(u1, v1, traits, z), planePoint(u0, v1, traits, z)];
}

function TextileLoom({ model }: { model: PaletteArtModel }) {
  const { colors, dominant, seed, traits } = model;
  const horizontalCount = 5 + Math.round(traits.segmentation * 3);
  const verticalCount = 4 + Math.round(traits.complexity * 3);
  const hStep = 1 / (horizontalCount + 1);
  const vStep = 1 / (verticalCount + 1);
  const plane = bandQuad(0, 1, 0, 1, traits);
  return (
    <g id="chord-loom" data-art-system="chord-loom" data-render-mode="material-2.5d">
      <MaterialDefinitions system="loom" model={model} />
      <Atmosphere system="loom" model={model} radius={420} />
      <path d={pointsPath(plane.map((point) => ({ x: point.x + 14, y: point.y + 28 })))} fill="#010207" fillOpacity="0.48" data-art-layer="ground-shadow" />
      <path d={pointsPath([plane[3], plane[2], { x: plane[2].x + 2, y: plane[2].y + 26 }, { x: plane[3].x + 2, y: plane[3].y + 26 }])} fill={mixHexColors(dominant.displayHex, '#010208', 0.8)} fillOpacity="0.88" data-art-layer="textile-edge" />
      <path d={pointsPath(plane)} fill={mixHexColors(dominant.displayHex, '#05070d', 0.72)} fillOpacity="0.82" stroke={colorWithAlpha(dominant.displayHex, 0.42)} strokeWidth="2" data-art-layer="textile-plane" />
      {Array.from({ length: verticalCount }, (_, index) => {
        const color = weightedColor(colors, index, verticalCount);
        const width = clamp(vStep * (0.42 + Math.sqrt(color.normalizedWeight) * 0.7), 0.055, 0.15);
        const u = (index + 1) * vStep;
        const quad = bandQuad(u - width / 2, u + width / 2, 0.025, 0.975, traits, 7);
        const colorIndex = colors.indexOf(color);
        return <g key={`loom-warp-${index}`} data-art-layer="rear-warp-band"><path d={pointsPath(quad.map((point) => ({ x: point.x + 7, y: point.y + 11 })))} fill="#010207" fillOpacity="0.4" /><path d={pointsPath(quad)} fill={`url(#${materialId('loom', seed, colorIndex)}-linear)`} fillOpacity="0.78" /></g>;
      })}
      {Array.from({ length: horizontalCount }, (_, row) => {
        const color = weightedColor(colors, row, horizontalCount);
        const thickness = clamp(hStep * (0.46 + Math.sqrt(color.normalizedWeight) * 0.72), 0.045, 0.14);
        const v = (row + 1) * hStep;
        const quad = bandQuad(0.025, 0.975, v - thickness / 2, v + thickness / 2, traits, row % 2 === 0 ? 15 : 10);
        const colorIndex = colors.indexOf(color);
        return <g key={`loom-weft-${row}`} data-art-layer="foreground-weft-band"><path d={pointsPath(quad.map((point) => ({ x: point.x + 8, y: point.y + 13 })))} fill="#010207" fillOpacity="0.5" /><path d={pointsPath(quad)} fill={`url(#${materialId('loom', seed, colorIndex)}-linear)`} stroke={mixHexColors(color.displayHex, '#ffffff', 0.34)} strokeOpacity="0.35" strokeWidth="1.5" /></g>;
      })}
      {Array.from({ length: horizontalCount }, (_, row) => Array.from({ length: verticalCount }, (__, column) => {
        if ((row + column) % 2 === 0) return null;
        const color = weightedColor(colors, column, verticalCount);
        const u = (column + 1) * vStep;
        const v = (row + 1) * hStep;
        const width = clamp(vStep * (0.42 + Math.sqrt(color.normalizedWeight) * 0.7), 0.055, 0.15);
        const patch = bandQuad(u - width / 2, u + width / 2, v - hStep * 0.42, v + hStep * 0.42, traits, 23);
        const colorIndex = colors.indexOf(color);
        return <g key={`loom-crossing-${row}-${column}`} data-art-layer="over-under-crossing"><path d={pointsPath(patch.map((point) => ({ x: point.x + 6, y: point.y + 10 })))} fill="#010207" fillOpacity="0.54" /><path d={pointsPath(patch)} fill={`url(#${materialId('loom', seed, colorIndex)}-linear)`} /></g>;
      }))}
    </g>
  );
}

function terrainPoints(model: PaletteArtModel, progress: number, count: number): Point[] {
  const { traits, seed } = model;
  const centerX = CENTER + (traits.focalX - 0.5) * 70;
  const centerY = CENTER + (traits.focalY - 0.5) * 50 - progress * 60;
  const baseRx = 365 - progress * 230;
  const baseRy = 265 - progress * 155;
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const phase = seededUnit(seed, 500 + Math.round(progress * 203)) * Math.PI * 2;
    const wave = Math.sin(angle * (3 + Math.round(traits.complexity * 3)) + phase) * (0.055 + traits.complexity * 0.075);
    const radius = 1 + wave + Math.sin(angle * 2 - phase * 0.4) * 0.045;
    return { x: centerX + Math.cos(angle) * baseRx * radius, y: centerY + Math.sin(angle) * baseRy * radius };
  });
}

function TopographicRelief({ model }: { model: PaletteArtModel }) {
  const { colors, dominant, seed, traits } = model;
  const levels = 5 + Math.round(traits.segmentation * 4);
  const pointCount = 12 + Math.round(traits.complexity * 6);
  const extrusion = 20 + traits.depthRange * 28;
  return (
    <g id="cover-pulse" data-art-system="cover-pulse" data-render-mode="material-2.5d">
      <MaterialDefinitions system="terrain" model={model} />
      <Atmosphere system="terrain" model={model} radius={420} />
      <ellipse cx={round(CENTER + 22)} cy="725" rx="360" ry="92" fill="#010207" fillOpacity="0.5" data-art-layer="ground-shadow" />
      {Array.from({ length: levels }, (_, level) => {
        const progress = level / Math.max(1, levels - 1);
        const color = weightedColor(colors, levels - level - 1, levels);
        const points = terrainPoints(model, progress, pointCount);
        const sideDepth = extrusion * (0.74 + progress * 0.34);
        const side = points.map((point) => ({ x: point.x + sideDepth * 0.34, y: point.y + sideDepth }));
        const colorIndex = colors.indexOf(color);
        return <g key={`terrain-level-${level}`} data-art-layer="extruded-terrain-plate" data-depth-level={level}><path d={smoothClosedPath(side)} fill={mixHexColors(color.displayHex, '#010208', 0.68)} fillOpacity="0.98" /><path d={smoothClosedPath(points)} fill={`url(#${materialId('terrain', seed, colorIndex)}-linear)`} stroke={mixHexColors(color.displayHex, '#ffffff', 0.36)} strokeOpacity="0.5" strokeWidth="2" /></g>;
      })}
      <ellipse cx={round(CENTER + (traits.focalX - 0.5) * 80 + 12)} cy={round(CENTER + (traits.focalY - 0.5) * 48 - 56)} rx={round(38 + traits.negativeSpace * 38)} ry={round(22 + traits.negativeSpace * 24)} fill={mixHexColors(dominant.displayHex, '#010208', 0.82)} fillOpacity="0.9" stroke={mixHexColors(dominant.displayHex, '#ffffff', 0.42)} strokeOpacity="0.42" strokeWidth="3" data-art-layer="relief-basin" />
    </g>
  );
}

function orbitBackPath(cx: number, cy: number, rx: number, ry: number): string { return `M ${round(cx - rx)} ${round(cy)} A ${round(rx)} ${round(ry)} 0 0 1 ${round(cx + rx)} ${round(cy)}`; }
function orbitFrontPath(cx: number, cy: number, rx: number, ry: number): string { return `M ${round(cx + rx)} ${round(cy)} A ${round(rx)} ${round(ry)} 0 0 1 ${round(cx - rx)} ${round(cy)}`; }

interface Planet { color: PaletteArtColor; colorIndex: number; cx: number; cy: number; radius: number; rx: number; ry: number; front: boolean }

function SolarAtlas({ model }: { model: PaletteArtModel }) {
  const { colors, seed, traits } = model;
  const sun = colors.reduce((best, color) => color.normalizedWeight * 0.72 + color.chroma * 1.5 > best.normalizedWeight * 0.72 + best.chroma * 1.5 ? color : best, colors[0]);
  const planets = colors.filter((color) => color !== sun);
  const sunX = CENTER + (traits.focalX - 0.5) * 40;
  const sunY = CENTER + (traits.focalY - 0.5) * 30;
  const tilt = clamp(0.36 + traits.cameraTilt * 0.22, 0.38, 0.58);
  const planetsCount = Math.max(1, planets.length);
  const maxOrbit = 310 - traits.negativeSpace * 25;
  const minOrbit = 160;
  const bodies: Planet[] = planets.map((color, index) => {
    const orbitRatio = planetsCount === 1 ? 0.5 : index / (planetsCount - 1);
    const orbit = minOrbit + orbitRatio * (maxOrbit - minOrbit) + color.lightness * 20;
    const rx = orbit;
    const ry = orbit * tilt * clamp(0.88 + color.chroma * 0.8, 0.9, 1.12);
    const angle = (color.hue * Math.PI) / 180 + seededUnit(seed, 700 + index) * 1.2 + index * 0.56;
    const radius = 18 + Math.sqrt(color.normalizedWeight) * 44;
    return { color, colorIndex: colors.indexOf(color), cx: sunX + Math.cos(angle) * rx, cy: sunY + Math.sin(angle) * ry, radius, rx, ry, front: Math.sin(angle) >= 0 };
  });
  const sunIndex = colors.indexOf(sun);
  const sunRadius = 88 + Math.sqrt(sun.normalizedWeight) * 58;
  const starCount = 18 + Math.round(traits.complexity * 26);
  return (
    <g id="record-atlas" data-art-system="record-atlas" data-render-mode="material-2.5d">
      <MaterialDefinitions system="solar" model={model} />
      <Atmosphere system="solar" model={model} radius={420} />
      <defs><radialGradient id={`solar-corona-${seed}`} cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor={sun.displayHex} stopOpacity="0.52" /><stop offset="52%" stopColor={sun.displayHex} stopOpacity="0.18" /><stop offset="100%" stopColor={sun.displayHex} stopOpacity="0" /></radialGradient></defs>
      {Array.from({ length: starCount }, (_, index) => <circle key={`atlas-dust-${index}`} cx={round(36 + seededUnit(seed, 760 + index * 2) * 828)} cy={round(40 + seededUnit(seed, 761 + index * 2) * 820)} r={round(1.4 + seededUnit(seed, 840 + index) * 3.5)} fill={colors[index % colors.length].displayHex} fillOpacity={round(0.18 + seededUnit(seed, 900 + index) * 0.36)} data-art-layer="stellar-dust" />)}
      {bodies.map((body, index) => <path key={`orbit-back-${index}`} d={orbitBackPath(sunX, sunY, body.rx, body.ry)} fill="none" stroke={mixHexColors(body.color.displayHex, '#ffffff', 0.22)} strokeOpacity="0.34" strokeWidth={round(2.5 + body.color.normalizedWeight * 5)} data-art-layer="rear-orbit" />)}
      {bodies.filter((body) => !body.front).map((body, index) => <g key={`rear-planet-${index}`} data-art-layer="rear-planet"><ellipse cx={round(body.cx + body.radius * 0.28)} cy={round(body.cy + body.radius * 0.7)} rx={round(body.radius * 0.86)} ry={round(body.radius * 0.28)} fill="#010207" fillOpacity="0.42" /><circle cx={round(body.cx)} cy={round(body.cy)} r={round(body.radius)} fill={`url(#${materialId('solar', seed, body.colorIndex)}-sphere)`} /></g>)}
      <circle cx={round(sunX)} cy={round(sunY)} r={round(sunRadius * 1.8)} fill={`url(#solar-corona-${seed})`} data-art-layer="solar-corona" />
      <ellipse cx={round(sunX + 16)} cy={round(sunY + sunRadius * 0.72)} rx={round(sunRadius * 0.82)} ry={round(sunRadius * 0.28)} fill="#010207" fillOpacity="0.42" />
      <circle cx={round(sunX)} cy={round(sunY)} r={round(sunRadius)} fill={`url(#${materialId('solar', seed, sunIndex)}-sphere)`} stroke={mixHexColors(sun.displayHex, '#ffffff', 0.34)} strokeOpacity="0.52" strokeWidth="3" data-art-layer="volumetric-sun" />
      {bodies.map((body, index) => <path key={`orbit-front-${index}`} d={orbitFrontPath(sunX, sunY, body.rx, body.ry)} fill="none" stroke={mixHexColors(body.color.displayHex, '#ffffff', 0.34)} strokeOpacity="0.62" strokeWidth={round(3 + body.color.normalizedWeight * 6)} data-art-layer="front-orbit" />)}
      {bodies.filter((body) => body.front).map((body, index) => <g key={`front-planet-${index}`} data-art-layer="front-planet"><ellipse cx={round(body.cx + body.radius * 0.3)} cy={round(body.cy + body.radius * 0.78)} rx={round(body.radius * 0.92)} ry={round(body.radius * 0.3)} fill="#010207" fillOpacity="0.48" /><circle cx={round(body.cx)} cy={round(body.cy)} r={round(body.radius)} fill={`url(#${materialId('solar', seed, body.colorIndex)}-sphere)`} stroke={mixHexColors(body.color.displayHex, '#ffffff', 0.48)} strokeOpacity="0.58" strokeWidth="2" />{body.color.salience > 0.68 && <ellipse cx={round(body.cx)} cy={round(body.cy)} rx={round(body.radius * 1.45)} ry={round(body.radius * 0.38)} fill="none" stroke={mixHexColors(body.color.displayHex, '#ffffff', 0.62)} strokeOpacity="0.72" strokeWidth={round(3.5 + body.radius * 0.04)} transform={`rotate(-12 ${round(body.cx)} ${round(body.cy)})`} data-art-layer="planet-ring" />}</g>)}
    </g>
  );
}

export function PaletteArtCanvas({ colors, artStyle, seed, size = CANVAS_SIZE, visualFeatures }: PaletteArtCanvasProps) {
  const model = buildPaletteArtModel(colors, seed, artStyle, visualFeatures);
  const label = getPaletteArtStyleLabel(artStyle);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={`${label}, generated from ${model.colors.length} album colors`}>
      {artStyle === 'chromatic-bloom' && <SucculentSculpture model={model} />}
      {artStyle === 'palette-dna' && <GenomeSculpture model={model} />}
      {artStyle === 'chord-map' && <TextileLoom model={model} />}
      {artStyle === 'spectrum-code' && <TopographicRelief model={model} />}
      {artStyle === 'orbital-weave' && <SolarAtlas model={model} />}
    </svg>
  );
}
