import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWTPayload, SocketData } from '../types';
import { db } from '../db/client';

// Socket.io auth middleware — verifies JWT from handshake
export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const token = socket.handshake.auth.token as string | undefined;

  if (!token) {
    next(new Error('missing_token'));
    return;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    next(new Error('server_error'));
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as JWTPayload;

    // Verify user is active
    const { data: user } = await db
      .from('users')
      .select('id, is_active')
      .eq('id', payload.userId)
      .maybeSingle();

    if (!user || !user.is_active) {
      next(new Error('account_inactive'));
      return;
    }

    // Attach user data to socket
    (socket.data as SocketData).userId = payload.userId;
    (socket.data as SocketData).phone = payload.phone;

    next();
  } catch {
    next(new Error('invalid_token'));
  }
}
