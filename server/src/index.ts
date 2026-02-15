import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
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
import { setupSocket } from './services/socket.js';
import { authMiddleware } from './middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);

// Initialize database
const db = initDb();
runMigrations(db);
console.log('Database initialized');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

app.use(cors());
app.use(express.json());

// Public routes
app.use('/api/v1/auth', authRouter);

// Protected routes
app.use('/api/v1/exercises', authMiddleware, exercisesRouter);
app.use('/api/v1/operators', authMiddleware, operatorsRouter);
app.use('/api/v1/repeaters', authMiddleware, repeatersRouter);
app.use('/api/v1/reference', authMiddleware, referenceRouter);
app.use('/api/v1/reports', authMiddleware, reportsRouter);
app.use('/api/v1/export', authMiddleware, exportRouter);

// Overview endpoint
app.get('/api/v1/overview', authMiddleware, (_req, res) => {
  const exercises = db.prepare(`
    SELECT e.id, e.date, e.status,
      (SELECT COUNT(DISTINCT operator_id) FROM exercise_attendance WHERE exercise_id = e.id AND is_present = 1) as participant_count,
      (SELECT COUNT(*) FROM signal_reports WHERE exercise_id = e.id AND is_op_marker = 0) as report_count
    FROM exercises e ORDER BY e.date DESC
  `).all();
  res.json(exercises);
});

// Setup Socket.IO
setupSocket(io);

// Serve static client in production
const clientDir = path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`BOS-ARSA Log server running on port ${PORT}`);
});
