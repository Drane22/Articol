import type { Metadata } from 'next';
import { normalizeStorefront } from '@/lib/storefronts';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // Layout metadata cannot receive page searchParams in Next.js. The page
  // keeps the selected country in its share URL; metadata uses PH as the
  // crawler-safe default for the artwork preview.
  const country = normalizeStorefront('PH');
  let title = 'Album artwork';
  let artist = 'Articol';

  try {
    const response = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&country=${country}`, {
      next: { revalidate: 300 },
    });
    const data = await response.json();
    const item = data.results?.find((result: { wrapperType?: string }) => result.wrapperType === 'collection') || data.results?.[0];
    title = item?.collectionName || title;
    artist = item?.artistName || artist;
  } catch {
    // Keep the page metadata valid when the external catalog is unavailable.
  }

  const pageTitle = `${title} — ${artist}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://articol-lime.vercel.app';
  const imageUrl = new URL(`/album/${id}/opengraph-image?country=${country}`, siteUrl).toString();
  const pageUrl = new URL(`/album/${id}?country=${country}`, siteUrl).toString();

  return {
    title: pageTitle,
    description: `Study the artwork for ${pageTitle} on Articol.`,
    openGraph: {
      title: pageTitle,
      description: `Study the artwork for ${pageTitle} on Articol.`,
      type: 'article',
      url: pageUrl,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: `${pageTitle} share card` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: `Study the artwork for ${pageTitle} on Articol.`,
      images: [imageUrl],
    },
  };
}

export default function AlbumLayout({ children }: { children: React.ReactNode }) {
  return children;
}
