import { Router } from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { getDb } from '../db/database.js';
import { AuthRequest, requireRole } from '../middleware/auth.js';
import { callsignToCountryCode } from '../utils/callsignCountry.js';
import { qthToBezirkCode } from '../utils/qthBezirk.js';

export const importRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

interface ParsedRow {
  callsign: string;
  suffix: string | null;
  name: string | null;
  qth: string | null;
  bezirk_code: string | null;
  locator: string | null;
  readability: number | null;
  strength: number | null;
  db_over_s9: string | null;
  repeater_name: string | null;
  notstrom: boolean;
  info: string | null;
  bundesland_section: string;
  matched_repeater_id: number | null;
  is_duplicate: boolean;
  issues: string[];
}

/**
 * Parse EmHam PDF text output.
 *
 * pdf-parse extracts columns in visual order, which for EmHam is:
 *   Name [Locator] [+dB] REPEATER\tPLZ, QTH R / S\tBezKen [Info]\tCallsign [/ suffix]
 *
 * Examples:
 *   Jozef JN88ee HERMANNSKOGEL\t1110, Wien 5 / 8\tWC\tOE1CJG
 *   Robert JN88ff 10 HERMANNSKOGEL\t1220, Wien 5 / 9\tWC\tOE1KOV
 *   Martin JN88fg HERMANNSKOGEL\t1210, Wien 5 / 9\tWC\tOE1MVA / portabel
 *   Günter 10 HERMANNSKOGEL\t1160, Wien 5 / 9\tWC Lichtinsel 16 Stacharnd\tOE1GOF
 *   Niko HERMANNSKOGEL\t, Sulz im Wienerwald 5 / 9\t*\tOE3NMC
 *
 * Tabs separate the major field groups. Callsign is always the LAST tab-segment.
 */

function parseCallsign(raw: string): { callsign: string; suffix: string | null } {
  const s = raw.trim().toUpperCase();
  const portabelMatch = s.match(/^(\S+)\s*\/\s*(?:PORTABEL|PORT|PORTABLE)$/i);
  if (portabelMatch) return { callsign: portabelMatch[1], suffix: '/p' };
  const slashMatch = s.match(/^(\S+)\s*\/\s*(\S+)$/);
  if (slashMatch) return { callsign: slashMatch[1], suffix: `/${slashMatch[2].toLowerCase()}` };
  return { callsign: s, suffix: null };
}

