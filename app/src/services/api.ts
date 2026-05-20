import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

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
  const res = await api.get<{
    id: string;
    phone: string;
    name: string;
    avatar_url: string | null;
    last_seen: string | null;
    created_at: string;
  }>('/auth/me');
  return res.data;
}
