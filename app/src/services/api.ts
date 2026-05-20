import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Conversation, Message, User } from '../types';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// Attach JWT to every request automatically
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('jwt');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface VerifyTokenResponse {
  status: string;
  token?: string;
  setupToken?: string;
  phone?: string;
  user?: {
    id: string;
    phone: string;
    name: string;
    avatar_url: string | null;
  };
}

export async function verifyFirebaseToken(
  idToken: string
): Promise<VerifyTokenResponse> {
  const res = await api.post<VerifyTokenResponse>('/auth/verify-token', {
    idToken,
  });
  return res.data;
}

export interface RegisterPayload {
  setupToken: string;
  name: string;
  avatarUrl?: string;
}

export interface RegisterResponse {
  token: string;
  user: {
    id: string;
    phone: string;
    name: string;
    avatar_url: string | null;
  };
}

export async function registerUser(
  payload: RegisterPayload
): Promise<RegisterResponse> {
  const res = await api.post<RegisterResponse>('/auth/register', payload);
  return res.data;
}

export async function getMe() {
  const res = await api.get<User>('/auth/me');
  return res.data;
}

// ─── Users ─────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  const res = await api.get<User[]>('/users');
  return res.data;
}

export async function updateProfile(payload: { name?: string; avatarUrl?: string }): Promise<User> {
  const res = await api.patch<User>('/users/me', payload);
  return res.data;
}

// ─── Conversations ──────────────────────────────────────────────────────────

export async function getConversations(): Promise<Conversation[]> {
  const res = await api.get<Conversation[]>('/conversations');
  return res.data;
}

export async function getConversationDetails(id: string): Promise<Conversation> {
  const res = await api.get<Conversation>(`/conversations/${id}`);
  return res.data;
}

export async function createConversation(
  type: 'dm' | 'group',
  memberIds: string[],
  name?: string
): Promise<Conversation> {
  const res = await api.post<Conversation>('/conversations', {
    type,
    memberIds,
    name,
  });
  return res.data;
}

export async function updateConversation(
  id: string,
  payload: { name?: string; avatarUrl?: string }
): Promise<Conversation> {
  const res = await api.patch<Conversation>(`/conversations/${id}`, payload);
  return res.data;
}

export async function leaveConversation(id: string): Promise<{ ok: boolean }> {
  const res = await api.delete<{ ok: boolean }>(`/conversations/${id}/leave`);
  return res.data;
}

export async function addConversationMember(id: string, targetUserId: string): Promise<{ ok: boolean }> {
  const res = await api.post<{ ok: boolean }>(`/conversations/${id}/members`, { userId: targetUserId });
  return res.data;
}

export async function removeConversationMember(id: string, targetUserId: string): Promise<{ ok: boolean }> {
  const res = await api.delete<{ ok: boolean }>(`/conversations/${id}/members/${targetUserId}`);
  return res.data;
}

export interface GetMessagesResponse {
  messages: Message[];
  nextCursor: string | null;
}

export async function getMessages(conversationId: string, cursor?: string): Promise<GetMessagesResponse> {
  const res = await api.get<GetMessagesResponse>(`/conversations/${conversationId}/messages`, {
    params: { cursor },
  });
  return res.data;
}

export async function deleteMessage(id: string): Promise<{ ok: boolean }> {
  const res = await api.delete<{ ok: boolean }>(`/messages/${id}`);
  return res.data;
}

export async function addReaction(messageId: string, emoji: string): Promise<{ ok: boolean }> {
  const res = await api.post<{ ok: boolean }>(`/messages/${messageId}/reactions`, { emoji });
  return res.data;
}

export async function removeReaction(messageId: string, emoji: string): Promise<{ ok: boolean }> {
  const res = await api.delete<{ ok: boolean }>(`/messages/${messageId}/reactions/${encodeURIComponent(emoji)}`);
  return res.data;
}
