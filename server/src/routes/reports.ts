import { Router } from 'express';
import { getDb } from '../db/database.js';

export const reportsRouter = Router();

// Aggregated stats across a date range
reportsRouter.get('/stats', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    res.status(400).json({ error: 'from und to Parameter erforderlich (YYYY-MM-DD)' });
    return;
  }

  const db = getDb();

  // Fetch exercises in date range
  const exercises = db.prepare(
    `SELECT e.id, e.date, e.name, e.oe_link_enabled,
      (SELECT COUNT(DISTINCT operator_id) FROM signal_reports WHERE exercise_id = e.id AND is_op_marker = 0) as participant_count,
      (SELECT COUNT(*) FROM signal_reports WHERE exercise_id = e.id AND is_op_marker = 0 AND readability IS NOT NULL) as report_count
    FROM exercises e
    WHERE e.date >= ? AND e.date <= ?
    ORDER BY e.date ASC`
  ).all(from, to) as any[];

  if (exercises.length === 0) {
    res.json({
      exercises: [],
      stats: { totalParticipants: 0, totalReports: 0, perRepeater: [], bezirkStats: [], blStats: [], participants: [] },
    });
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
  ).all(...ids);

  const bezirkStats = db.prepare(
    `SELECT bl.name as bundesland, bl.code as bundesland_code, bl.sort_order as bl_sort,
      bz.code as bezirk_code, bz.name as bezirk_name, bz.is_capital,
      COUNT(DISTINCT sr.operator_id) as participants,
      COUNT(CASE WHEN sr.readability IS NOT NULL THEN 1 END) as reports
    FROM signal_reports sr
    JOIN operators o ON o.id = sr.operator_id
    JOIN bezirke bz ON bz.code = o.bezirk_code
    JOIN bundeslaender bl ON bl.code = bz.bundesland_code
    WHERE sr.exercise_id IN (${placeholders}) AND sr.is_op_marker = 0
    GROUP BY bz.code
    ORDER BY bl.sort_order, bz.code`
  ).all(...ids);

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
  ).all(...ids);

  const participants = db.prepare(
    `SELECT o.callsign, o.name, o.bezirk_code, o.bundesland_code,
      bl.name as bundesland_name,
      COUNT(CASE WHEN sr.readability IS NOT NULL THEN 1 END) as report_count
    FROM signal_reports sr
    JOIN operators o ON o.id = sr.operator_id
    LEFT JOIN bundeslaender bl ON bl.code = o.bundesland_code
    WHERE sr.exercise_id IN (${placeholders}) AND sr.is_op_marker = 0
    GROUP BY sr.operator_id
    ORDER BY bl.sort_order, o.bezirk_code, o.callsign`
  ).all(...ids);

  res.json({
    exercises,
    stats: { totalParticipants, totalReports, perRepeater, bezirkStats, blStats, participants },
  });
});

// Placeholder fallback
reportsRouter.get('/', (_req, res) => {
  res.json({ message: 'Use /api/v1/reports/stats?from=YYYY-MM-DD&to=YYYY-MM-DD' });
});
