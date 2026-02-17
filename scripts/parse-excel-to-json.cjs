#!/usr/bin/env node
/**
 * parse-excel-to-json.js
 *
 * Parses the BOS-ARSA Krisenkommunikationsübung Excel workbook and produces
 * a JSON import file + a text report.
 *
 * Usage: node scripts/parse-excel-to-json.js <xlsx-path> [output-dir]
 *
 * Requires: xlsx (npm install xlsx)
 * Output:   <output-dir>/bosarsa-import.json
 *           <output-dir>/bosarsa-import-report.txt
 */

// Try local xlsx, then fallback to /tmp/xlsx-parse
let XLSX;
try { XLSX = require('xlsx'); } catch (e) {
  XLSX = require('/tmp/xlsx-parse/node_modules/xlsx');
}
const fs = require('fs');
const path = require('path');

// --- Configuration ---

// Excel column → DB repeater mapping
const REPEATER_MAP = {
  15: { id: 265, name: 'Gerlitzen 2m' },
  16: { id: 266, name: 'Gerlitzen 70cm' },
  17: { id: 267, name: 'Magdalensberg linked' },
  18: { id: 226, name: 'Buschberg 70cm' },
  19: { id: 283, name: 'Direkte 145.300' },
  20: { id: 269, name: 'Goldeck 2m' },
  21: { id: 274, name: 'Dobratsch 23cm' },
  22: { id: 278, name: 'Struška 70cm' },
  23: { id: 279, name: 'Hochstuhl 70cm' },
  24: { id: 249, name: 'Zirbitzkogel 70cm' },
  25: { id: 281, name: 'Direkte 145.525' },
};

// Einstiegspunkt abbreviation → DB ID (for repeater 267 only)
// Negative IDs = need to be created
const EP_MAP = {
  'HK': 49, 'hk': 49,
  'GB': 50, 'gb': 50,
  'NBST': 51, 'nbst': 51,
  'JAU': 52, 'Jau': 52, 'jau': 52,
  'FK': 53, 'fk': 53,
  'SCHÖ': 54, 'Schö': 54,
  'LT': 55, 'lt': 55,
  'Telfs': 56,
  'Hochstein': 57, 'HOCHS': 57,
  'Ahorn': 58,
  'MK': 59, 'MGDB': 59, 'Mgdb': 59, 'Magdalensberg': 59,
  'DO': 60, 'do': 60,
  'BR': -1, 'BrR': -1, 'Brentenriegel': -1,
  'PATSCH': -2, 'PaK': -2, 'PK': -2, 'Patschakofel': -2,
  // Callsign-style references to entry points
  '3xwj': 52, '3XWJ': 52, // OE3XWJ = Jauerling
  '2xzr': 50, '2XZR': 50, // OE2XZR = Gaisberg
};

// New einstiegspunkte to create (referenced by negative IDs)
const NEW_EPS = [
  { tempId: -1, repeater_id: 267, site_name: 'Brentenriegel', callsign: 'OE4XUB', abbreviation: 'BR', bundesland_code: '04', sort_order: 13 },
  { tempId: -2, repeater_id: 267, site_name: 'Patscherkofel', callsign: 'OE7XBI', abbreviation: 'PATSCH', bundesland_code: '07', sort_order: 14 },
];

// Bundesland code extraction from "01-Wien" → "01"
function parseBundesland(blStr) {
  if (!blStr) return null;
  const m = String(blStr).match(/^(\d{2})/);
  return m ? m[1] : null;
}

// Extract OP callsign from repeater header
function extractOpCallsign(header) {
  if (!header) return null;
  // "...OP:  OE8HAM" or "...OP: OE8SSR"
  const m = String(header).match(/OP:\s*(\S+)\s*$/);
  if (m) return m[1];
  // "...auf  OE8HAM" or "...auf  OE8OPT und OE8GWQ"
  const m2 = String(header).match(/auf\s+(\S+)/);
  if (m2) return m2[1];
  return null;
}

// --- RST Parser ---

function parseReportCell(rawValue, colIndex) {
  const val = String(rawValue).trim();
  if (!val || val === '0') return [];

  // Split multi-report cells: "5/9+20 HK, 5/9+20 BR, 5/5 JAU"
  const parts = val.split(/,\s*(?=\d|OP)/i);
  const results = [];
  for (const part of parts) {
    const parsed = parseSingleRst(part.trim(), colIndex);
    if (parsed) results.push(parsed);
  }
  return results;
}

