// Maps English country names (as returned by Nominatim) to ISO 3166-1 alpha-2 codes.
const COUNTRY_CODES: Record<string, string> = {
  'United States': 'US', 'United States of America': 'US',
  'United Kingdom': 'GB', 'England': 'GB', 'Scotland': 'GB', 'Wales': 'GB', 'Northern Ireland': 'GB',
  'Canada': 'CA', 'Mexico': 'MX', 'Australia': 'AU', 'New Zealand': 'NZ',
  'France': 'FR', 'Germany': 'DE', 'Italy': 'IT', 'Spain': 'ES', 'Portugal': 'PT',
  'Netherlands': 'NL', 'Belgium': 'BE', 'Luxembourg': 'LU', 'Switzerland': 'CH', 'Austria': 'AT',
  'Sweden': 'SE', 'Norway': 'NO', 'Denmark': 'DK', 'Finland': 'FI', 'Iceland': 'IS',
  'Ireland': 'IE', 'Greece': 'GR', 'Malta': 'MT', 'Cyprus': 'CY',
  'Poland': 'PL', 'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Slovakia': 'SK', 'Hungary': 'HU',
  'Romania': 'RO', 'Bulgaria': 'BG', 'Croatia': 'HR', 'Slovenia': 'SI', 'Serbia': 'RS',
  'Albania': 'AL', 'Montenegro': 'ME', 'Bosnia and Herzegovina': 'BA', 'Ukraine': 'UA',
  'Russia': 'RU', 'Turkey': 'TR', 'Israel': 'IL', 'Jordan': 'JO',
  'United Arab Emirates': 'AE', 'UAE': 'AE', 'Saudi Arabia': 'SA', 'Qatar': 'QA',
  'Egypt': 'EG', 'Morocco': 'MA', 'Tunisia': 'TN', 'South Africa': 'ZA', 'Kenya': 'KE', 'Tanzania': 'TZ',
  'Japan': 'JP', 'China': 'CN', 'South Korea': 'KR', 'Taiwan': 'TW',
  'Hong Kong': 'HK', 'Singapore': 'SG', 'Thailand': 'TH', 'Vietnam': 'VN',
  'Cambodia': 'KH', 'Indonesia': 'ID', 'Philippines': 'PH', 'Malaysia': 'MY', 'Myanmar': 'MM',
  'India': 'IN', 'Nepal': 'NP', 'Sri Lanka': 'LK', 'Maldives': 'MV',
  'Brazil': 'BR', 'Argentina': 'AR', 'Chile': 'CL', 'Peru': 'PE', 'Colombia': 'CO',
  'Ecuador': 'EC', 'Bolivia': 'BO', 'Uruguay': 'UY', 'Paraguay': 'PY', 'Venezuela': 'VE',
  'Cuba': 'CU', 'Jamaica': 'JM', 'Dominican Republic': 'DO', 'Puerto Rico': 'PR',
  'Bahamas': 'BS', 'Barbados': 'BB', 'Trinidad and Tobago': 'TT', 'Belize': 'BZ',
  'Costa Rica': 'CR', 'Panama': 'PA', 'Guatemala': 'GT', 'Honduras': 'HN',
  'El Salvador': 'SV', 'Nicaragua': 'NI',
};

/** Extracts the country name from a Nominatim display_name (last comma-separated segment). */
export function getCountryFromPlaceName(placeName: string | null | undefined): string | null {
  if (!placeName) return null;
  const parts = placeName.split(',').map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? null;
}

/** Converts an ISO 3166-1 alpha-2 country code to its flag emoji. */
function codeToFlag(code: string): string {
  return [...code.toUpperCase()].map((c) =>
    String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1f1e6)
  ).join('');
}

/** Returns a flag emoji for a country name, or '' if unknown. */
export function countryFlag(country: string | null | undefined): string {
  if (!country) return '';
  const code = COUNTRY_CODES[country];
  return code ? codeToFlag(code) : '';
}

/** Returns "🇺🇸 United States" or just "United States" if no flag available. */
export function countryWithFlag(country: string | null | undefined): string {
  if (!country) return '';
  const flag = countryFlag(country);
  return flag ? `${flag} ${country}` : country;
}
