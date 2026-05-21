import crypto from 'crypto';

/**
 * Hashes a plaintext password using Node's native scrypt algorithm with a random salt.
 * Returns a string formatted as "salt:hash".
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verifies a plaintext password against a stored "salt:hash" string.
 * Uses timingSafeEqual to protect against timing side-channel attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  
  const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
  
  const hashBuf = Buffer.from(hash, 'hex');
  const verifyBuf = Buffer.from(verifyHash, 'hex');
  
  if (hashBuf.length !== verifyBuf.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(hashBuf, verifyBuf);
}
