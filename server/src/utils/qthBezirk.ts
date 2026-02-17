import type Database from 'better-sqlite3';

/**
 * Try to derive bezirk_code from QTH (location) string.
 * Matches against bezirk names in the database, optionally filtered by bundesland.
 * Returns the bezirk_code or null if no match found.
 */
export function qthToBezirkCode(db: Database.Database, qth: string, bundeslandCode?: string | null): string | null {
  if (!qth || qth.trim().length < 2) return null;

  const qthNorm = qth.trim().toLowerCase();

  // Get candidate bezirke (filtered by bundesland if known)
  let bezirke: { code: string; name: string }[];
  if (bundeslandCode) {
    bezirke = db.prepare('SELECT code, name FROM bezirke WHERE bundesland_code = ?').all(bundeslandCode) as any[];
  } else {
    bezirke = db.prepare('SELECT code, name FROM bezirke').all() as any[];
  }

  // 1. Exact match (case-insensitive)
  for (const bz of bezirke) {
    if (bz.name.toLowerCase() === qthNorm) return bz.code;
  }

  // 2. Capital city shorthand: "Graz" → "Graz Stadt", "Linz" → "Linz Stadt", etc.
  for (const bz of bezirke) {
    const bzNorm = bz.name.toLowerCase();
    if (bzNorm.endsWith(' stadt') && bzNorm.replace(' stadt', '') === qthNorm) return bz.code;
  }

  // 3. QTH starts with bezirk name or bezirk name starts with QTH
  const startMatches: { code: string; name: string }[] = [];
  for (const bz of bezirke) {
    const bzNorm = bz.name.toLowerCase();
    if (qthNorm.startsWith(bzNorm) || bzNorm.startsWith(qthNorm)) {
      startMatches.push(bz);
    }
  }
  if (startMatches.length === 1) return startMatches[0].code;
  if (startMatches.length > 1) {
    startMatches.sort((a, b) => a.name.length - b.name.length);
    return startMatches[0].code;
  }

  return null;
}
