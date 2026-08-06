'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Bookmark, Sun, Moon, Globe } from 'lucide-react';

interface HeaderProps {
  country?: string;
  onCountryChange?: (c: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ country = 'PH', onCountryChange }) => {
  const pathname = usePathname();
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Wordmark */}
        <Link href="/" className="flex items-center space-x-2 group">
          <span className="wordmark-articol text-2xl font-serif text-[var(--text-primary)] group-hover:opacity-80 transition-opacity">
            articol
          </span>
          <span className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-[var(--border-color)] text-[var(--text-muted)] font-mono">
            archival
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center space-x-6 text-sm font-medium">
          <Link
            href="/"
            className={`transition-colors hover:text-[var(--text-primary)] ${
              pathname === '/' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-muted)]'
            }`}
          >
            Search
          </Link>
          <Link
            href="/explore"
            className={`flex items-center space-x-1 transition-colors hover:text-[var(--text-primary)] ${
              pathname === '/explore' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-muted)]'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Explore</span>
          </Link>
          <Link
            href="/saved"
            className={`flex items-center space-x-1 transition-colors hover:text-[var(--text-primary)] ${
              pathname === '/saved' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-muted)]'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Saved</span>
          </Link>
        </nav>

        {/* Utilities: Storefront selector & Theme toggle */}
        <div className="flex items-center space-x-3">
          {/* Storefront selector */}
          <div className="relative flex items-center space-x-1 text-xs text-[var(--text-muted)] border border-[var(--border-color)] rounded-md px-2 py-1 bg-[var(--bg-card)]">
            <Globe className="w-3.5 h-3.5" />
            <select
              value={country}
              onChange={(e) => onCountryChange?.(e.target.value)}
              className="bg-transparent border-none focus:outline-none cursor-pointer text-[var(--text-primary)] text-xs"
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
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-md border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-soft)] transition-colors"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
