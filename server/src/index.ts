import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db/database.js';
import { runMigrations } from './db/schema.js';
import { authRouter } from './routes/auth.js';
import { exercisesRouter } from './routes/exercises.js';
import { operatorsRouter } from './routes/operators.js';
import { repeatersRouter } from './routes/repeaters.js';
import { referenceRouter } from './routes/reference.js';
import { reportsRouter } from './routes/reports.js';
import { exportRouter } from './routes/export.js';
import { pdfRouter } from './routes/pdf.js';
import { importRouter } from './routes/import.js';
import { setupSocket } from './services/socket.js';
import { authMiddleware } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'https://bosarsalog.oeradio.at';

// Initialize database
const db = initDb();
runMigrations(db);
console.log('Database initialized');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN },
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "wss:", "ws:"],
      imgSrc: ["'self'", "data:"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '1mb' }));

// Public routes
app.use('/api/v1/auth', authRouter);

// Protected routes
app.use('/api/v1/exercises', authMiddleware, exercisesRouter);
app.use('/api/v1/operators', authMiddleware, operatorsRouter);
app.use('/api/v1/repeaters', authMiddleware, repeatersRouter);
app.use('/api/v1/reference', authMiddleware, referenceRouter);
app.use('/api/v1/reports', authMiddleware, reportsRouter);
app.use('/api/v1/export', authMiddleware, exportRouter);
app.use('/api/v1/pdf', authMiddleware, pdfRouter);
app.use('/api/v1/exercises', authMiddleware, importRouter);

// Overview endpoint
app.get('/api/v1/overview', authMiddleware, (_req, res) => {
  const exercises = db.prepare(`
    SELECT e.id, e.date, e.name,
      (SELECT COUNT(DISTINCT operator_id) FROM exercise_attendance WHERE exercise_id = e.id AND is_present = 1) as participant_count,
      (SELECT COUNT(*) FROM signal_reports WHERE exercise_id = e.id AND is_op_marker = 0) as report_count
    FROM exercises e ORDER BY e.date DESC
  `).all();
  res.json(exercises);
});

// Setup Socket.IO
setupSocket(io);

// Global error handler — no stack traces in production
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Interner Serverfehler' });
});

// Serve static client in production
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`BOS-ARSA Log server running on port ${PORT}`);
});
