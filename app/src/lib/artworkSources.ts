const COVER_WIDTHS = [160, 240, 320, 480, 600, 900, 1200];

/** Apple provides size variants at the same artwork path. Leave other hosts intact. */
export function getArtworkSources(src: string, proxy: boolean): { src: string; srcSet?: string } {
  const resolve = (url: string) => proxy ? `/api/proxy-image?url=${encodeURIComponent(url)}` : url;
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.mzstatic.com') ||
      !/\/\d+x\d+[^/]*\.(jpg|jpeg|png|webp)$/i.test(url.pathname)) {
      return { src: resolve(src) };
    }
    const srcSet = COVER_WIDTHS.map(width => {
      const variant = new URL(url);
      variant.pathname = variant.pathname.replace(/\/\d+x\d+(?=[^/]*$)/, `/${width}x${width}`);
      return `${resolve(variant.toString())} ${width}w`;
    }).join(', ');
    return { src: resolve(src), srcSet };
  } catch {
    return { src: resolve(src) };
  }
}
