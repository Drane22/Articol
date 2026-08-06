import type { Metadata } from 'next';
import { Inter, Newsreader } from 'next/font/google';
import '@/styles/globals.css';
import { Header } from '@/components/Header';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'articol — Find records by the way they look.',
  description: 'Search an album, study its artwork, and discover records with a similar visual language.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${newsreader.variable}`}>
      <body className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] antialiased">
        <Header />
        <main className="flex-1 relative z-10">{children}</main>
        <footer className="border-t border-[var(--border-color)] py-8 text-center text-xs text-[var(--text-muted)]">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 font-mono">
            <span>articol © {new Date().getFullYear()} — Visual Album Discovery</span>
            <span>Data powered by iTunes API & CLIP Embeddings</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
