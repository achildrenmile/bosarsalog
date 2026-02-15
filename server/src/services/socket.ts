import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../middleware/auth.js';

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
    console.log(`Socket connected: ${admin.callsign}`);

    socket.on('join_exercise', ({ exercise_id }) => {
      socket.join(`exercise:${exercise_id}`);
      console.log(`${admin.callsign} joined exercise ${exercise_id}`);
    });

    socket.on('leave_exercise', ({ exercise_id }) => {
      socket.leave(`exercise:${exercise_id}`);
    });

    socket.on('report_created', (data) => {
      socket.to(`exercise:${data.exercise_id}`).emit('report_created', {
        ...data,
        entered_by: admin.callsign,
      });
    });

    socket.on('report_updated', (data) => {
      socket.to(`exercise:${data.exercise_id}`).emit('report_updated', {
        ...data,
        entered_by: admin.callsign,
      });
    });

    socket.on('report_deleted', (data) => {
      socket.to(`exercise:${data.exercise_id}`).emit('report_deleted', {
        ...data,
        entered_by: admin.callsign,
      });
    });

    socket.on('attendance_updated', (data) => {
      socket.to(`exercise:${data.exercise_id}`).emit('attendance_updated', {
        ...data,
        entered_by: admin.callsign,
      });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${admin.callsign}`);
    });
  });
}