function parseEmHamText(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split('\n');
  let currentBl = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Detect Bundesland section headers: "OE1 - Wien" or "OE3 - Niederösterreich"
    const blMatch = line.match(/^(OE\d)\s*[-–—]\s*(.+)$/);
    if (blMatch) {
      currentBl = blMatch[1];
      continue;
    }

    // Skip non-data lines
    if (/^(Gesamt|Rufzeichen|Callsign|Vor-|Seite|Stand:|Krisenkommunikations|EmHam|Teilnehmer|Bei der|OE\d\s+Gesamt|ausgeführt|Not-|vy |Rapporte|Zusammenfassung|Länderkennung|Übertragungsart|Summe|Statistik|\d+[,%])/i.test(line)) continue;
    if (/^(OE\d)$/.test(line)) { currentBl = line; continue; }
    if (/^[-=]+$/.test(line)) continue;
    if (/^--\s*\d+\s*of\s*\d+\s*--$/.test(line)) continue;

    // A data line must contain tabs (tab-separated columns)
    if (!line.includes('\t')) continue;

    const tabParts = line.split('\t').map(s => s.trim());
    if (tabParts.length < 2) continue;

    // Last tab-segment should contain the callsign (possibly with "/ portabel" etc.)
    const lastPart = tabParts[tabParts.length - 1];
    let callsignRaw: string;

    const callsignMatch = lastPart.match(/^([A-Z0-9]{3,}(?:\s*\/\s*\S+)?)$/i);
    if (callsignMatch) {
      callsignRaw = callsignMatch[1];
    } else {
      // Callsign might be on a subsequent line (multi-line info wrapping)
      // Collect continuation lines and look for a callsign
      let found = false;
      let lookAhead = i + 1;
      let extraInfo = '';
      while (lookAhead < lines.length) {
        const nextLine = lines[lookAhead].trim();
        if (!nextLine || nextLine.includes('\t') || /^(OE\d\s*[-–—]|Gesamt|Seite|--|Callsign|Rufzeichen)/i.test(nextLine)) break;
        // Check if this line IS a callsign
        const csMatch = nextLine.match(/^([A-Z0-9]{3,}(?:\s*\/\s*\S+)?)$/i);
        if (csMatch) {
          callsignRaw = csMatch[1];
          // Append any previously collected lines as extra info
          if (extraInfo) {
            // Append to the last tab segment that wasn't a callsign
            tabParts[tabParts.length - 1] = tabParts[tabParts.length - 1] + ' ' + extraInfo;
          }
          i = lookAhead; // Skip past the consumed lines
          found = true;
          break;
        }
        extraInfo += (extraInfo ? ' ' : '') + nextLine;
        lookAhead++;
      }
      if (!found) continue;
    }

    const { callsign, suffix } = parseCallsign(callsignRaw!);
    if (!/^[A-Z0-9]{3,}$/.test(callsign)) continue;

    // First tab-segment: "Name [Locator] [+dB] REPEATER"
    const firstPart = tabParts[0];

    // Extract repeater name (all-caps word at end, e.g. HERMANNSKOGEL)
    let repeater_name: string | null = null;
    let db_over_s9: string | null = null;
    let locator: string | null = null;
    let name: string | null = null;

    // Pattern: "Name [Locator] [dBvalue] REPEATERNAME"
    // Repeater is the last all-caps word (4+ chars)
    const firstWords = firstPart.split(/\s+/);

    // Find repeater name from end (all-caps, 4+ chars)
    let repeaterIdx = -1;
    for (let j = firstWords.length - 1; j >= 0; j--) {
      if (/^[A-ZÄÖÜ]{4,}$/.test(firstWords[j])) {
        repeaterIdx = j;
        break;
      }
    }
    if (repeaterIdx >= 0) {
      repeater_name = firstWords[repeaterIdx];
    }

    // Before the repeater, look for dB value (just a number like "10", "60", "40")
    // and locator (JN/JO pattern)
    const beforeRepeater = repeaterIdx >= 0 ? firstWords.slice(0, repeaterIdx) : firstWords;
    const nameParts: string[] = [];

    for (const w of beforeRepeater) {
      if (/^J[NO]\d{2}[a-zA-Z]{2}$/i.test(w)) {
        locator = w.toUpperCase();
      } else if (/^\d{1,3}$/.test(w) && parseInt(w) >= 5 && parseInt(w) <= 60) {
        // Likely a dB value (appears before repeater name)
        db_over_s9 = `+${w}`;
      } else {
        nameParts.push(w);
      }
    }
    name = nameParts.length > 0 ? nameParts.join(' ') : null;

    // Second tab-segment: "PLZ, QTH R / S" (e.g. "1110, Wien 5 / 8")
    let qth: string | null = null;
    let readability: number | null = null;
    let strength: number | null = null;

    if (tabParts.length >= 2) {
      const secondPart = tabParts[1];
      // Extract rapport "R / S" from the end
      const rapportMatch = secondPart.match(/(\d)\s*\/\s*(\d)\s*$/);
      if (rapportMatch) {
        readability = parseInt(rapportMatch[1]);
        strength = parseInt(rapportMatch[2]);
        // Everything before the rapport is the QTH
        const qthRaw = secondPart.slice(0, rapportMatch.index).trim();
        // QTH format: "PLZ, Ort" — strip leading comma if PLZ is missing
        qth = qthRaw.replace(/^,\s*/, '').trim() || null;
      } else {
        qth = secondPart.trim() || null;
      }
    }

    // Third tab-segment (if exists): "BezKen [Info]" (e.g. "WC" or "GF Abfrage am...")
    let bezirk_code: string | null = null;
    let info: string | null = null;

    if (tabParts.length >= 3) {
      // Third segment = everything between second tab and callsign tab
      // If there are 4 tabs: [first, second, bezirk+info, callsign]
      // If there are 3 tabs: [first, second+bezirk, callsign]
      const thirdPart = tabParts.length >= 4 ? tabParts[2] : null;
      if (thirdPart) {
        // First word might be bezirk code (2-3 uppercase letters or "*")
        const thirdWords = thirdPart.split(/\s+/);
        if (thirdWords[0] && /^[A-Z*]{1,3}$/.test(thirdWords[0])) {
          bezirk_code = thirdWords[0] === '*' ? null : thirdWords[0];
          if (thirdWords.length > 1) {
            info = thirdWords.slice(1).join(' ');
          }
        } else {
          info = thirdPart;
        }
      }
    }

    rows.push({
      callsign,
      suffix,
      name,
      qth,
      bezirk_code,
      locator,
      readability,
      strength,
      db_over_s9,
      repeater_name,
      notstrom: false,
      info,
      bundesland_section: currentBl,
      matched_repeater_id: null,
      is_duplicate: false,
      issues: [],
    });
  }

  return rows;
}