function parseSingleRst(raw, colIndex) {
  if (!raw) return null;
  let val = raw;
  let isOp = false;

  // Pure OP
  if (/^OP$/i.test(val)) {
    return { isOp: true, readability: null, strength: null, dbOverS9: null, ep: null, notes: null, original: raw };
  }

  // OP prefix: "OP 5/9++ SCHÖ" or "OP BR"
  if (/^OP\s+/i.test(val)) {
    isOp = true;
    val = val.replace(/^OP\s+/i, '');
  }

  // OP suffix: "5/9+60 GB - OP" or "5/9+60 GB OP"
  if (/\s+-\s*OP$/i.test(val)) {
    isOp = true;
    val = val.replace(/\s+-\s*OP$/i, '');
  } else if (/\s+OP$/i.test(val)) {
    isOp = true;
    val = val.replace(/\s+OP$/i, '');
  }
  // "(OP)" suffix
  if (/\s*\(OP\)\s*$/i.test(val)) {
    isOp = true;
    val = val.replace(/\s*\(OP\)\s*$/i, '');
  }

  // Standard RST: "5/9", "5/9+30", "5/9+30 HK", "5/9++ GB", "5/9+ eR", "5/9-3 HK"
  // IMPORTANT: try \+\d+ BEFORE \+{1,3} so "+60" matches as dB, not just "+"
  // Also handle negative dB: "5/9-9"
  const m = val.match(/^(\d)\/(\d)([+-]\d+|\+{1,3})?\s*(.*)/);
  if (m) {
    const readability = parseInt(m[1]);
    const strength = parseInt(m[2]);
    const dbOverS9 = m[3] || null;
    const suffix = (m[4] || '').trim();

    let ep = null;
    let notes = null;

    if (suffix && colIndex === 17) {
      // For linked repeater, suffix is einstiegspunkt + optional notes
      const parenMatch = suffix.match(/\(.*?\)/);
      let clean = suffix.replace(/\s*\(.*?\)\s*/g, '').trim();
      // Remove trailing location info like "OE2" from "GB OE2"
      clean = clean.replace(/\s+OE\d+$/i, '').trim();
      ep = clean || null;
      if (parenMatch) notes = parenMatch[0];
    } else if (suffix) {
      notes = suffix;
    }

    return { isOp, readability, strength, dbOverS9, ep, notes, original: raw };
  }

  // No-slash format: "579+20 SCHÖ" → best guess R=5, S=9, dB=+20
  const m2 = val.match(/^(\d)(\d)(\d)(\+\d+)\s*(.*)/);
  if (m2) {
    // Treat as R/S/T format: R=first digit, S=last of first 3, dB=+N
    const readability = parseInt(m2[1]);
    const strength = parseInt(m2[3]); // tone position becomes strength (best guess for 579+20)
    const dbOverS9 = m2[4] || null;
    const suffix = (m2[5] || '').trim();
    let ep = (colIndex === 17 && suffix) ? suffix : null;
    let notes = (colIndex !== 17 && suffix) ? suffix : null;
    notes = (notes || '') + ' [parsed from non-standard: ' + raw + ']';
    return { isOp, readability, strength, dbOverS9, ep, notes: notes.trim(), original: raw };
  }

  // OP with just an abbreviation: "BR" after OP was stripped
  if (isOp && val && !val.match(/\d/)) {
    let ep = (colIndex === 17) ? val : null;
    return { isOp: true, readability: null, strength: null, dbOverS9: null, ep, notes: null, original: raw };
  }

  // Unparseable
  return { isOp, readability: null, strength: null, dbOverS9: null, ep: null, notes: raw, original: raw };
}

// --- Main ---

const xlsxPath = process.argv[2];
const outputDir = process.argv[3] || '/tmp';

if (!xlsxPath) {
  console.error('Usage: node parse-excel-to-json.js <xlsx-path> [output-dir]');
  process.exit(1);
}

console.log('Reading Excel:', xlsxPath);
const wb = XLSX.readFile(xlsxPath);
console.log('Sheets:', wb.SheetNames.join(', '));

const exercises = [];
const operatorUpdates = {}; // callsign → { name, qth, ... }
const report = [];
let totalReports = 0;
let totalAttendees = 0;
let parseErrors = [];

