import { Router } from 'express';
import { getDb } from '../db/database.js';
import { AuthRequest } from '../middleware/auth.js';

export const exercisesRouter = Router();

// List all exercises with summary stats
exercisesRouter.get('/', (_req, res) => {
  const db = getDb();
  const exercises = db.prepare(`
    SELECT e.id, e.date, e.status, e.notes,
      (SELECT COUNT(DISTINCT operator_id) FROM exercise_attendance WHERE exercise_id = e.id AND is_present = 1) as participant_count,
      (SELECT COUNT(*) FROM signal_reports WHERE exercise_id = e.id AND is_op_marker = 0) as report_count
    FROM exercises e ORDER BY e.date DESC
  `).all();
  res.json(exercises);
});

// Create exercise
exercisesRouter.post('/', (req, res) => {
  const { date, name } = req.body;
  if (!date) {
    res.status(400).json({ error: 'Datum erforderlich' });
    return;
  }
  const db = getDb();
  try {
    const result = db.prepare('INSERT INTO exercises (date, name) VALUES (?, ?)').run(date, name || null);
    const exercise = db.prepare('SELECT * FROM exercises WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(exercise);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'Übung für dieses Datum existiert bereits' });
    } else {
      throw e;
    }
  }
});

// Get full exercise with reports
exercisesRouter.get('/:id', (req, res) => {
  const db = getDb();
  const exercise = db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id);
  if (!exercise) {
    res.status(404).json({ error: 'Übung nicht gefunden' });
    return;
  }

  const repeaters = db.prepare(`
    SELECT er.*, r.short_name, r.site_name, r.band, r.callsign as repeater_callsign,
      r.frequency_mhz, r.offset_mhz, r.ctcss_hz, r.burst_hz, r.type, r.is_linked
    FROM exercise_repeaters er
    JOIN repeaters r ON r.id = er.repeater_id
    WHERE er.exercise_id = ?
    ORDER BY r.sort_order
  `).all(req.params.id);

  const reports = db.prepare(`
    SELECT sr.*, o.callsign, o.name as operator_name, o.bezirk_code, o.bundesland_code,
      r.short_name as repeater_name,
      ep.abbreviation as einstiegspunkt_abbr, ep.site_name as einstiegspunkt_name
    FROM signal_reports sr
    JOIN operators o ON o.id = sr.operator_id
    JOIN repeaters r ON r.id = sr.repeater_id
    LEFT JOIN einstiegspunkte ep ON ep.id = sr.einstiegspunkt_id
    WHERE sr.exercise_id = ?
    ORDER BY o.bundesland_code, o.bezirk_code, o.callsign
  `).all(req.params.id);

  const attendance = db.prepare(`
    SELECT ea.*, o.callsign, o.name as operator_name, o.bezirk_code, o.bundesland_code
    FROM exercise_attendance ea
    JOIN operators o ON o.id = ea.operator_id
    WHERE ea.exercise_id = ?
    ORDER BY o.callsign
  `).all(req.params.id);

  res.json({ ...exercise, repeaters, reports, attendance });
});

