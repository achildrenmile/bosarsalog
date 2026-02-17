#!/usr/bin/env node
/**
 * import-json-to-db.cjs
 *
 * Imports parsed Excel data (from parse-excel-to-json.cjs) into the SQLite DB.
 * Runs inside Docker container (has better-sqlite3 available).
 *
 * Usage: node /tmp/import-json-to-db.cjs /tmp/bosarsa-import.json [db-path]
 */

let Database;
try { Database = require('better-sqlite3'); } catch (e) {
  Database = require('/app/node_modules/better-sqlite3');
}
const crypto = require('crypto');
const fs = require('fs');

const jsonPath = process.argv[2] || '/tmp/bosarsa-import.json';
const dbPath = process.argv[3] || '/data/bosarsalog.db';

console.log('Reading import data:', jsonPath);
const importData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

console.log('Opening database:', dbPath);
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const report = [];
const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

report.push('BOS-ARSA Excel Import — Datenbankbericht');
report.push(`Datum: ${now}`);
report.push(`Quelle: ${importData.sourceFile}`);
report.push('');

// --- Build valid FK lookup sets ---
const validBezirke = new Set(db.prepare('SELECT code FROM bezirke').all().map(r => r.code));
const validBundeslaender = new Set(db.prepare('SELECT code FROM bundeslaender').all().map(r => r.code));

function safeBlCode(code) { return (code && validBundeslaender.has(code)) ? code : null; }
function safeBzCode(code) { return (code && validBezirke.has(code)) ? code : null; }

// --- Step 1: Create missing einstiegspunkte ---

report.push('--- EINSTIEGSPUNKTE ---');
const epIdMap = {};

