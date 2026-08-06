export interface StorefrontOption {
  code: string;
  label: string;
  currency: string;
}

export const STOREFRONTS: StorefrontOption[] = [
  { code: 'PH', label: 'Philippines', currency: 'PHP' },
  { code: 'US', label: 'United States', currency: 'USD' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { code: 'JP', label: 'Japan', currency: 'JPY' },
  { code: 'DE', label: 'Germany', currency: 'EUR' },
  { code: 'FR', label: 'France', currency: 'EUR' },
];

const storefrontMap = new Map(STOREFRONTS.map((storefront) => [storefront.code, storefront]));

export function normalizeStorefront(value: string | null | undefined): string {
  const code = (value || 'PH').toUpperCase();
  return storefrontMap.has(code) ? code : 'PH';
}

export function getStorefront(value: string | null | undefined): StorefrontOption {
  return storefrontMap.get(normalizeStorefront(value)) || STOREFRONTS[0];
}

export function formatStorePrice(price: number | undefined, currency: string | undefined, country?: string): string | null {
  if (price == null || !Number.isFinite(price) || price < 0) return null;

  const fallbackCurrency = getStorefront(country).currency;
  const resolvedCurrency = /^[A-Z]{3}$/.test(currency || '') ? currency as string : fallbackCurrency;

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: resolvedCurrency,
      maximumFractionDigits: resolvedCurrency === 'JPY' ? 0 : 2,
    }).format(price);
  } catch {
    return `${resolvedCurrency} ${price.toFixed(2)}`;
  }
}
