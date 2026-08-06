import type { Metadata } from 'next';
import { normalizeStorefront } from '@/lib/storefronts';

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const requestedCountry = typeof query.country === 'string' ? query.country : 'PH';
  const country = normalizeStorefront(requestedCountry);
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
