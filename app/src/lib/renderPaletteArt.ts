import React from 'react';
import sharp from 'sharp';
import { PaletteArtCanvas } from '@/components/PaletteArtCanvas';
import type { PaletteArtInputColor, PaletteArtStyle } from '@/lib/paletteArtwork';
import type { VisualFeatures } from '@/lib/types';

interface RenderPaletteArtworkOptions {
  colors: Array<string | PaletteArtInputColor>;
  artStyle: PaletteArtStyle;
  seed: string;
  size?: number;
  visualFeatures?: VisualFeatures | null;
}

const SVG_ATTRIBUTE_NAMES: Record<string, string> = {
  className: 'class',
  fillOpacity: 'fill-opacity',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeOpacity: 'stroke-opacity',
  strokeWidth: 'stroke-width',
};

function escapeXml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgAttributeName(name: string): string {
  if (name === 'viewBox' || name.startsWith('aria-') || name.startsWith('data-')) return name;
  return SVG_ATTRIBUTE_NAMES[name] || name.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

function serializeSvgNode(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return escapeXml(node);
  if (Array.isArray(node)) return node.map(serializeSvgNode).join('');
  if (!React.isValidElement(node)) return '';

  const element = node as React.ReactElement<Record<string, unknown>>;
  if (element.type === React.Fragment) return serializeSvgNode(element.props.children as React.ReactNode);
  if (typeof element.type === 'function') {
    const rendered = (element.type as (props: Record<string, unknown>) => React.ReactNode)(element.props);
    return serializeSvgNode(rendered);
  }
  if (typeof element.type !== 'string') return '';

  const attributes = Object.entries(element.props)
    .filter(([name, value]) => name !== 'children' && value !== undefined && value !== null && value !== false)
    .map(([name, value]) => `${svgAttributeName(name)}="${escapeXml(value === true ? '' : value)}"`)
    .join(' ');
  const children = serializeSvgNode(element.props.children as React.ReactNode);
  return `<${element.type}${attributes ? ` ${attributes}` : ''}>${children}</${element.type}>`;
}

export async function renderPaletteArtworkDataUrl({
  colors,
  artStyle,
  seed,
  size = 900,
  visualFeatures,
}: RenderPaletteArtworkOptions): Promise<string> {
  const svg = serializeSvgNode(React.createElement(PaletteArtCanvas, { colors, artStyle, seed, size, visualFeatures }));
  const png = await sharp(Buffer.from(svg, 'utf8'))
    .resize(size, size, { fit: 'contain' })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}
