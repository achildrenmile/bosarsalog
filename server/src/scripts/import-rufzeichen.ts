/**
 * Import/update operators from the Austrian Fernmeldebehörde Rufzeichenliste PDF.
 *
 * Usage:
 *   npx tsx src/scripts/import-rufzeichen.ts <path-to-pdf>
 *
 * Environment variables:
 *   RUFZEICHEN_MODE=update   — update existing records with new name/qth (default)
 *   RUFZEICHEN_MODE=skip     — skip existing records, only insert new ones
 */

import { execSync } from 'child_process';
import path from 'path';
import Database from 'better-sqlite3';
import { callsignToCountryCode } from '../utils/callsignCountry.js';

const MODE = (process.env.RUFZEICHEN_MODE || 'update').toLowerCase();
if (MODE !== 'update' && MODE !== 'skip') {
  console.error('RUFZEICHEN_MODE must be "update" or "skip"');
  process.exit(1);
}

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error('Usage: npx tsx src/scripts/import-rufzeichen.ts <path-to-pdf>');
  process.exit(1);
}

const resolvedPdf = path.resolve(pdfPath);

// Extract text from PDF using pdftotext (poppler-utils)
let rawText: string;
try {
  rawText = execSync(`pdftotext -layout "${resolvedPdf}" -`, {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  });
} catch (err) {
  console.error('Failed to run pdftotext. Make sure poppler-utils is installed.');
  console.error('On NixOS: nix-shell -p poppler-utils --run "npx tsx ..."');
  process.exit(1);
}

// Parse lines into records
interface RufRecord {
  callsign: string;
  name: string;
  qth: string;
}

const records: RufRecord[] = [];
const lines = rawText.split('\n');

for (const line of lines) {
  // Match lines starting with OE callsign pattern
  const match = line.match(/^\s*(OE\d[A-Z0-9]{2,5})\s{2,}(.+)/);
  if (!match) continue;

  const callsign = match[1].trim();
  const rest = match[2];

  // Skip redacted entries
  if (rest.includes('*-*-*')) continue;

  // Parse columns from the layout: Name is next, then Standort starts at a postal code
  // Name: everything up to the first 4-digit postal code
  // Standort: the postal code + city
  const standortMatch = rest.match(/^(.+?)\s{2,}(\d{4}\s+\S.+?)\s{2,}/);
  if (!standortMatch) continue;

  const name = standortMatch[1].trim();
  const standortFull = standortMatch[2].trim();

  // Extract just the city part from "1180 Wien" format for QTH
  const qth = standortFull;

  if (callsign && name) {
    records.push({ callsign, name, qth });
  }
}

console.log(`Parsed ${records.length} callsigns from PDF`);
console.log(`Mode: ${MODE} (existing records will be ${MODE === 'update' ? 'updated' : 'skipped'})`);

// Open database
const dbPath = process.env.DB_PATH || (
  // Docker: /data/bosarsalog.db, local dev: ./data/bosarsalog.db
  path.resolve(import.meta.dirname, '../../../../data/bosarsalog.db')
);
// Check common locations
import { existsSync } from 'fs';
const candidates = [dbPath, '/data/bosarsalog.db', path.resolve('data/bosarsalog.db'), path.resolve('../data/bosarsalog.db')];
const finalDbPath = candidates.find(p => existsSync(p));
if (!finalDbPath) {
  console.error('Database not found. Set DB_PATH environment variable.');
  console.error('Checked:', candidates.join(', '));
  process.exit(1);
}
console.log(`Database: ${finalDbPath}`);
const db = new Database(finalDbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Prepare statements
const selectOp = db.prepare('SELECT id, name, qth FROM operators WHERE callsign = ?');
const insertOp = db.prepare(`
  INSERT INTO operators (callsign, name, qth, bundesland_code, updated_at)
  VALUES (?, ?, ?, ?, datetime('now'))
`);
const updateOp = db.prepare(`
  UPDATE operators SET name = ?, qth = ?, updated_at = datetime('now')
  WHERE callsign = ?
`);

let inserted = 0;
let updated = 0;
let skipped = 0;

const importAll = db.transaction(() => {
  for (const rec of records) {
    const existing = selectOp.get(rec.callsign) as { id: number; name: string | null; qth: string | null } | undefined;

    if (existing) {
      if (MODE === 'skip') {
        skipped++;
        continue;
      }
      // Update only if data actually changed
      if (existing.name !== rec.name || existing.qth !== rec.qth) {
        updateOp.run(rec.name, rec.qth, rec.callsign);
        updated++;
      } else {
        skipped++;
      }
    } else {
      const blCode = callsignToCountryCode(rec.callsign);
      insertOp.run(rec.callsign, rec.name, rec.qth, blCode);
      inserted++;
    }
  }
});

importAll();

console.log(`\nResults:`);
console.log(`  Inserted: ${inserted}`);
console.log(`  Updated:  ${updated}`);
console.log(`  Skipped:  ${skipped}`);
console.log(`  Total:    ${inserted + updated + skipped}`);

db.close();
