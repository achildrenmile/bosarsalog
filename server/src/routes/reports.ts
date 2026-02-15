import { Router } from 'express';

export const reportsRouter = Router();

// Placeholder — main report endpoints are under /exercises/:id/reports
reportsRouter.get('/', (_req, res) => {
  res.json({ message: 'Use /api/v1/exercises/:id/reports' });
});
