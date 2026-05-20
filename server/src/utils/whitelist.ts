import { db } from '../db/client';

export async function isPhoneWhitelisted(phone: string): Promise<boolean> {
  const { data, error } = await db
    .from('whitelist')
    .select('phone')
    .eq('phone', phone)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

export function normalizePhone(phone: string): string {
  // Ensure E.164 format: +919876543210
  const cleaned = phone.replace(/\s+/g, '');
  if (!cleaned.startsWith('+')) {
    throw new Error('Phone number must be in E.164 format (+XXXXXXXXXXXX)');
  }
  return cleaned;
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(phone);
}
