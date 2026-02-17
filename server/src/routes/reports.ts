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
    JOIN bezirke bz ON bz.code = sr.bezirk_code
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

// ADIF export across a date range
reportsRouter.get('/adif', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    res.status(400).json({ error: 'from und to Parameter erforderlich (YYYY-MM-DD)' });
    return;
  }

  const db = getDb();

  const exercises = db.prepare(
    `SELECT id, date FROM exercises WHERE date >= ? AND date <= ? ORDER BY date ASC`
  ).all(from, to) as { id: string; date: string }[];

  if (exercises.length === 0) {
    res.status(404).json({ error: 'Keine Übungen im gewählten Zeitraum' });
    return;
  }

  const ids = exercises.map(e => e.id);
  const placeholders = ids.map(() => '?').join(',');

  const reports = db.prepare(
    `SELECT sr.readability, sr.strength, sr.db_over_s9, sr.notes, sr.created_at,
      o.callsign, o.name as op_name, o.qth,
      r.short_name, r.frequency_mhz, r.band, r.type,
      e.date as exercise_date
    FROM signal_reports sr
    JOIN operators o ON o.id = sr.operator_id
    JOIN repeaters r ON r.id = sr.repeater_id
    JOIN exercises e ON e.id = sr.exercise_id
    WHERE sr.exercise_id IN (${placeholders})
      AND sr.is_op_marker = 0
      AND sr.readability IS NOT NULL
    ORDER BY e.date, sr.created_at`
  ).all(...ids) as any[];

  // Build ADIF
  const adifField = (name: string, value: string) => {
    if (!value) return '';
    return `<${name}:${value.length}>${value} `;
  };

  let adif = '';

  // Header
  adif += 'ADIF Export from BOS-ARSA Log\n';
  adif += `https://bosarsalog.oeradio.at/\n`;
  adif += `Date range: ${from} to ${to}\n`;
  adif += `QSO count: ${reports.length}\n`;
  adif += '\n';
  adif += adifField('ADIF_VER', '3.1.4');
  adif += adifField('PROGRAMID', 'BOS-ARSA Log');
  adif += adifField('PROGRAMVERSION', '1.0.0-beta.5');
  adif += '\n<EOH>\n\n';

  // Records
  for (const r of reports) {
    const qsoDate = r.exercise_date.replace(/-/g, '');

    // Extract time from created_at (format: "2026-02-16 14:30:00")
    let timeOn = '0900'; // default
    if (r.created_at) {
      const timePart = r.created_at.split(' ')[1];
      if (timePart) {
        timeOn = timePart.replace(/:/g, '').slice(0, 4);
      }
    }

    // RST: combine readability + strength + optional dB
    const rst = `${r.readability}${r.strength}`;

    // Frequency in MHz as string
    const freq = r.frequency_mhz ? String(r.frequency_mhz) : '';

    // Band mapping
    let band = r.band || '';
    if (!band && r.frequency_mhz) {
      if (r.frequency_mhz >= 144 && r.frequency_mhz < 148) band = '2m';
      else if (r.frequency_mhz >= 430 && r.frequency_mhz < 440) band = '70cm';
      else if (r.frequency_mhz >= 1240 && r.frequency_mhz < 1300) band = '23cm';
    }

    adif += adifField('CALL', r.callsign);
    adif += adifField('QSO_DATE', qsoDate);
    adif += adifField('TIME_ON', timeOn);
    adif += adifField('MODE', 'FM');
    if (band) adif += adifField('BAND', band);
    if (freq) adif += adifField('FREQ', freq);
    adif += adifField('RST_SENT', rst);
    adif += adifField('RST_RCVD', rst);
    if (r.op_name) adif += adifField('NAME', r.op_name);
    if (r.qth) adif += adifField('QTH', r.qth);
    if (r.notes) adif += adifField('COMMENT', r.notes);
    adif += '<EOR>\n';
  }

  const filename = `BOS-ARSA_QSOs_${from}_${to}.adi`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(adif);
});

// Placeholder fallback
reportsRouter.get('/', (_req, res) => {
  res.json({ message: 'Use /api/v1/reports/stats?from=YYYY-MM-DD&to=YYYY-MM-DD' });
});
