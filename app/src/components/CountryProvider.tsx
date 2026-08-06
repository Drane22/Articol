'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { normalizeStorefront, STOREFRONTS } from '@/lib/storefronts';

interface CountryContextValue {
  country: string;
  ready: boolean;
  setCountry: (country: string) => void;
}

const CountryContext = createContext<CountryContextValue | null>(null);

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [country, setCountryState] = useState('PH');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCountryState(normalizeStorefront(window.localStorage.getItem('articol_country')));
    } catch {
      setCountryState('PH');
    }
    setReady(true);
  }, []);

  const setCountry = useCallback((nextCountry: string) => {
    const normalized = normalizeStorefront(nextCountry);
    setCountryState(normalized);
    try {
      window.localStorage.setItem('articol_country', normalized);
    } catch {
      // The selected storefront still applies for this session when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'articol_country') setCountryState(normalizeStorefront(event.newValue));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const value = useMemo(() => ({ country, ready, setCountry }), [country, ready, setCountry]);
  return <CountryContext.Provider value={value}>{children}</CountryContext.Provider>;
}

export function useCountry(): CountryContextValue {
  const context = useContext(CountryContext);
  if (!context) throw new Error('useCountry must be used inside CountryProvider');
  return context;
}

export { STOREFRONTS };