for (const ep of importData.newEinstiegspunkte) {
  const existing = db.prepare(
    'SELECT id FROM einstiegspunkte WHERE repeater_id = ? AND abbreviation = ?'
  ).get(ep.repeater_id, ep.abbreviation);

  if (existing) {
    epIdMap[ep.tempId] = existing.id;
    report.push(`  ${ep.abbreviation} (${ep.site_name}): bereits vorhanden (ID ${existing.id})`);
  } else {
    const result = db.prepare(`
      INSERT INTO einstiegspunkte (repeater_id, site_name, callsign, abbreviation, bundesland_code, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(ep.repeater_id, ep.site_name, ep.callsign, ep.abbreviation, ep.bundesland_code, ep.sort_order);
    epIdMap[ep.tempId] = Number(result.lastInsertRowid);
    report.push(`  ${ep.abbreviation} (${ep.site_name}): NEU angelegt (ID ${result.lastInsertRowid})`);
  }
}
report.push('');

// --- Step 2: Build operator lookup ---

console.log('Building operator lookup...');
const allOperators = db.prepare('SELECT id, callsign FROM operators').all();
const operatorMap = {};
for (const op of allOperators) {
  operatorMap[op.callsign.toUpperCase()] = op.id;
}
console.log(`  ${allOperators.length} operators in DB`);

const insertOperator = db.prepare(`
  INSERT INTO operators (callsign, name, qth, bezirk_code, bundesland_code,
    is_bos_arsa, is_arena, is_portable, is_exercise_support,
    gender, email, equipment, antenna, has_emergency_power, has_lighthouse_readiness,
    latitude, longitude, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// --- Step 3: Process each exercise ---

let grandTotalReports = 0;
let grandTotalAttendees = 0;
let grandTotalNewOperators = 0;
let grandTotalClearedReports = 0;
let grandTotalMerged = 0;

for (const exercise of importData.exercises) {
  console.log(`\nProcessing: ${exercise.date} (${exercise.name})`);
  report.push('='.repeat(60));
  report.push(`Übung: ${exercise.date} — ${exercise.name}`);
  report.push('='.repeat(60));

  // Find existing exercise by date
  let ex = db.prepare('SELECT * FROM exercises WHERE date = ?').get(exercise.date);

  if (!ex) {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO exercises (id, name, date, notes, created_at, oe_link_enabled)
      VALUES (?, ?, ?, ?, ?, 1)
    `).run(id, exercise.name, exercise.date, `Importiert aus Excel am ${now}`, now);
    ex = db.prepare('SELECT * FROM exercises WHERE id = ?').get(id);
    report.push(`  Übung NEU angelegt: ${ex.id}`);
  } else {
    report.push(`  Übung gefunden: ${ex.id} (${ex.name})`);
    if (ex.name.startsWith('Testdaten')) {
      db.prepare('UPDATE exercises SET name = ?, notes = ? WHERE id = ?')
        .run(exercise.name, `Importiert aus Excel am ${now} (vorher: ${ex.name})`, ex.id);
      report.push(`  Umbenannt: "${ex.name}" → "${exercise.name}"`);
    } else {
      db.prepare('UPDATE exercises SET notes = ? WHERE id = ?')
        .run(`Importiert aus Excel am ${now}`, ex.id);
    }
  }

  const exerciseId = ex.id;

  // Clear existing data
  const clearedReports = db.prepare('DELETE FROM signal_reports WHERE exercise_id = ?').run(exerciseId).changes;
  const clearedAttendance = db.prepare('DELETE FROM exercise_attendance WHERE exercise_id = ?').run(exerciseId).changes;
  const clearedRepeaters = db.prepare('DELETE FROM exercise_repeaters WHERE exercise_id = ?').run(exerciseId).changes;
  grandTotalClearedReports += clearedReports;

  if (clearedReports > 0 || clearedAttendance > 0) {
    report.push(`  Bestehende Daten gelöscht: ${clearedReports} Rapporte, ${clearedAttendance} Teilnahmen, ${clearedRepeaters} Umsetzer-Zuordnungen`);
  }

  db.prepare('UPDATE exercises SET oe_link_enabled = 1 WHERE id = ?').run(exerciseId);

  // Insert exercise_repeaters
  const insertExRep = db.prepare('INSERT OR IGNORE INTO exercise_repeaters (exercise_id, repeater_id, operator_callsign) VALUES (?, ?, ?)');
  for (const rep of exercise.repeaters) {
    insertExRep.run(exerciseId, rep.repeaterId, rep.operatorCallsign);
  }
  report.push(`  Umsetzer zugeordnet: ${exercise.repeaters.length}`);

  // Prepare statements
  const insertAttendance = db.prepare(
    'INSERT OR IGNORE INTO exercise_attendance (exercise_id, operator_id, callsign_suffix, is_present, entered_by) VALUES (?, ?, ?, 1, ?)'
  );
  const insertReport = db.prepare(`
    INSERT INTO signal_reports (exercise_id, operator_id, repeater_id, readability, strength,
      db_over_s9, einstiegspunkt_id, is_op_marker, notes, entered_by, bezirk_code, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateReportNotes = db.prepare(`
    UPDATE signal_reports SET notes = ?, is_op_marker = CASE WHEN is_op_marker = 1 THEN 1 ELSE ? END,
      einstiegspunkt_id = COALESCE(einstiegspunkt_id, ?)
    WHERE exercise_id = ? AND operator_id = ? AND repeater_id = ?
  `);

  let exAttendees = 0;
  let exReports = 0;
  let exNewOps = 0;
  let exOpMarkers = 0;
  let exMerged = 0;
  const exPerRepeater = {};
  const exPerEp = {};
  const exMissingOps = [];

  // Group reports by callsign
  const reportsByCallsign = {};
  for (const r of exercise.reports) {
    if (!reportsByCallsign[r.callsign]) reportsByCallsign[r.callsign] = [];
    reportsByCallsign[r.callsign].push(r);
  }

  for (const att of exercise.attendance) {
    const cs = att.callsign;

    // Find or create operator
    let operatorId = operatorMap[cs];
    if (!operatorId) {
      const altCs = cs.replace('/', '');
      operatorId = operatorMap[altCs];
    }

    if (!operatorId) {
      const opData = importData.operatorUpdates[cs] || {};
      try {
        const result = insertOperator.run(
          cs,
          opData.name || null,
          opData.qth || null,
          safeBzCode(opData.bezirkCode),
          safeBlCode(opData.bundeslandCode),
          opData.isBosArsa || 0,
          opData.isArena || 0,
          opData.isPortable || 0,
          opData.isExerciseSupport || 0,
          opData.gender || null,
          opData.email || null,
          opData.equipment || null,
          opData.antenna || null,
          opData.hasEmergencyPower || 0,
          opData.hasLighthouseReadiness || 0,
          opData.latitude || null,
          opData.longitude || null,
          now, now
        );
        operatorId = Number(result.lastInsertRowid);
        operatorMap[cs] = operatorId;
        exNewOps++;
        exMissingOps.push(cs);
      } catch (e) {
        if (e.message && e.message.includes('UNIQUE')) {
          const found = db.prepare('SELECT id FROM operators WHERE callsign = ?').get(cs);
          if (found) {
            operatorId = found.id;
            operatorMap[cs] = operatorId;
          } else {
            report.push(`  FEHLER: Operator ${cs} nicht erstellbar: ${e.message}`);
            continue;
          }
        } else {
          report.push(`  FEHLER: Operator ${cs} nicht erstellbar: ${e.message}`);
          continue;
        }
      }
    }

    // Insert attendance
    try {
      insertAttendance.run(exerciseId, operatorId, att.suffix, 'excel-import');
    } catch (e) { /* duplicate, ignore */ }
    exAttendees++;

    // Insert reports — handle UNIQUE constraint for multi-EP cells
    // Group this operator's reports by repeater to detect duplicates
    const opReports = reportsByCallsign[cs] || [];
    const byRepeater = {};
    for (const r of opReports) {
      const key = r.repeaterId;
      if (!byRepeater[key]) byRepeater[key] = [];
      byRepeater[key].push(r);
    }

    for (const [repIdStr, reps] of Object.entries(byRepeater)) {
      // First report goes as main insert, subsequent ones get merged into notes
      const primary = reps[0];
      const extras = reps.slice(1);

      let epId = null;
      if (primary.epId) {
        epId = primary.epId < 0 ? (epIdMap[primary.epId] || null) : primary.epId;
      }

      // Build notes
      let notes = '';
      if (primary.notes) notes += primary.notes + ' ';
      notes += `[Excel: "${primary.original}"]`;

      // Merge extra reports into notes
      if (extras.length > 0) {
        exMerged += extras.length;
        for (const extra of extras) {
          notes += ` | ${extra.original}`;
          // If extra has EP and primary doesn't, use it
          if (!epId && extra.epId) {
            epId = extra.epId < 0 ? (epIdMap[extra.epId] || null) : extra.epId;
          }
        }
      }
      notes = notes.trim();

      // Determine if any report is OP
      const isOp = reps.some(r => r.isOp) ? 1 : 0;

      // Validate bezirk_code
      const bzCode = safeBzCode(primary.bezirkCode);

      try {
        insertReport.run(
          exerciseId, operatorId, parseInt(repIdStr),
          primary.readability, primary.strength, primary.dbOverS9,
          epId, isOp, notes, 'excel-import', bzCode, now, now
        );
        exReports++;
        if (isOp) exOpMarkers++;

        const repKey = primary.repeaterName;
        exPerRepeater[repKey] = (exPerRepeater[repKey] || 0) + 1;
        // Count all EPs including from merged reports
        for (const r of reps) {
          if (r.epAbbrev) exPerEp[r.epAbbrev] = (exPerEp[r.epAbbrev] || 0) + 1;
        }
      } catch (e) {
        report.push(`  FEHLER: Rapport ${cs} @ ${primary.repeaterName}: ${e.message}`);
      }
    }
  }

  grandTotalAttendees += exAttendees;
  grandTotalReports += exReports;
  grandTotalNewOperators += exNewOps;
  grandTotalMerged += exMerged;

  report.push(`  Teilnehmer:     ${exAttendees}`);
  report.push(`  Rapporte:       ${exReports} (davon ${exOpMarkers} OP-Marker)`);
  if (exMerged > 0) {
    report.push(`  Zusammengeführt: ${exMerged} Multi-EP-Rapporte in Notes integriert`);
  }
  if (exNewOps > 0) {
    report.push(`  Neue Operatoren: ${exNewOps}: ${exMissingOps.join(', ')}`);
  }
  report.push('');
  report.push('  Per Umsetzer:');
  for (const [rep, count] of Object.entries(exPerRepeater).sort((a, b) => b[1] - a[1])) {
    report.push(`    ${rep}: ${count}`);
  }
  if (Object.keys(exPerEp).length > 0) {
    report.push('  Per Einstiegspunkt:');
    for (const [ep, count] of Object.entries(exPerEp).sort((a, b) => b[1] - a[1])) {
      report.push(`    ${ep}: ${count}`);
    }
  }
  report.push('');
}

// --- Step 4: Update operator metadata ---

report.push('='.repeat(60));
report.push('OPERATOREN-METADATEN UPDATE');
report.push('='.repeat(60));

let updatedOps = 0;
const updateFields = [
  { json: 'equipment', sql: 'equipment' },
  { json: 'antenna', sql: 'antenna' },
  { json: 'gender', sql: 'gender' },
  { json: 'hasEmergencyPower', sql: 'has_emergency_power' },
  { json: 'hasLighthouseReadiness', sql: 'has_lighthouse_readiness' },
  { json: 'isBosArsa', sql: 'is_bos_arsa' },
  { json: 'isArena', sql: 'is_arena' },
  { json: 'isPortable', sql: 'is_portable' },
  { json: 'isExerciseSupport', sql: 'is_exercise_support' },
  { json: 'latitude', sql: 'latitude' },
  { json: 'longitude', sql: 'longitude' },
];

for (const [cs, opData] of Object.entries(importData.operatorUpdates)) {
  const operatorId = operatorMap[cs];
  if (!operatorId) continue;

  const current = db.prepare('SELECT * FROM operators WHERE id = ?').get(operatorId);
  if (!current) continue;

  const updates = [];
  const params = [];

  for (const field of updateFields) {
    const newVal = opData[field.json];
    const curVal = current[field.sql];
    if (newVal && !curVal) {
      updates.push(`${field.sql} = ?`);
      params.push(newVal);
    }
  }

  if (updates.length > 0) {
    updates.push("updated_at = ?");
    params.push(now);
    params.push(operatorId);
    db.prepare(`UPDATE operators SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    updatedOps++;
  }
}

report.push(`  ${updatedOps} Operatoren mit neuen Metadaten aktualisiert (nur leere Felder befüllt)`);
report.push('');

// --- Summary (prepended) ---

const summaryLines = [
  'BOS-ARSA Excel Import — DB-Importbericht',
  `Datum: ${now}`,
  `Datenbank: ${dbPath}`,
  '',
  '--- ZUSAMMENFASSUNG ---',
  `Übungen verarbeitet:    ${importData.exercises.length}`,
  `Teilnehmer importiert:  ${grandTotalAttendees}`,
  `Rapporte importiert:    ${grandTotalReports}`,
  `Multi-EP zusammengeführt: ${grandTotalMerged}`,
  `Neue Operatoren:        ${grandTotalNewOperators}`,
  `Gelöschte Alt-Rapporte: ${grandTotalClearedReports}`,
  `Operatoren aktualisiert: ${updatedOps}`,
  '',
];
report.splice(0, 4, ...summaryLines);

// Verification
report.push('='.repeat(60));
report.push('VERIFIZIERUNG');
report.push('='.repeat(60));

for (const exercise of importData.exercises) {
  const exv = db.prepare('SELECT * FROM exercises WHERE date = ?').get(exercise.date);
  if (!exv) { report.push(`  ${exercise.date}: FEHLER — Übung nicht gefunden!`); continue; }
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(DISTINCT operator_id) FROM signal_reports WHERE exercise_id = ?) as participants,
      (SELECT COUNT(*) FROM signal_reports WHERE exercise_id = ?) as total_reports,
      (SELECT COUNT(*) FROM signal_reports WHERE exercise_id = ? AND readability IS NOT NULL) as with_rst,
      (SELECT COUNT(*) FROM signal_reports WHERE exercise_id = ? AND is_op_marker = 1) as ops,
      (SELECT COUNT(*) FROM exercise_attendance WHERE exercise_id = ?) as attendance
  `).get(exv.id, exv.id, exv.id, exv.id, exv.id);
  report.push(`  ${exercise.date}: ${stats.attendance} Teilnehmer, ${stats.total_reports} Rapporte (${stats.with_rst} mit RST, ${stats.ops} OPs), ${stats.participants} eindeutige Operatoren`);
}

report.push('');
report.push('Import abgeschlossen.');

// Write report
const reportPath = '/tmp/bosarsa-db-import-report.txt';
fs.writeFileSync(reportPath, report.join('\n'));
console.log(`\nImport complete! Report: ${reportPath}`);
console.log(`Summary: ${grandTotalAttendees} attendees, ${grandTotalReports} reports, ${grandTotalNewOperators} new operators, ${grandTotalMerged} merged, ${grandTotalClearedReports} cleared`);
