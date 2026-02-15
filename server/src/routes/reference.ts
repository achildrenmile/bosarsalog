import { Router } from 'express';
import { getDb } from '../db/database.js';

export const referenceRouter = Router();

referenceRouter.get('/bundeslaender', (_req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM bundeslaender ORDER BY sort_order').all());
});

referenceRouter.get('/bezirke', (req, res) => {
  const db = getDb();
  const bl = req.query.bundesland_code;
  if (bl) {
    res.json(db.prepare('SELECT * FROM bezirke WHERE bundesland_code = ? ORDER BY code').all(bl));
  } else {
    res.json(db.prepare('SELECT * FROM bezirke ORDER BY bundesland_code, code').all());
  }
});

referenceRouter.get('/einstiegspunkte', (req, res) => {
  const db = getDb();
  const rid = req.query.repeater_id;
  if (rid) {
    res.json(db.prepare('SELECT * FROM einstiegspunkte WHERE repeater_id = ? ORDER BY sort_order').all(rid));
  } else {
    res.json(db.prepare('SELECT * FROM einstiegspunkte ORDER BY repeater_id, sort_order').all());
  }
});
