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

function parseRapport(raw: string): { readability: number | null; strength: number | null; db_over_s9: string | null } {
  if (!raw || !raw.trim()) return { readability: null, strength: null, db_over_s9: null };
  const s = raw.trim();
  // Formats: "5/9", "5/8", "5/9 10" (= +10dB), "5/9 60" (= +60dB), "5/9+20"
  const m = s.match(/^(\d)\/(\d)\s*\+?\s*(\d+)?$/);
  if (!m) return { readability: null, strength: null, db_over_s9: null };
  return {
    readability: parseInt(m[1]),
    strength: parseInt(m[2]),
    db_over_s9: m[3] ? `+${m[3]}` : null,
  };
}

function parseCallsign(raw: string): { callsign: string; suffix: string | null } {
  const s = raw.trim().toUpperCase();
  // Handle "OE1MVA / portabel" or "OE1MVA/P" etc.
  const portabelMatch = s.match(/^(\S+)\s*\/\s*(?:PORTABEL|PORT|PORTABLE)$/i);
  if (portabelMatch) {
    return { callsign: portabelMatch[1], suffix: '/p' };
  }
  const slashMatch = s.match(/^(\S+)\s*\/\s*(\S+)$/);
  if (slashMatch) {
    return { callsign: slashMatch[1], suffix: `/${slashMatch[2].toLowerCase()}` };
  }
  return { callsign: s, suffix: null };
}

function parseEmHamText(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split('\n');
  let currentBl = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip headers, totals, page numbers
    if (/^(Gesamt|Rufzeichen|Callsign|Vor-|Seite|\d+\s*$|Stand:|Krisenkommunikations|EmHam|Teilnehmer)/i.test(line)) continue;
    if (/^[-=]+$/.test(line)) continue;

    // Detect Bundesland section headers: "OE1 - Wien" or "OE1-Wien" or just "OE1"
    const blMatch = line.match(/^(OE\d)\s*[-–—]\s*(.+)$/);
    if (blMatch) {
      currentBl = blMatch[1];
      continue;
    }
    // Also match standalone "OE1" etc. at start
    const blSimple = line.match(/^(OE\d)$/);
    if (blSimple) {
      currentBl = blSimple[1];
      continue;
    }

    // Try to parse a data row
    // Callsign starts with letter pattern typical for ham calls
    if (!/^[A-Z0-9]{2,}/.test(line)) continue;

    // Split on multiple spaces (2+) to get columns
    // But also handle tab-separated
    const parts = line.split(/\t|\s{2,}/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;

    // First part is always callsign (possibly with suffix)
    const { callsign, suffix } = parseCallsign(parts[0]);

    // Skip if doesn't look like a valid callsign
    if (!/^[A-Z0-9]{3,}$/.test(callsign)) continue;

    // Try to identify the remaining fields
    // Typical order: Name, QTH, BezKen, Locator, Rapport, Repeater, Notstrom, Info
    // But fields can be empty, so we need heuristics
    let name: string | null = null;
    let qth: string | null = null;
    let bezirk_code: string | null = null;
    let locator: string | null = null;
    let rapportStr = '';
    let repeater_name: string | null = null;
    let notstrom = false;
    let info: string | null = null;

    // Work through remaining parts with pattern matching
    const remaining = parts.slice(1);
    const consumed = new Array(remaining.length).fill(false);

    // Find rapport (digit/digit pattern)
    for (let j = 0; j < remaining.length; j++) {
      if (/^\d\/\d(\s*\+?\s*\d+)?$/.test(remaining[j])) {
        rapportStr = remaining[j];
        consumed[j] = true;
        break;
      }
    }

    // Find locator (JN/JO + alphanumeric)
    for (let j = 0; j < remaining.length; j++) {
      if (!consumed[j] && /^J[NO]\d{2}[A-Z]{2}/i.test(remaining[j])) {
        locator = remaining[j].toUpperCase();
        consumed[j] = true;
        break;
      }
    }

    // Find bezirk code (2-3 uppercase letters, common Austrian bezirk codes)
    for (let j = 0; j < remaining.length; j++) {
      if (!consumed[j] && /^[A-Z]{2,3}$/.test(remaining[j]) && remaining[j].length <= 3) {
        // Check if it looks like a bezirk code (not a repeater name which is longer/mixed)
        const candidate = remaining[j];
        if (/^[A-Z]{2,3}$/.test(candidate) && !/^(JA|JO|JN)$/.test(candidate)) {
          bezirk_code = candidate;
          consumed[j] = true;
          break;
        }
      }
    }

    // Find Notstrom
    for (let j = 0; j < remaining.length; j++) {
      if (!consumed[j] && /^(ja|yes|x|notstrom)$/i.test(remaining[j])) {
        notstrom = true;
        consumed[j] = true;
        break;
      }
    }

    // Find repeater name (all caps, usually a site name like HERMANNSKOGEL, KAHLENBERG etc.)
    for (let j = 0; j < remaining.length; j++) {
      if (!consumed[j] && /^[A-ZÄÖÜ][A-ZÄÖÜa-zäöü\s-]{3,}$/i.test(remaining[j]) && remaining[j].length >= 4) {
        // Check if it looks like a repeater name (not a person name which comes earlier)
        // Repeater names tend to be after the rapport
        const rapportIdx = remaining.findIndex(r => /^\d\/\d/.test(r));
        if (rapportIdx >= 0 && j > rapportIdx) {
          repeater_name = remaining[j].toUpperCase();
          consumed[j] = true;
          break;
        }
      }
    }

    // Remaining unconsumed parts before rapport are name/QTH
    // After rapport and repeater are info
    const rapportIdx = remaining.findIndex(r => /^\d\/\d/.test(r));
    const unconsumedBefore: string[] = [];
    const unconsumedAfter: string[] = [];
    for (let j = 0; j < remaining.length; j++) {
      if (consumed[j]) continue;
      if (rapportIdx >= 0 && j < rapportIdx) {
        unconsumedBefore.push(remaining[j]);
      } else if (rapportIdx >= 0 && j > rapportIdx) {
        unconsumedAfter.push(remaining[j]);
      } else if (rapportIdx < 0) {
        unconsumedBefore.push(remaining[j]);
      }
    }

    // First unconsumed before rapport = name, second = QTH
    if (unconsumedBefore.length >= 1) name = unconsumedBefore[0];
    if (unconsumedBefore.length >= 2) qth = unconsumedBefore[1];

    // Unconsumed after rapport = info
    if (unconsumedAfter.length > 0) {
      info = unconsumedAfter.join(' ');
    }

    const { readability, strength, db_over_s9 } = parseRapport(rapportStr);

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
      notstrom,
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

      // Get or create operator
      let operator = db.prepare('SELECT * FROM operators WHERE callsign = ?').get(callsign) as any;

      if (!operator) {
        const blCode = callsignToCountryCode(callsign);
        const bzCode = row.bezirk_code || (row.qth ? qthToBezirkCode(db, row.qth, blCode) : null);
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
        if (row.bezirk_code && !operator.bezirk_code) { updates.push('bezirk_code = ?'); params.push(row.bezirk_code); }
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
        row.bezirk_code || operator.bezirk_code || null,
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