for (const sheetName of wb.SheetNames) {
  if (!sheetName.match(/^\d{8}$/)) continue; // Skip non-exercise sheets

  const dateStr = sheetName.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
  console.log(`\nProcessing sheet: ${sheetName} → ${dateStr}`);
  report.push(`\n${'='.repeat(60)}`);
  report.push(`Übung: ${dateStr} (Sheet: ${sheetName})`);
  report.push('='.repeat(60));

  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const header = data[0] || [];

  // Extract OP callsigns from repeater headers
  const repeaterSetup = [];
  for (const [colStr, rep] of Object.entries(REPEATER_MAP)) {
    const col = parseInt(colStr);
    const headerVal = header[col] ? String(header[col]) : '';
    const opCallsign = extractOpCallsign(headerVal);
    repeaterSetup.push({
      repeaterId: rep.id,
      repeaterName: rep.name,
      operatorCallsign: opCallsign,
      headerText: headerVal.substring(0, 80),
    });
  }

  const attendance = [];
  const reports = [];
  let sheetAttendees = 0;
  let sheetReports = 0;
  let sheetOps = 0;
  let sheetMultiCells = 0;
  let sheetUnparsed = 0;
  const perRepeater = {};
  const perEp = {};

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || !row[0]) continue;

    const callsign = String(row[0]).trim().toUpperCase();

    // Skip summary/total rows (callsign is purely numeric)
    if (/^\d+$/.test(callsign)) continue;

    // Skip empty or invalid callsigns
    if (callsign.length < 3) continue;

    const attended = row[3] && parseInt(String(row[3])) > 0;
    if (!attended) continue;

    sheetAttendees++;

    const suffix = row[1] ? String(row[1]).trim() || null : null;
    const name = row[9] ? String(row[9]).trim() || null : null;
    const qth = row[10] ? String(row[10]).trim() || null : null;
    const bezirkCode = row[11] ? String(row[11]).trim() || null : null;
    const bundesland = parseBundesland(row[12] ? String(row[12]) : '');
    const isBosArsa = row[4] ? (parseInt(String(row[4])) || 0) : 0;
    const isArena = row[7] ? (parseInt(String(row[7])) || 0) : 0;
    const isPortable = row[8] ? (parseInt(String(row[8])) || 0) : 0;
    const isExerciseSupport = row[13] ? (parseInt(String(row[13])) || 0) : 0;
    const gender = row[5] ? String(row[5]).trim() || null : null;
    const email = row[6] ? String(row[6]).trim() || null : null;
    const equipment = row[242] ? String(row[242]).trim() || null : null;
    const antenna = row[243] ? String(row[243]).trim() || null : null;
    const hasEmergencyPower = row[244] ? (parseInt(String(row[244])) || 0) : 0;
    const hasLighthouseReadiness = row[245] ? (parseInt(String(row[245])) || 0) : 0;
    const latitude = row[235] ? parseFloat(String(row[235])) || null : null;
    const longitude = row[237] ? parseFloat(String(row[237])) || null : null;

    attendance.push({ callsign, suffix, bezirkCode });

    // Collect operator metadata (use latest sheet's data)
    if (!operatorUpdates[callsign] || name) {
      operatorUpdates[callsign] = {
        callsign, name, qth, bezirkCode, bundeslandCode: bundesland,
        isBosArsa, isArena, isPortable, isExerciseSupport,
        gender, email, equipment, antenna, hasEmergencyPower, hasLighthouseReadiness,
        latitude, longitude,
      };
    }

    // Parse signal reports (columns 15-25)
    for (const [colStr, rep] of Object.entries(REPEATER_MAP)) {
      const col = parseInt(colStr);
      const cellVal = row[col] ? String(row[col]).trim() : '';
      if (!cellVal || cellVal === '0') continue;

      const parsed = parseReportCell(cellVal, col);
      if (parsed.length > 1) sheetMultiCells++;

      for (const r of parsed) {
        // Resolve einstiegspunkt
        let epId = null;
        let epAbbrev = r.ep;
        if (r.ep && col === 17) {
          // Clean the EP abbreviation
          const cleanEp = r.ep.replace(/\s*\(.*?\)/, '').trim();
          if (EP_MAP[cleanEp] !== undefined) {
            epId = EP_MAP[cleanEp];
            epAbbrev = cleanEp;
          } else {
            // Unknown EP — store in notes
            if (!r.notes) r.notes = '';
            r.notes = (r.notes + ' EP:' + cleanEp).trim();
            epAbbrev = cleanEp;
          }
        }

        const reportEntry = {
          callsign,
          repeaterId: rep.id,
          repeaterName: rep.name,
          readability: r.readability,
          strength: r.strength,
          dbOverS9: r.dbOverS9,
          epId,
          epAbbrev,
          isOp: r.isOp ? 1 : 0,
          notes: r.notes,
          original: r.original,
          bezirkCode,
        };

        reports.push(reportEntry);
        sheetReports++;
        if (r.isOp) sheetOps++;
        if (r.readability === null && !r.isOp) sheetUnparsed++;

        // Stats
        const repKey = rep.name;
        perRepeater[repKey] = (perRepeater[repKey] || 0) + 1;
        if (epAbbrev) perEp[epAbbrev] = (perEp[epAbbrev] || 0) + 1;
      }
    }
  }

  totalAttendees += sheetAttendees;
  totalReports += sheetReports;

  exercises.push({
    date: dateStr,
    sheetName,
    name: `Krisenkommunikationsübung ${dateStr}`,
    repeaters: repeaterSetup,
    attendance,
    reports,
  });

  // Report for this sheet
  report.push(`Teilnehmer:    ${sheetAttendees}`);
  report.push(`Rapporte:      ${sheetReports} (davon ${sheetOps} OP-Marker)`);
  report.push(`Multi-Zellen:  ${sheetMultiCells} (Zellen mit mehreren Rapporten)`);
  report.push(`Nicht geparst: ${sheetUnparsed} (kein RST erkannt)`);
  report.push('');
  report.push('Per Umsetzer:');
  for (const [rep, count] of Object.entries(perRepeater).sort((a, b) => b[1] - a[1])) {
    report.push(`  ${rep}: ${count}`);
  }
  if (Object.keys(perEp).length > 0) {
    report.push('');
    report.push('Per Einstiegspunkt (OE-Link):');
    for (const [ep, count] of Object.entries(perEp).sort((a, b) => b[1] - a[1])) {
      const known = EP_MAP[ep] !== undefined;
      report.push(`  ${ep}: ${count}${known ? '' : ' ⚠ UNBEKANNT'}`);
    }
  }
  report.push('');
  report.push('OP-Zuordnung pro Umsetzer:');
  for (const rs of repeaterSetup) {
    report.push(`  ${rs.repeaterName}: ${rs.operatorCallsign || '—'}`);
  }

  if (sheetUnparsed > 0) {
    report.push('');
    report.push('Nicht geparste Zellen:');
    for (const r of reports) {
      if (r.readability === null && !r.isOp) {
        parseErrors.push(`${dateStr} | ${r.callsign} | ${r.repeaterName} | "${r.original}"`);
        report.push(`  ${r.callsign} @ ${r.repeaterName}: "${r.original}"`);
      }
    }
  }
}

