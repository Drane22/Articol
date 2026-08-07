import type { Metadata } from 'next';
import { Newsreader, Plus_Jakarta_Sans } from 'next/font/google';
import '@/styles/globals.css';
import { Header } from '@/components/Header';
import { CountryProvider } from '@/components/CountryProvider';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://articol-lime.vercel.app'),
  title: 'articol — Find records by the way they look.',
  description: 'Search an album, study its artwork, and discover records with a similar visual language.',
};

const themeScript = `
(function () {
  try {
    var storedTheme = localStorage.getItem('articol_theme');
    var shouldUseDark = storedTheme === 'dark'
      ? true
      : storedTheme === 'light'
        ? false
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', shouldUseDark);
    document.documentElement.style.colorScheme = shouldUseDark ? 'dark' : 'light';
  } catch (error) {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${newsreader.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] antialiased">
        <CountryProvider>
        <Header />
        <main className="flex-1 relative z-10">{children}</main>
        <footer className="border-t border-[var(--border-color)] py-8 text-center text-xs text-[var(--text-muted)]">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 font-mono">
            <span>articol © {new Date().getFullYear()} — Visual Album Discovery</span>
            <span>Data powered by iTunes API & CLIP Embeddings</span>
            <span className="text-[var(--accent-info)]">Built by Drane</span>
          </div>
        </footer>
        </CountryProvider>
      </body>
    </html>
  );
}