// Preview: parse PDF and return structured data without inserting
importRouter.post('/:id/import-emham', requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Keine Datei hochgeladen' });
      return;
    }

    const parser = new PDFParse({ data: new Uint8Array(req.file.buffer) });
    const textResult = await parser.getText();
    const rows = parseEmHamText(textResult.text);
    await parser.destroy();

    // Match repeaters against exercise's configured repeaters
    const db = getDb();
    const exerciseRepeaters = db.prepare(`
      SELECT er.repeater_id, r.short_name, r.site_name, r.callsign
      FROM exercise_repeaters er
      JOIN repeaters r ON r.id = er.repeater_id
      WHERE er.exercise_id = ?
    `).all(req.params.id) as any[];

    // Load existing reports for duplicate detection
    const existingReports = db.prepare(`
      SELECT sr.operator_id, sr.repeater_id, sr.readability, sr.strength, sr.db_over_s9, o.callsign
      FROM signal_reports sr
      JOIN operators o ON o.id = sr.operator_id
      WHERE sr.exercise_id = ? AND sr.is_op_marker = 0
    `).all(req.params.id) as any[];

    // Build lookup: callsign → list of existing report signatures
    const existingByCallsign = new Map<string, any[]>();
    for (const r of existingReports) {
      const cs = r.callsign.toUpperCase();
      if (!existingByCallsign.has(cs)) existingByCallsign.set(cs, []);
      existingByCallsign.get(cs)!.push(r);
    }

    for (const row of rows) {
      row.issues = [];

      // Try to match repeater
      if (row.repeater_name) {
        const match = exerciseRepeaters.find(er =>
          er.short_name?.toUpperCase() === row.repeater_name ||
          er.site_name?.toUpperCase() === row.repeater_name ||
          er.short_name?.toUpperCase().includes(row.repeater_name!) ||
          row.repeater_name!.includes(er.short_name?.toUpperCase())
        );
        if (match) {
          row.matched_repeater_id = match.repeater_id;
        } else {
          row.issues.push(`Umsetzer "${row.repeater_name}" nicht in Übung gefunden`);
        }
      } else {
        // If there's only one repeater in the exercise (common for BundMode), auto-assign
        if (exerciseRepeaters.length === 1) {
          row.matched_repeater_id = exerciseRepeaters[0].repeater_id;
        } else {
          row.issues.push('Kein Umsetzer angegeben');
        }
      }

      if (!row.readability && !row.strength) {
        row.issues.push('Kein Rapport');
      }

      // Check for duplicates: same callsign + same repeater already exists in this exercise
      if (row.matched_repeater_id) {
        const existing = existingByCallsign.get(row.callsign) || [];
        const isDup = existing.some(e =>
          e.repeater_id === row.matched_repeater_id
        );
        if (isDup) {
          row.is_duplicate = true;
          row.issues.push('Bereits in Übung vorhanden');
        }
      }
    }

    res.json({
      total: rows.length,
      rows,
      exercise_repeaters: exerciseRepeaters.map(er => ({ id: er.repeater_id, name: er.short_name })),
    });
  } catch (err: any) {
    console.error('EmHam import parse error:', err);
    res.status(500).json({ error: 'PDF-Verarbeitung fehlgeschlagen: ' + (err.message || 'Unbekannter Fehler') });
  }
});

