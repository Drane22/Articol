'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Compass, Bookmark, Sun, Moon, Globe, Search, X, Loader2 } from 'lucide-react';
import { Album, SearchScope } from '../lib/types';
import { CoverArtwork } from './CoverArtwork';

interface HeaderProps {
  country?: string;
  onCountryChange?: (c: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ country = 'PH', onCountryChange }) => {
  const pathname = usePathname();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(true);
  const [themeReady, setThemeReady] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Album[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const searchScopes: Array<{ value: SearchScope; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'title', label: 'Album title' },
    { value: 'artist', label: 'Artist' },
  ];

  useEffect(() => {
    try {
      const storedTheme = window.localStorage.getItem('articol_theme');
      const nextDarkMode = storedTheme === 'dark'
        ? true
        : storedTheme === 'light'
          ? false
          : document.documentElement.classList.contains('dark');
      setDarkMode(nextDarkMode);
    } catch {
      setDarkMode(document.documentElement.classList.contains('dark'));
    }
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;

    document.documentElement.classList.toggle('dark', darkMode);
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light';
    try {
      window.localStorage.setItem('articol_theme', darkMode ? 'dark' : 'light');
    } catch {
      // Theme still applies for this session when storage is unavailable.
    }
  }, [darkMode, themeReady]);

  useEffect(() => {
    if (!isSearchOpen || pathname === '/') return;

    const controller = new AbortController();
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return () => controller.abort();
    }

    const timeout = window.setTimeout(() => {
      setIsSearching(true);
      setSearchError(null);
      fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}&country=${country}&limit=8&scope=${searchScope}`, {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Search failed');
          return data;
        })
        .then((data) => {
          setSearchResults(data.results || []);
          setIsSearching(false);
        })
        .catch((error: Error) => {
          if (error.name === 'AbortError') return;
          setSearchResults([]);
          setIsSearching(false);
          setSearchError('Search is unavailable right now. Try again.');
        });
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [country, isSearchOpen, pathname, searchQuery, searchScope]);

  useEffect(() => {
    if (!isSearchOpen || pathname === '/') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSearchOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, pathname]);

  useEffect(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
  }, [pathname]);

  useEffect(() => {
    if (!isSearchOpen || pathname === '/') return;

    const handlePointerDown = (event: PointerEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isSearchOpen, pathname]);

  const handleSearchClick = () => {
    if (pathname === '/') {
      const homeSearch = document.getElementById('home-search-input') as HTMLInputElement | null;
      if (homeSearch) {
        homeSearch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        homeSearch.focus();
      } else {
        router.push('/');
      }
      return;
    }

    setIsSearchOpen((open) => !open);
  };

  const handleSearchResultSelect = (album: Album) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    router.push(`/album/${album.itunesCollectionId}`);
  };

  const handleHeaderQueryChange = (value: string) => {
    setSearchQuery(value);
    setSearchResults([]);
    setSearchError(null);
    setIsSearching(Boolean(value.trim()));
  };

  const handleHeaderScopeChange = (scope: SearchScope) => {
    setSearchScope(scope);
    setSearchResults([]);
    setSearchError(null);
    setIsSearching(Boolean(searchQuery.trim()));
  };

  const countries = [
    { code: 'PH', label: 'Philippines (PH)' },
    { code: 'US', label: 'United States (US)' },
    { code: 'GB', label: 'United Kingdom (GB)' },
    { code: 'JP', label: 'Japan (JP)' },
    { code: 'DE', label: 'Germany (DE)' },
    { code: 'FR', label: 'France (FR)' },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg-canvas)]/80 border-b border-[var(--border-color)] transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-3">
        
        {/* Wordmark */}
        <Link href="/" className="flex min-w-0 shrink-0 items-center space-x-2 group">
          <span className="wordmark-articol text-xl sm:text-2xl font-serif text-[var(--text-primary)] group-hover:opacity-80 transition-opacity">
            articol
          </span>
          <span className="hidden sm:inline text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)] font-mono">
            archival
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="flex min-w-0 items-center gap-3 sm:gap-6 text-sm font-medium">
          <div ref={searchContainerRef} className="relative">
            <button
              type="button"
              onClick={handleSearchClick}
              aria-expanded={pathname !== '/' ? isSearchOpen : undefined}
              aria-controls={pathname !== '/' ? 'global-search-panel' : 'home-search-input'}
              className={`inline-flex min-h-10 min-w-8 items-center justify-center gap-1.5 transition-colors hover:text-[var(--text-primary)] ${
                pathname === '/' || isSearchOpen ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-muted)]'
              }`}
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
            </button>

            {pathname !== '/' && isSearchOpen && (
              <div
                id="global-search-panel"
                className="absolute right-0 top-[calc(100%+0.85rem)] z-50 w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] text-left shadow-2xl"
              >
                <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-3 py-2.5">
                  <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                  <input
                    autoFocus
                    value={searchQuery}
                    onChange={(event) => handleHeaderQueryChange(event.target.value)}
                    placeholder="Search an album or artist..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                    aria-label="Search albums or artists"
                  />
                  {isSearching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--text-muted)]" />}
                  {searchQuery && !isSearching && (
                    <button
                      type="button"
                      onClick={() => handleHeaderQueryChange('')}
                      className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--text-primary)]"
                      aria-label="Clear search"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border-color)] px-3 py-2" aria-label="Search by">
                  <span className="mr-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Search by</span>
                  {searchScopes.map((scope) => (
                    <button
                      key={scope.value}
                      type="button"
                      onClick={() => handleHeaderScopeChange(scope.value)}
                      aria-pressed={searchScope === scope.value}
                      className={`min-h-8 rounded-full border px-2.5 text-[11px] transition-colors ${
                        searchScope === scope.value
                          ? 'border-[var(--text-primary)] bg-[var(--accent-soft)] font-semibold text-[var(--text-primary)]'
                          : 'border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>

                <div className="max-h-[min(24rem,60vh)] overflow-y-auto">
                  {isSearching && <p className="px-4 py-4 text-xs text-[var(--text-muted)]">Finding records...</p>}
                  {!isSearching && searchError && (
                    <p className="px-4 py-4 text-xs theme-danger" role="alert">{searchError}</p>
                  )}
                  {!isSearching && !searchError && searchQuery.trim() && searchResults.length === 0 && (
                    <p className="px-4 py-4 text-xs text-[var(--text-muted)]">No albums or artists found.</p>
                  )}
                  {!isSearching && searchResults.map((album) => (
                    <button
                      key={album.itunesCollectionId}
                      type="button"
                      onClick={() => handleSearchResultSelect(album)}
                      className="flex w-full items-center gap-3 border-b border-[var(--border-color)] px-3 py-2.5 text-left last:border-b-0 hover:bg-[var(--accent-soft)]"
                    >
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-[var(--accent-soft)]">
                        <CoverArtwork src={album.artworkUrl} alt="" sizes="40px" />
                      </div>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-xs font-medium text-[var(--text-primary)]">{album.title}</strong>
                        <small className="mt-0.5 block truncate text-[11px] text-[var(--text-muted)]">{album.artistName} - {album.releaseYear}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <Link
            href="/explore"
            className={`flex min-h-10 items-center space-x-1 transition-colors hover:text-[var(--text-primary)] ${
              pathname === '/explore' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-muted)]'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span className="hidden sm:inline">Explore</span>
          </Link>
          <Link
            href="/saved"
            className={`flex min-h-10 items-center space-x-1 transition-colors hover:text-[var(--text-primary)] ${
              pathname === '/saved' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-muted)]'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span className="hidden sm:inline">Saved</span>
          </Link>
        </nav>

        {/* Utilities: Storefront selector & Theme toggle */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          {/* Storefront selector */}
          <div className="relative flex items-center space-x-1 text-xs text-[var(--text-muted)] border border-[var(--border-color)] rounded-md px-1.5 sm:px-2 py-1 bg-[var(--bg-card)]">
            <Globe className="w-3.5 h-3.5" />
            <select
              value={country}
              onChange={(e) => onCountryChange?.(e.target.value)}
              className="w-7 sm:w-auto bg-transparent border-none focus:outline-none cursor-pointer text-[var(--text-primary)] text-xs"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code} className="bg-[var(--bg-card)] text-[var(--text-primary)]">
                  {c.code}
                </option>
              ))}
            </select>
          </div>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={() => setDarkMode((current) => !current)}
            className="min-h-8 min-w-8 p-1.5 rounded-md border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-soft)] transition-colors"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={darkMode}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
