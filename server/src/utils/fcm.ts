import admin from 'firebase-admin';
import { db } from '../db/client';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const { data: user, error } = await db
    .from('users')
    .select('fcm_token')
    .eq('id', userId)
    .maybeSingle();

  if (error || !user?.fcm_token) return;

  try {
    await admin.messaging().send({
      token: user.fcm_token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data ?? {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
    });
  } catch {
    // Token may be stale — clear it silently
    await db.from('users').update({ fcm_token: null }).eq('id', userId);
  }
}

export async function sendPushToConversationMembers(
  conversationId: string,
  excludeUserId: string,
  payload: PushPayload
): Promise<void> {
  const { data: members, error } = await db
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .neq('user_id', excludeUserId);

  if (error || !members) return;

  await Promise.allSettled(
    members.map((m) => sendPushToUser(m.user_id, payload))
  );
}
