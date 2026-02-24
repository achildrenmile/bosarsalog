import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function setupSocket(io: Server): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Nicht autorisiert'));
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      (socket as any).admin = payload;
      next();
    } catch {
      next(new Error('Token ungültig'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const admin = (socket as any).admin;
    console.log(`Socket connected: ${admin.username}`);

    socket.on('join_exercise', ({ exercise_id }) => {
      if (typeof exercise_id !== 'string' || !UUID_RE.test(exercise_id)) return;
      socket.join(`exercise:${exercise_id}`);
      console.log(`${admin.username} joined exercise ${exercise_id}`);
    });

    socket.on('leave_exercise', ({ exercise_id }) => {
      if (typeof exercise_id !== 'string' || !UUID_RE.test(exercise_id)) return;
      socket.leave(`exercise:${exercise_id}`);
    });

    socket.on('report_created', (data) => {
      if (typeof data?.exercise_id !== 'string' || !UUID_RE.test(data.exercise_id)) return;
      socket.to(`exercise:${data.exercise_id}`).emit('report_created', {
        ...data,
        entered_by: admin.username,
      });
    });

    socket.on('report_updated', (data) => {
      if (typeof data?.exercise_id !== 'string' || !UUID_RE.test(data.exercise_id)) return;
      socket.to(`exercise:${data.exercise_id}`).emit('report_updated', {
        ...data,
        entered_by: admin.username,
      });
    });

    socket.on('report_deleted', (data) => {
      if (typeof data?.exercise_id !== 'string' || !UUID_RE.test(data.exercise_id)) return;
      socket.to(`exercise:${data.exercise_id}`).emit('report_deleted', {
        ...data,
        entered_by: admin.username,
      });
    });

    socket.on('op_callsign_updated', (data) => {
      if (typeof data?.exercise_id !== 'string' || !UUID_RE.test(data.exercise_id)) return;
      socket.to(`exercise:${data.exercise_id}`).emit('op_callsign_updated', data);
    });

    socket.on('attendance_updated', (data) => {
      if (typeof data?.exercise_id !== 'string' || !UUID_RE.test(data.exercise_id)) return;
      socket.to(`exercise:${data.exercise_id}`).emit('attendance_updated', {
        ...data,
        entered_by: admin.username,
      });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${admin.username}`);
    });
  });
}
