import { Router } from 'express';
import { getDb } from '../db/database.js';

export const operatorsRouter = Router();

// Search/list operators
operatorsRouter.get('/', (req, res) => {
  const db = getDb();
  const q = req.query.q as string;
  if (q) {
    const pattern = `%${q.toUpperCase()}%`;
    const operators = db.prepare(`
      SELECT o.*, bl.name as bundesland_name,
        (SELECT COUNT(*) FROM signal_reports sr WHERE sr.operator_id = o.id AND sr.readability IS NOT NULL) as total_reports
      FROM operators o
      LEFT JOIN bundeslaender bl ON bl.code = o.bundesland_code
        OR (o.bundesland_code IS NULL AND bl.code = '0' || SUBSTR(o.callsign, 3, 1))
      WHERE o.callsign LIKE ? OR UPPER(o.name) LIKE ? OR UPPER(o.qth) LIKE ?
      ORDER BY o.callsign LIMIT 50
    `).all(pattern, pattern, pattern);
    res.json(operators);
  } else {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 1000);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const operators = db.prepare('SELECT * FROM operators ORDER BY callsign LIMIT ? OFFSET ?').all(limit, offset);
    const total = (db.prepare('SELECT COUNT(*) as c FROM operators').get() as any).c;
    res.json({ operators, total });
  }
});

// Get single operator with history
operatorsRouter.get('/:id', (req, res) => {
  const db = getDb();
  const operator = db.prepare('SELECT * FROM operators WHERE id = ?').get(req.params.id);
  if (!operator) {
    res.status(404).json({ error: 'Operator nicht gefunden' });
    return;
  }
  const history = db.prepare(`
    SELECT e.date, e.id as exercise_id,
      GROUP_CONCAT(r.short_name || ': ' ||
        CASE WHEN sr.is_op_marker = 1 THEN 'OP'
        ELSE COALESCE(sr.readability || '/' || sr.strength || COALESCE(sr.db_over_s9, ''), '—')
        END, ' | ') as reports
    FROM signal_reports sr
    JOIN exercises e ON e.id = sr.exercise_id
    JOIN repeaters r ON r.id = sr.repeater_id
    WHERE sr.operator_id = ?
    GROUP BY e.id
    ORDER BY e.date DESC
  `).all(req.params.id);
  res.json({ ...operator, history });
});

// Quick-add operator
operatorsRouter.post('/', (req, res) => {
  const db = getDb();
  const { callsign, name, qth, bezirk_code, bundesland_code } = req.body;
  if (!callsign) {
    res.status(400).json({ error: 'Rufzeichen erforderlich' });
    return;
  }
  try {
    const result = db.prepare(`
      INSERT INTO operators (callsign, name, qth, bezirk_code, bundesland_code)
      VALUES (?, ?, ?, ?, ?)
    `).run(callsign.toUpperCase(), name || null, qth || null, bezirk_code || null, bundesland_code || null);
    const operator = db.prepare('SELECT * FROM operators WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(operator);
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) {
      res.status(409).json({ error: 'Rufzeichen existiert bereits' });
    } else {
      throw e;
    }
  }
});

// Update operator
operatorsRouter.patch('/:id', (req, res) => {
  const db = getDb();
  const fields = ['callsign', 'name', 'qth', 'bezirk_code', 'bundesland_code', 'is_bos_arsa', 'is_arena', 'is_portable', 'is_exercise_support', 'gender', 'email', 'equipment', 'antenna', 'has_emergency_power', 'has_lighthouse_readiness', 'latitude', 'longitude'];
  const updates: string[] = [];
  const params: any[] = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(f === 'callsign' ? req.body[f].toUpperCase() : req.body[f]);
    }
  }
  if (updates.length === 0) {
    res.status(400).json({ error: 'Keine Änderungen' });
    return;
  }
  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE operators SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const operator = db.prepare('SELECT * FROM operators WHERE id = ?').get(req.params.id);
  res.json(operator);
});
