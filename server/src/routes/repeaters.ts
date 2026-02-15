import { Router } from 'express';
import { getDb } from '../db/database.js';

export const repeatersRouter = Router();

repeatersRouter.get('/', (_req, res) => {
  const db = getDb();
  const repeaters = db.prepare('SELECT * FROM repeaters ORDER BY sort_order').all();
  res.json(repeaters);
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
