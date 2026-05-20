// Maps ISO 3166-1 alpha-2 region codes to ISO 4217 currency codes.
// Covers the most common regions; falls back to USD.
const REGION_CURRENCY_MAP: Record<string, string> = {
  AD: 'EUR', AT: 'EUR', AX: 'EUR', BE: 'EUR', BL: 'EUR', CY: 'EUR', DE: 'EUR',
  EE: 'EUR', ES: 'EUR', FI: 'EUR', FR: 'EUR', GF: 'EUR', GP: 'EUR', GR: 'EUR',
  HR: 'EUR', IE: 'EUR', IT: 'EUR', LT: 'EUR', LU: 'EUR', LV: 'EUR', MC: 'EUR',
  ME: 'EUR', MF: 'EUR', MQ: 'EUR', MT: 'EUR', NL: 'EUR', PM: 'EUR', PT: 'EUR',
  RE: 'EUR', SI: 'EUR', SK: 'EUR', SM: 'EUR', TF: 'EUR', VA: 'EUR', XK: 'EUR',
  YT: 'EUR',
  GB: 'GBP', IM: 'GBP', JE: 'GBP', GG: 'GBP',
  JP: 'JPY',
  CN: 'CNY',
  IN: 'INR',
  AU: 'AUD', CX: 'AUD', CC: 'AUD', HM: 'AUD', KI: 'AUD', NF: 'AUD', NR: 'AUD', TV: 'AUD',
  CA: 'CAD',
  CH: 'CHF', LI: 'CHF',
  BR: 'BRL',
  MX: 'MXN',
  KR: 'KRW',
  HK: 'HKD',
  SG: 'SGD',
  NO: 'NOK', SJ: 'NOK',
  SE: 'SEK',
  DK: 'DKK', FO: 'DKK', GL: 'DKK',
  NZ: 'NZD', CK: 'NZD', NU: 'NZD', PN: 'NZD', TK: 'NZD',
  ZA: 'ZAR',
  RU: 'RUB',
  TR: 'TRY',
  AE: 'AED',
  SA: 'SAR',
  TH: 'THB',
  MY: 'MYR',
  ID: 'IDR',
  PH: 'PHP',
  PL: 'PLN',
  CZ: 'CZK',
  HU: 'HUF',
  RO: 'RON',
  IL: 'ILS',
  AR: 'ARS',
  CL: 'CLP',
  CO: 'COP',
  NG: 'NGN',
  EG: 'EGP',
  PK: 'PKR',
  BD: 'BDT',
  VN: 'VND',
  UA: 'UAH',
};

export function getLocaleCurrencyCode(locale = navigator.language): string {
  // Prefer Intl.Locale if available (resolves likely region automatically)
  try {
    const resolved = new Intl.Locale(locale).maximize();
    const region = resolved.region ?? '';
    if (region && REGION_CURRENCY_MAP[region]) {
      return REGION_CURRENCY_MAP[region];
    }
  } catch {
    // Intl.Locale may not be available; fall through
  }

  const tag = locale.toUpperCase();
  const explicitRegion = tag.split('-').find((part) => part.length === 2 && /^[A-Z]{2}$/.test(part));
  if (explicitRegion && REGION_CURRENCY_MAP[explicitRegion]) {
    return REGION_CURRENCY_MAP[explicitRegion];
  }

  // US is the default
  return 'USD';
}

export function getLocaleCurrencySymbol(locale = navigator.language): string {
  const currencyCode = getLocaleCurrencyCode(locale);
  try {
    const symbol = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value;

    return symbol ?? currencyCode;
  } catch {
    return currencyCode;
  }
}