// Summary
report.unshift('BOS-ARSA Excel Import — Analysebericht');
report.unshift('');
report.splice(2, 0, `Datum: ${new Date().toISOString().split('T')[0]}`);
report.splice(3, 0, `Quelle: ${path.basename(xlsxPath)}`);
report.splice(4, 0, '');
report.splice(5, 0, '--- ZUSAMMENFASSUNG ---');
report.splice(6, 0, `Übungen:          ${exercises.length}`);
report.splice(7, 0, `Teilnehmer total: ${totalAttendees} (über alle Übungen, mit Duplikaten)`);
report.splice(8, 0, `Rapporte total:   ${totalReports}`);
report.splice(9, 0, `Operatoren:       ${Object.keys(operatorUpdates).length} (eindeutige Rufzeichen)`);
report.splice(10, 0, `Nicht geparst:    ${parseErrors.length}`);
report.splice(11, 0, '');

if (parseErrors.length > 0) {
  report.push('');
  report.push('='.repeat(60));
  report.push('ALLE NICHT GEPARSTEN EINTRÄGE');
  report.push('='.repeat(60));
  for (const e of parseErrors) {
    report.push('  ' + e);
  }
}

// New einstiegspunkte needed
const neededEps = new Set();
for (const ex of exercises) {
  for (const r of ex.reports) {
    if (r.epId && r.epId < 0) neededEps.add(r.epId);
  }
}
const newEps = NEW_EPS.filter(ep => neededEps.has(ep.tempId));

report.push('');
report.push('='.repeat(60));
report.push('NEUE EINSTIEGSPUNKTE (werden angelegt)');
report.push('='.repeat(60));
if (newEps.length === 0) {
  report.push('  Keine');
} else {
  for (const ep of newEps) {
    report.push(`  ${ep.abbreviation} — ${ep.site_name} (${ep.callsign}, BL: ${ep.bundesland_code})`);
  }
}

// Write output
const importData = {
  generatedAt: new Date().toISOString(),
  sourceFile: path.basename(xlsxPath),
  newEinstiegspunkte: newEps,
  operatorUpdates,
  exercises,
};

const jsonPath = path.join(outputDir, 'bosarsa-import.json');
const reportPath = path.join(outputDir, 'bosarsa-import-report.txt');

fs.writeFileSync(jsonPath, JSON.stringify(importData, null, 2));
fs.writeFileSync(reportPath, report.join('\n'));

console.log(`\nDone! Written:`);
console.log(`  JSON:   ${jsonPath} (${(fs.statSync(jsonPath).size / 1024).toFixed(0)} KB)`);
console.log(`  Report: ${reportPath}`);
console.log(`\nSummary: ${exercises.length} exercises, ${totalAttendees} attendees, ${totalReports} reports, ${parseErrors.length} unparsed`);