// Update exercise status/notes
exercisesRouter.patch('/:id', (req, res) => {
  const db = getDb();
  const { status, notes, name } = req.body;
  const updates: string[] = [];
  const params: any[] = [];
  if (status !== undefined) { updates.push('status = ?'); params.push(status); }
  if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (updates.length === 0) {
    res.status(400).json({ error: 'Keine Änderungen' });
    return;
  }
  params.push(req.params.id);
  db.prepare(`UPDATE exercises SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const exercise = db.prepare('SELECT * FROM exercises WHERE id = ?').get(req.params.id);
  res.json(exercise);
});

// Get exercise stats
exercisesRouter.get('/:id/stats', (req, res) => {
  const db = getDb();
  const eid = req.params.id;
  const totalParticipants = (db.prepare('SELECT COUNT(DISTINCT operator_id) as c FROM exercise_attendance WHERE exercise_id = ? AND is_present = 1').get(eid) as any)?.c || 0;
  const totalReports = (db.prepare('SELECT COUNT(*) as c FROM signal_reports WHERE exercise_id = ? AND is_op_marker = 0').get(eid) as any)?.c || 0;
  const perRepeater = db.prepare(`
    SELECT r.short_name, COUNT(*) as count
    FROM signal_reports sr
    JOIN repeaters r ON r.id = sr.repeater_id
    WHERE sr.exercise_id = ? AND sr.is_op_marker = 0
    GROUP BY sr.repeater_id
    ORDER BY r.sort_order
  `).all(eid);
  res.json({ totalParticipants, totalReports, perRepeater });
});

// Exercise repeaters management
exercisesRouter.get('/:id/repeaters', (req, res) => {
  const db = getDb();
  const repeaters = db.prepare(`
    SELECT er.*, r.short_name, r.site_name, r.band, r.callsign as repeater_callsign,
      r.frequency_mhz, r.offset_mhz, r.ctcss_hz, r.burst_hz, r.type, r.is_linked, r.sort_order
    FROM exercise_repeaters er
    JOIN repeaters r ON r.id = er.repeater_id
    WHERE er.exercise_id = ?
    ORDER BY r.sort_order
  `).all(req.params.id);
  res.json(repeaters);
});

exercisesRouter.post('/:id/repeaters', (req, res) => {
  const db = getDb();
  const { repeater_id, operator_callsign } = req.body;
  try {
    db.prepare('INSERT INTO exercise_repeaters (exercise_id, repeater_id, operator_callsign) VALUES (?, ?, ?)').run(req.params.id, repeater_id, operator_callsign || null);
    res.status(201).json({ success: true });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE') || e.message?.includes('PRIMARY')) {
      res.status(409).json({ error: 'Umsetzer bereits aktiviert' });
    } else {
      throw e;
    }
  }
});

exercisesRouter.patch('/:id/repeaters/:rid', (req, res) => {
  const db = getDb();
  const { operator_callsign } = req.body;
  db.prepare('UPDATE exercise_repeaters SET operator_callsign = ? WHERE exercise_id = ? AND repeater_id = ?')
    .run(operator_callsign || null, req.params.id, req.params.rid);
  res.json({ success: true });
});

exercisesRouter.delete('/:id/repeaters/:rid', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM exercise_repeaters WHERE exercise_id = ? AND repeater_id = ?')
    .run(req.params.id, req.params.rid);
  res.json({ success: true });
});

// Signal Reports CRUD
exercisesRouter.get('/:id/reports', (req, res) => {
  const db = getDb();
  const reports = db.prepare(`
    SELECT sr.*, o.callsign, o.name as operator_name, o.bezirk_code, o.bundesland_code,
      r.short_name as repeater_name,
      ep.abbreviation as einstiegspunkt_abbr, ep.site_name as einstiegspunkt_name
    FROM signal_reports sr
    JOIN operators o ON o.id = sr.operator_id
    JOIN repeaters r ON r.id = sr.repeater_id
    LEFT JOIN einstiegspunkte ep ON ep.id = sr.einstiegspunkt_id
    WHERE sr.exercise_id = ?
    ORDER BY sr.created_at DESC
  `).all(req.params.id);
  res.json(reports);
});

exercisesRouter.post('/:id/reports', (req, res) => {
  const db = getDb();
  const admin = (req as AuthRequest).admin!;
  const { operator_id, repeater_id, readability, strength, db_over_s9, einstiegspunkt_id, is_op_marker, notes } = req.body;

  if (!operator_id || !repeater_id) {
    res.status(400).json({ error: 'operator_id und repeater_id erforderlich' });
    return;
  }

  try {
    const result = db.prepare(`
      INSERT INTO signal_reports (exercise_id, operator_id, repeater_id, readability, strength, db_over_s9, einstiegspunkt_id, is_op_marker, notes, entered_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, operator_id, repeater_id, readability || null, strength || null, db_over_s9 || null, einstiegspunkt_id || null, is_op_marker ? 1 : 0, notes || null, admin.callsign);

    // Auto-add attendance
    db.prepare('INSERT OR IGNORE INTO exercise_attendance (exercise_id, operator_id, entered_by) VALUES (?, ?, ?)')
      .run(req.params.id, operator_id, admin.callsign);

    const report = db.prepare(`
      SELECT sr.*, o.callsign, o.name as operator_name, o.bezirk_code, o.bundesland_code,
        r.short_name as repeater_name,
        ep.abbreviation as einstiegspunkt_abbr, ep.site_name as einstiegspunkt_name
      FROM signal_reports sr
      JOIN operators o ON o.id = sr.operator_id
      JOIN repeaters r ON r.id = sr.repeater_id
      LEFT JOIN einstiegspunkte ep ON ep.id = sr.einstiegspunkt_id
      WHERE sr.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(report);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'Rapport für diesen Operator auf diesem Umsetzer existiert bereits' });
    } else {
      throw e;
    }
  }
});

exercisesRouter.patch('/:id/reports/:rid', (req, res) => {
  const db = getDb();
  const { readability, strength, db_over_s9, einstiegspunkt_id, notes, is_op_marker } = req.body;
  const updates: string[] = [];
  const params: any[] = [];
  if (readability !== undefined) { updates.push('readability = ?'); params.push(readability); }
  if (strength !== undefined) { updates.push('strength = ?'); params.push(strength); }
  if (db_over_s9 !== undefined) { updates.push('db_over_s9 = ?'); params.push(db_over_s9); }
  if (einstiegspunkt_id !== undefined) { updates.push('einstiegspunkt_id = ?'); params.push(einstiegspunkt_id); }
  if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }
  if (is_op_marker !== undefined) { updates.push('is_op_marker = ?'); params.push(is_op_marker ? 1 : 0); }
  updates.push("updated_at = datetime('now')");
  params.push(req.params.rid);
  db.prepare(`UPDATE signal_reports SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const report = db.prepare(`
    SELECT sr.*, o.callsign, o.name as operator_name, o.bezirk_code, o.bundesland_code,
      r.short_name as repeater_name,
      ep.abbreviation as einstiegspunkt_abbr, ep.site_name as einstiegspunkt_name
    FROM signal_reports sr
    JOIN operators o ON o.id = sr.operator_id
    JOIN repeaters r ON r.id = sr.repeater_id
    LEFT JOIN einstiegspunkte ep ON ep.id = sr.einstiegspunkt_id
    WHERE sr.id = ?
  `).get(req.params.rid);
  res.json(report);
});

exercisesRouter.delete('/:id/reports/:rid', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM signal_reports WHERE id = ? AND exercise_id = ?').run(req.params.rid, req.params.id);
  res.json({ success: true });
});

// Attendance
exercisesRouter.get('/:id/attendance', (req, res) => {
  const db = getDb();
  const attendance = db.prepare(`
    SELECT ea.*, o.callsign, o.name as operator_name, o.bezirk_code, o.bundesland_code
    FROM exercise_attendance ea
    JOIN operators o ON o.id = ea.operator_id
    WHERE ea.exercise_id = ?
    ORDER BY o.callsign
  `).all(req.params.id);
  res.json(attendance);
});

exercisesRouter.post('/:id/attendance', (req, res) => {
  const db = getDb();
  const admin = (req as AuthRequest).admin!;
  const { operator_id, callsign_suffix } = req.body;
  try {
    db.prepare('INSERT INTO exercise_attendance (exercise_id, operator_id, callsign_suffix, entered_by) VALUES (?, ?, ?, ?)')
      .run(req.params.id, operator_id, callsign_suffix || null, admin.callsign);
    res.status(201).json({ success: true });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE') || e.message?.includes('PRIMARY')) {
      res.status(409).json({ error: 'Teilnehmer bereits eingetragen' });
    } else {
      throw e;
    }
  }
});

// Nebenstationen report
exercisesRouter.get('/:id/nebenstationen', (req, res) => {
  const db = getDb();
  const data = db.prepare(`
    SELECT bl.name as bundesland, bl.code as bundesland_code,
      bz.code as bezirk_code, bz.name as bezirk_name, bz.is_capital,
      COUNT(DISTINCT ea.operator_id) as count
    FROM exercise_attendance ea
    JOIN operators o ON o.id = ea.operator_id
    JOIN bezirke bz ON bz.code = o.bezirk_code
    JOIN bundeslaender bl ON bl.code = bz.bundesland_code
    WHERE ea.exercise_id = ? AND ea.is_present = 1
    GROUP BY bz.code
    ORDER BY bl.sort_order, bz.code
  `).all(req.params.id);
  res.json(data);
});
