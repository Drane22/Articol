export interface StorefrontOption {
  code: string;
  label: string;
  currency: string;
  locale: string;
}

export const STOREFRONTS: StorefrontOption[] = [
  { code: 'PH', label: 'Philippines', currency: 'PHP', locale: 'en-PH' },
  { code: 'US', label: 'United States', currency: 'USD', locale: 'en-US' },
  { code: 'GB', label: 'United Kingdom', currency: 'GBP', locale: 'en-GB' },
  { code: 'JP', label: 'Japan', currency: 'JPY', locale: 'ja-JP' },
  { code: 'DE', label: 'Germany', currency: 'EUR', locale: 'de-DE' },
  { code: 'FR', label: 'France', currency: 'EUR', locale: 'fr-FR' },
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

  const storefront = getStorefront(country);
  // The selected storefront is authoritative. Stored iTunes/Supabase rows can
  // contain a currency from an older country selection, so never let that
  // stale value render a dollar sign beside a Philippine price, for example.
  const resolvedCurrency = country
    ? storefront.currency
    : /^[A-Z]{3}$/.test(currency || '')
      ? currency as string
      : storefront.currency;

  try {
    return new Intl.NumberFormat(storefront.locale, {
      style: 'currency',
      currency: resolvedCurrency,
      maximumFractionDigits: resolvedCurrency === 'JPY' ? 0 : 2,
    }).format(price);
  } catch {
    return `${resolvedCurrency} ${price.toFixed(resolvedCurrency === 'JPY' ? 0 : 2)}`;
  }
}
