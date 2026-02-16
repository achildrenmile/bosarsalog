// Maps amateur radio callsign prefixes to bundesland/country codes used in the DB.
// Austrian OE1-OE9 → "01"-"09", neighbor countries → "10"-"18".

const PREFIX_MAP: [RegExp, string][] = [
  [/^OE1/, '01'],
  [/^OE2/, '02'],
  [/^OE3/, '03'],
  [/^OE4/, '04'],
  [/^OE5/, '05'],
  [/^OE6/, '06'],
  [/^OE7/, '07'],
  [/^OE8/, '08'],
  [/^OE9/, '09'],
  [/^HB0/, '16'],  // Liechtenstein (before HB!)
  [/^HB/,  '17'],  // Schweiz
  [/^S5/,  '10'],  // Slowenien
  [/^OK/,  '11'],  // Tschechien
  [/^OL/,  '11'],  // Tschechien
  [/^D[A-R]/, '12'], // Deutschland
  [/^I/,   '13'],  // Italien
  [/^OM/,  '14'],  // Slowakei
  [/^9A/,  '15'],  // Kroatien
  [/^HA/,  '18'],  // Ungarn
  [/^HG/,  '18'],  // Ungarn
];

/**
 * Derive the bundesland/country code from a callsign.
 * Strips portable/mobile suffixes (/P, /M, /OE8, etc.) before matching.
 * Returns null if the prefix is not recognized.
 */
export function callsignToCountryCode(callsign: string): string | null {
  // Strip suffixes like /P, /M, /OE8, /QRP etc.
  const base = callsign.toUpperCase().replace(/\/.*$/, '');
  for (const [re, code] of PREFIX_MAP) {
    if (re.test(base)) return code;
  }
  return null;
}
