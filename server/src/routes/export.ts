import { Router } from 'express';
import { getDb } from '../db/database.js';

export const exportRouter = Router();

// Bund export (Bundesland-grouped)
exportRouter.get('/exercises/:id/bund', (req, res) => {
  const db = getDb();
  const exercise = db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id) as any;
  if (!exercise) { res.status(404).json({ error: 'Nicht gefunden' }); return; }

  const reports = db.prepare(`
    SELECT sr.*, o.callsign, o.bezirk_code, o.bundesland_code,
      bl.name as bundesland_name, bz.name as bezirk_name,
      r.short_name as repeater_name,
      ep.abbreviation as ep_abbr
    FROM signal_reports sr
    JOIN operators o ON o.id = sr.operator_id
    JOIN repeaters r ON r.id = sr.repeater_id
    LEFT JOIN bundeslaender bl ON bl.code = o.bundesland_code
    LEFT JOIN bezirke bz ON bz.code = o.bezirk_code
    LEFT JOIN einstiegspunkte ep ON ep.id = sr.einstiegspunkt_id
    WHERE sr.exercise_id = ? AND sr.is_op_marker = 0
    ORDER BY bl.sort_order, bz.code, o.callsign
  `).all(req.params.id) as any[];

  let text = `BOS-ARSA Krisenkommunikationsübung — ${exercise.date}\n`;
  text += `Auswertung nach Bundesland\n`;
  text += '='.repeat(60) + '\n\n';

  let currentBl = '';
  let currentBz = '';
  for (const r of reports) {
    if (r.bundesland_name !== currentBl) {
      currentBl = r.bundesland_name || 'Sonstige';
      text += `\n── ${currentBl} ──\n`;
      currentBz = '';
    }
    if (r.bezirk_code !== currentBz) {
      currentBz = r.bezirk_code || '??';
      text += `  [${currentBz}] ${r.bezirk_name || ''}\n`;
    }
    const rapport = r.readability && r.strength
      ? `${r.readability}/${r.strength}${r.db_over_s9 || ''}`
      : '—';
    const ep = r.ep_abbr ? ` ${r.ep_abbr}` : '';
    text += `    ${r.callsign.padEnd(10)} ${r.repeater_name.padEnd(20)} ${rapport}${ep}\n`;
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bos-arsa-bund-${exercise.date}.txt"`);
  res.send(text);
});

// Land export (Repeater-grouped)
exportRouter.get('/exercises/:id/land', (req, res) => {
  const db = getDb();
  const exercise = db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id) as any;
  if (!exercise) { res.status(404).json({ error: 'Nicht gefunden' }); return; }

  const reports = db.prepare(`
    SELECT sr.*, o.callsign, o.bezirk_code, o.bundesland_code,
      bl.name as bundesland_name, bz.name as bezirk_name,
      r.short_name as repeater_name, r.sort_order as rep_sort,
      ep.abbreviation as ep_abbr
    FROM signal_reports sr
    JOIN operators o ON o.id = sr.operator_id
    JOIN repeaters r ON r.id = sr.repeater_id
    LEFT JOIN bundeslaender bl ON bl.code = o.bundesland_code
    LEFT JOIN bezirke bz ON bz.code = o.bezirk_code
    LEFT JOIN einstiegspunkte ep ON ep.id = sr.einstiegspunkt_id
    WHERE sr.exercise_id = ? AND sr.is_op_marker = 0
    ORDER BY r.sort_order, bl.sort_order, bz.code, o.callsign
  `).all(req.params.id) as any[];

  let text = `BOS-ARSA Krisenkommunikationsübung — ${exercise.date}\n`;
  text += `Auswertung nach Umsetzer\n`;
  text += '='.repeat(60) + '\n\n';

  let currentRep = '';
  let currentBz = '';
  for (const r of reports) {
    if (r.repeater_name !== currentRep) {
      currentRep = r.repeater_name;
      text += `\n══ ${currentRep} ══\n`;
      currentBz = '';
    }
    if (r.bezirk_code !== currentBz) {
      currentBz = r.bezirk_code || '??';
      text += `  [${currentBz}] ${r.bezirk_name || ''}\n`;
    }
    const rapport = r.readability && r.strength
      ? `${r.readability}/${r.strength}${r.db_over_s9 || ''}`
      : '—';
    const ep = r.ep_abbr ? ` ${r.ep_abbr}` : '';
    text += `    ${r.callsign.padEnd(10)} ${rapport}${ep}\n`;
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bos-arsa-land-${exercise.date}.txt"`);
  res.send(text);
});

// Combined export
exportRouter.get('/exercises/:id/combined', (req, res) => {
  const db = getDb();
  const exercise = db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id) as any;
  if (!exercise) { res.status(404).json({ error: 'Nicht gefunden' }); return; }

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(DISTINCT operator_id) FROM exercise_attendance WHERE exercise_id = ? AND is_present = 1) as participants,
      (SELECT COUNT(*) FROM signal_reports WHERE exercise_id = ? AND is_op_marker = 0) as reports
  `).get(req.params.id, req.params.id) as any;

  const perRepeater = db.prepare(`
    SELECT r.short_name, COUNT(*) as count
    FROM signal_reports sr
    JOIN repeaters r ON r.id = sr.repeater_id
    WHERE sr.exercise_id = ? AND sr.is_op_marker = 0
    GROUP BY sr.repeater_id ORDER BY r.sort_order
  `).all(req.params.id) as any[];

  let text = `BOS-ARSA Krisenkommunikationsübung — ${exercise.date}\n`;
  text += '='.repeat(60) + '\n';
  text += `Teilnehmer: ${stats.participants}\n`;
  text += `Rapporte gesamt: ${stats.reports}\n\n`;
  text += 'Pro Umsetzer:\n';
  for (const r of perRepeater) {
    text += `  ${r.short_name.padEnd(25)} ${r.count}\n`;
  }
  text += '\n';

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bos-arsa-combined-${exercise.date}.txt"`);
  res.send(text);
});
