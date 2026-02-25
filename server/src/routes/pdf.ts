import { Router } from 'express';
import { getDb } from '../db/database.js';
import { generateAggregatedPdf, generateExercisePdf } from '../services/pdf.js';

export const pdfRouter = Router();

// GET /api/v1/pdf/reports?from=...&to=...&types=...
// Aggregated PDF across a date range
pdfRouter.get('/reports', (req, res) => {
  const { from, to, types } = req.query;
  if (!from || !to) {
    res.status(400).json({ error: 'from und to Parameter erforderlich (YYYY-MM-DD)' });
    return;
  }

  const db = getDb();

  let typeFilter = '';
  const queryParams: any[] = [from, to];
  if (types && typeof types === 'string' && types.trim()) {
    const typeList = types.split(',').map(t => t.trim()).filter(Boolean);
    if (typeList.length > 0) {
      typeFilter = ` AND e.exercise_type IN (${typeList.map(() => '?').join(',')})`;
      queryParams.push(...typeList);
    }
  }

  const exercises = db.prepare(
    `SELECT e.id, e.date, e.name, e.exercise_type,
      (SELECT COUNT(DISTINCT operator_id) FROM signal_reports WHERE exercise_id = e.id AND is_op_marker = 0) as participant_count,
      (SELECT COUNT(*) FROM signal_reports WHERE exercise_id = e.id AND is_op_marker = 0 AND readability IS NOT NULL) as report_count
    FROM exercises e
    WHERE e.date >= ? AND e.date <= ?${typeFilter}
    ORDER BY e.date ASC`
  ).all(...queryParams) as any[];

  if (exercises.length === 0) {
    res.status(404).json({ error: 'Keine Übungen im gewählten Zeitraum' });
    return;
  }

  const ids = exercises.map((e: any) => e.id);
  const placeholders = ids.map(() => '?').join(',');

  const totalParticipants = (db.prepare(
    `SELECT COUNT(DISTINCT operator_id) as c FROM signal_reports WHERE exercise_id IN (${placeholders}) AND is_op_marker = 0`
  ).get(...ids) as any)?.c || 0;

  const totalReports = (db.prepare(
    `SELECT COUNT(*) as c FROM signal_reports WHERE exercise_id IN (${placeholders}) AND is_op_marker = 0 AND readability IS NOT NULL`
  ).get(...ids) as any)?.c || 0;

  const perRepeater = db.prepare(
    `SELECT r.short_name, COUNT(*) as count
    FROM signal_reports sr
    JOIN repeaters r ON r.id = sr.repeater_id
    WHERE sr.exercise_id IN (${placeholders}) AND sr.is_op_marker = 0 AND sr.readability IS NOT NULL
    GROUP BY sr.repeater_id
    ORDER BY count DESC`
  ).all(...ids) as any[];

  const bezirkStats = db.prepare(
    `SELECT bl.name as bundesland, bl.code as bundesland_code, bl.sort_order as bl_sort,
      bz.code as bezirk_code, bz.name as bezirk_name, bz.is_capital,
      COUNT(DISTINCT sr.operator_id) as participants,
      COUNT(CASE WHEN sr.readability IS NOT NULL THEN 1 END) as reports
    FROM signal_reports sr
    JOIN bezirke bz ON bz.code = sr.bezirk_code
    JOIN bundeslaender bl ON bl.code = bz.bundesland_code
    WHERE sr.exercise_id IN (${placeholders}) AND sr.is_op_marker = 0
    GROUP BY bz.code
    ORDER BY bl.sort_order, bz.code`
  ).all(...ids) as any[];

  const blStats = db.prepare(
    `SELECT
      COALESCE(bl.name, 'Sonstige') as bundesland,
      o.bundesland_code,
      COUNT(DISTINCT sr.operator_id) as participants,
      COUNT(CASE WHEN sr.readability IS NOT NULL THEN 1 END) as reports
    FROM signal_reports sr
    JOIN operators o ON o.id = sr.operator_id
    LEFT JOIN bundeslaender bl ON bl.code = o.bundesland_code
    WHERE sr.exercise_id IN (${placeholders}) AND sr.is_op_marker = 0
    GROUP BY o.bundesland_code
    ORDER BY o.bundesland_code`
  ).all(...ids) as any[];

  const participants = db.prepare(
    `SELECT o.callsign, o.name, o.bezirk_code, o.bundesland_code,
      bl.name as bundesland_name,
      COUNT(CASE WHEN sr.readability IS NOT NULL THEN 1 END) as report_count,
      GROUP_CONCAT(DISTINCT sr.suffix) as suffixes
    FROM signal_reports sr
    JOIN operators o ON o.id = sr.operator_id
    LEFT JOIN bundeslaender bl ON bl.code = o.bundesland_code
    WHERE sr.exercise_id IN (${placeholders}) AND sr.is_op_marker = 0
    GROUP BY sr.operator_id
    ORDER BY bl.sort_order, o.bezirk_code, o.callsign`
  ).all(...ids) as any[];

  const stats = { totalParticipants, totalReports, perRepeater, bezirkStats, blStats, participants };

  const pdfDoc = generateAggregatedPdf(exercises, stats, from as string, to as string);

  const filename = `BOS-ARSA_Auswertung_${from}_${to}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  pdfDoc.pipe(res);
});

// GET /api/v1/pdf/exercises/:id
// Single exercise PDF
pdfRouter.get('/exercises/:id', (req, res) => {
  const db = getDb();
  const eid = req.params.id;

  const exercise = db.prepare('SELECT id, date, name, exercise_type FROM exercises WHERE id = ?').get(eid) as any;
  if (!exercise) {
    res.status(404).json({ error: 'Übung nicht gefunden' });
    return;
  }

  const totalParticipants = (db.prepare('SELECT COUNT(DISTINCT operator_id) as c FROM signal_reports WHERE exercise_id = ? AND is_op_marker = 0').get(eid) as any)?.c || 0;
  const totalReports = (db.prepare('SELECT COUNT(*) as c FROM signal_reports WHERE exercise_id = ? AND is_op_marker = 0 AND readability IS NOT NULL').get(eid) as any)?.c || 0;

  const perRepeater = db.prepare(`
    SELECT r.short_name, COUNT(*) as count
    FROM signal_reports sr
    JOIN repeaters r ON r.id = sr.repeater_id
    WHERE sr.exercise_id = ? AND sr.is_op_marker = 0 AND sr.readability IS NOT NULL
    GROUP BY sr.repeater_id
    ORDER BY r.sort_order
  `).all(eid) as any[];

  const bezirkStats = db.prepare(`
    SELECT bl.name as bundesland, bl.code as bundesland_code, bl.sort_order as bl_sort,
      bz.code as bezirk_code, bz.name as bezirk_name, bz.is_capital,
      COUNT(DISTINCT sr.operator_id) as participants,
      COUNT(CASE WHEN sr.readability IS NOT NULL THEN 1 END) as reports
    FROM signal_reports sr
    JOIN bezirke bz ON bz.code = sr.bezirk_code
    JOIN bundeslaender bl ON bl.code = bz.bundesland_code
    WHERE sr.exercise_id = ? AND sr.is_op_marker = 0
    GROUP BY bz.code
    ORDER BY bl.sort_order, bz.code
  `).all(eid) as any[];

  const blStats = db.prepare(`
    SELECT
      COALESCE(bl.name, 'Sonstige') as bundesland,
      o.bundesland_code,
      COUNT(DISTINCT sr.operator_id) as participants,
      COUNT(CASE WHEN sr.readability IS NOT NULL THEN 1 END) as reports
    FROM signal_reports sr
    JOIN operators o ON o.id = sr.operator_id
    LEFT JOIN bundeslaender bl ON bl.code = o.bundesland_code
    WHERE sr.exercise_id = ? AND sr.is_op_marker = 0
    GROUP BY o.bundesland_code
    ORDER BY o.bundesland_code
  `).all(eid) as any[];

  const participants = db.prepare(`
    SELECT o.callsign, o.name, o.bezirk_code, o.bundesland_code, o.home_repeater,
      bl.name as bundesland_name,
      COUNT(CASE WHEN sr.readability IS NOT NULL THEN 1 END) as report_count,
      GROUP_CONCAT(DISTINCT sr.suffix) as suffixes
    FROM signal_reports sr
    JOIN operators o ON o.id = sr.operator_id
    LEFT JOIN bundeslaender bl ON bl.code = o.bundesland_code
    WHERE sr.exercise_id = ? AND sr.is_op_marker = 0
    GROUP BY sr.operator_id
    ORDER BY bl.sort_order, o.bezirk_code, o.callsign
  `).all(eid) as any[];

  const stats = { totalParticipants, totalReports, perRepeater, bezirkStats, blStats, participants };

  const pdfDoc = generateExercisePdf(exercise, stats);

  const filename = `BOS-ARSA_Auswertung_${exercise.date}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  pdfDoc.pipe(res);
});
