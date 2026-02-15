import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/database.js';
import { JWT_SECRET } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const { callsign, pin } = req.body;
  if (!callsign || !pin) {
    res.status(400).json({ error: 'Rufzeichen und PIN erforderlich' });
    return;
  }

  const db = getDb();
  const admin = db.prepare('SELECT * FROM admins WHERE callsign = ?').get(callsign.toUpperCase()) as any;
  if (!admin || !bcrypt.compareSync(pin, admin.pin_hash)) {
    res.status(401).json({ error: 'Rufzeichen oder PIN ungültig' });
    return;
  }

  const token = jwt.sign(
    { id: admin.id, callsign: admin.callsign, role: admin.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    admin: { id: admin.id, callsign: admin.callsign, name: admin.name, role: admin.role },
  });
});