// Confirm: insert parsed data
importRouter.post('/:id/import-emham/confirm', requireRole('admin'), (req, res) => {
  const db = getDb();
  const admin = (req as AuthRequest).admin!;
  const exerciseId = req.params.id;
  const { rows, filename } = req.body as { rows: ParsedRow[]; filename?: string };

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'Keine Daten zum Importieren' });
    return;
  }

  // Verify exercise exists
  const exercise = db.prepare('SELECT id FROM exercises WHERE id = ?').get(exerciseId);
  if (!exercise) {
    res.status(404).json({ error: 'Übung nicht gefunden' });
    return;
  }

  // Load existing reports for duplicate detection at confirm time
  const existingReports = db.prepare(`
    SELECT sr.operator_id, sr.repeater_id, o.callsign
    FROM signal_reports sr
    JOIN operators o ON o.id = sr.operator_id
    WHERE sr.exercise_id = ? AND sr.is_op_marker = 0
  `).all(exerciseId) as any[];

  const existingByCallsign = new Map<string, any[]>();
  for (const r of existingReports) {
    const cs = r.callsign.toUpperCase();
    if (!existingByCallsign.has(cs)) existingByCallsign.set(cs, []);
    existingByCallsign.get(cs)!.push(r);
  }

  // Load valid bezirk codes to avoid FK violations
  const validBezirke = new Set(
    (db.prepare('SELECT code FROM bezirke').all() as any[]).map(b => b.code)
  );

  const results: { created: number; skipped: number; duplicates: number; reports: any[] } = { created: 0, skipped: 0, duplicates: 0, reports: [] };

  const importAll = db.transaction(() => {
    for (const row of rows) {
      if (!row.matched_repeater_id) {
        results.skipped++;
        continue;
      }

      // Skip duplicates: same callsign already has a report on this repeater
      const callsign = row.callsign.toUpperCase();
      const existing = existingByCallsign.get(callsign) || [];
      if (existing.some(e => e.repeater_id === row.matched_repeater_id)) {
        results.duplicates++;
        continue;
      }

      // Validate bezirk_code against DB
      const safeBezirk = row.bezirk_code && validBezirke.has(row.bezirk_code) ? row.bezirk_code : null;

      // Get or create operator
      let operator = db.prepare('SELECT * FROM operators WHERE callsign = ?').get(callsign) as any;

      if (!operator) {
        const blCode = callsignToCountryCode(callsign);
        const bzCode = safeBezirk || (row.qth ? qthToBezirkCode(db, row.qth, blCode) : null);
        const result = db.prepare(
          'INSERT INTO operators (callsign, name, qth, bezirk_code, bundesland_code) VALUES (?, ?, ?, ?, ?)'
        ).run(callsign, row.name || null, row.qth || null, bzCode, blCode);
        operator = db.prepare('SELECT * FROM operators WHERE id = ?').get(result.lastInsertRowid);
      } else {
        // Update name/QTH if we have new data and operator doesn't have it
        const updates: string[] = [];
        const params: any[] = [];
        if (row.name && !operator.name) { updates.push('name = ?'); params.push(row.name); }
        if (row.qth && !operator.qth) { updates.push('qth = ?'); params.push(row.qth); }
        if (safeBezirk && !operator.bezirk_code) { updates.push('bezirk_code = ?'); params.push(safeBezirk); }
        if (updates.length > 0) {
          params.push(operator.id);
          db.prepare(`UPDATE operators SET ${updates.join(', ')} WHERE id = ?`).run(...params);
        }
      }

      // Build notes from locator, notstrom, info
      const notesParts: string[] = [];
      if (row.locator) notesParts.push(`Locator: ${row.locator}`);
      if (row.notstrom) notesParts.push('Notstrom');
      if (row.info) notesParts.push(row.info);
      const notes = notesParts.length > 0 ? notesParts.join(', ') : null;

      // Insert signal report
      const reportResult = db.prepare(`
        INSERT INTO signal_reports (exercise_id, operator_id, repeater_id, readability, strength, db_over_s9, notes, entered_by, bezirk_code, suffix)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        exerciseId,
        operator.id,
        row.matched_repeater_id,
        row.readability || null,
        row.strength || null,
        row.db_over_s9 || null,
        notes,
        admin.username,
        safeBezirk || operator.bezirk_code || null,
        row.suffix || null
      );

      // Insert attendance
      db.prepare('INSERT OR IGNORE INTO exercise_attendance (exercise_id, operator_id, entered_by) VALUES (?, ?, ?)')
        .run(exerciseId, operator.id, admin.username);

      // Fetch full report for socket broadcast
      const report = db.prepare(`
        SELECT sr.*, o.callsign, o.name as operator_name, o.qth as operator_qth, sr.bezirk_code, o.bundesland_code,
          r.short_name as repeater_name, r.bundesland_code as repeater_bundesland_code, r.is_linked as repeater_is_linked,
          ep.abbreviation as einstiegspunkt_abbr, ep.site_name as einstiegspunkt_name
        FROM signal_reports sr
        JOIN operators o ON o.id = sr.operator_id
        JOIN repeaters r ON r.id = sr.repeater_id
        LEFT JOIN einstiegspunkte ep ON ep.id = sr.einstiegspunkt_id
        WHERE sr.id = ?
      `).get(reportResult.lastInsertRowid);

      results.reports.push(report);
      results.created++;

      // Track this new report so subsequent rows for the same callsign+repeater are also caught as duplicates
      if (!existingByCallsign.has(callsign)) existingByCallsign.set(callsign, []);
      existingByCallsign.get(callsign)!.push({ operator_id: operator.id, repeater_id: row.matched_repeater_id, callsign });
    }

    // Write import log entry
    db.prepare(`
      INSERT INTO emham_imports (exercise_id, filename, uploaded_by, row_count, created_count, skipped_count, duplicate_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(exerciseId, filename || null, admin.username, rows.length, results.created, results.skipped, results.duplicates);
  });

  importAll();

  console.log(`[import] EmHam import exercise=${exerciseId} by=${admin.username} file=${filename || '?'}: ${results.created} created, ${results.duplicates} duplicates, ${results.skipped} skipped`);

  res.json({
    created: results.created,
    skipped: results.skipped,
    duplicates: results.duplicates,
    reports: results.reports,
  });
});
