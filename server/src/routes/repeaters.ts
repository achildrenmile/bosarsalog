import { Router } from 'express';
import { getDb } from '../db/database.js';

export const repeatersRouter = Router();

repeatersRouter.get('/', (req, res) => {
  const db = getDb();
  const { bundesland_code, type } = req.query;
  let sql = 'SELECT r.*, bl.name as bundesland_name FROM repeaters r LEFT JOIN bundeslaender bl ON bl.code = r.bundesland_code';
  const conditions: string[] = [];
  const params: any[] = [];

  if (bundesland_code) {
    conditions.push('r.bundesland_code = ?');
    params.push(bundesland_code);
  }
  if (type) {
    conditions.push('r.type = ?');
    params.push(type);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY r.sort_order, r.short_name';

  const repeaters = db.prepare(sql).all(...params);
  res.json(repeaters);
});

repeatersRouter.post('/', (req, res) => {
  const db = getDb();
  const { short_name, site_name, band, callsign, frequency_mhz, offset_mhz, ctcss_hz, burst_hz, type, bundesland_code } = req.body;

  if (!short_name) {
    res.status(400).json({ error: 'short_name erforderlich' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO repeaters (short_name, site_name, band, callsign, frequency_mhz, offset_mhz, ctcss_hz, burst_hz, type, is_linked, sort_order, bundesland_code, is_custom)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM repeaters), ?, 1)
  `).run(
    short_name,
    site_name || null,
    band || null,
    callsign || null,
    frequency_mhz || null,
    offset_mhz || null,
    ctcss_hz || null,
    burst_hz || null,
    type || 'repeater',
    bundesland_code || null,
  );

  const repeater = db.prepare('SELECT r.*, bl.name as bundesland_name FROM repeaters r LEFT JOIN bundeslaender bl ON bl.code = r.bundesland_code WHERE r.id = ?').get(result.lastInsertRowid);
  res.status(201).json(repeater);
});

repeatersRouter.get('/:id/einstiegspunkte', (req, res) => {
  const db = getDb();
  const eps = db.prepare(`
    SELECT ep.*, bl.name as bundesland_name
    FROM einstiegspunkte ep
    LEFT JOIN bundeslaender bl ON bl.code = ep.bundesland_code
    WHERE ep.repeater_id = ?
    ORDER BY ep.sort_order
  `).all(req.params.id);
  res.json(eps);
});
