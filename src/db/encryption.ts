import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;

/**
 * Derives a 32-byte key from the environment encryption key and salt
 */
function getDerivedKey(salt: Buffer): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY || 'flowforge-default-dev-secret-key-do-not-use-in-prod-32bytes!';
  return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
}

export interface EncryptedPayload {
  cipherText: string;
  iv: string;
  salt: string;
  tag: string;
  version: number;
}

/**
 * Encrypts an object or string with AES-256-GCM
 */
export function encryptSecret(plainTextOrObject: any, keyVersion = 1): string {
  const text = typeof plainTextOrObject === 'string' ? plainTextOrObject : JSON.stringify(plainTextOrObject);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = getDerivedKey(salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const payload: EncryptedPayload = {
    cipherText: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    salt: salt.toString('base64'),
    tag: tag.toString('base64'),
    version: keyVersion,
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Decrypts an AES-256-GCM encrypted payload
 */
export function decryptSecret<T = any>(encryptedBase64: string): T {
  try {
    const raw = Buffer.from(encryptedBase64, 'base64').toString('utf8');
    const payload: EncryptedPayload = JSON.parse(raw);

    const salt = Buffer.from(payload.salt, 'base64');
    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const cipherText = Buffer.from(payload.cipherText, 'base64');

    const key = getDerivedKey(salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
    const str = decrypted.toString('utf8');

    try {
      return JSON.parse(str) as T;
    } catch {
      return str as unknown as T;
    }
  } catch (err: any) {
    throw new Error(`Decryption failed: corrupted data or invalid encryption key (${err.message})`);
  }
}

/**
 * Generates a high-entropy secret token for Webhook verification
 */
export function generateWebhookSecret(): { rawToken: string; hashedSecret: string } {
  const rawToken = `ff_wh_${crypto.randomBytes(24).toString('hex')}`;
  const hashedSecret = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, hashedSecret };
}

/**
 * Verifies webhook signature against stored hash
 */
export function verifyWebhookSecret(rawToken: string, storedHash: string): boolean {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(storedHash));
}

/**
 * Computes deterministic SHA-256 hash of a request payload for idempotency tracking
 */
export function computeRequestHash(payload: any): string {
  const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Redacts sensitive fields (passwords, tokens, keys) from objects before logging or saving
 */
const SENSITIVE_KEY_PATTERNS = [
  /pass(word)?/i,
  /secret/i,
  /token/i,
  /key/i,
  /auth(orization)?/i,
  /bearer/i,
  /credential/i,
];

export function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object') {
      sanitized[key] = redactSensitiveData(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}
