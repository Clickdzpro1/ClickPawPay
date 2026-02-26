// Encryption utilities for SlickPay keys
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// ENCRYPTION_KEY is guaranteed non-null by server.js startup guard.
// Validate format: must be exactly 64 hex characters (32 bytes for AES-256).
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!/^[0-9a-f]{64}$/i.test(ENCRYPTION_KEY)) {
  console.error('FATAL: ENCRYPTION_KEY must be exactly 64 lowercase hex characters (32 bytes).');
  console.error('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Encrypt sensitive data (SlickPay API keys)
 */
function encrypt(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('encrypt() requires a non-empty string');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
function decrypt(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') {
    throw new Error('decrypt() requires a non-empty string');
  }

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv      = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Hash a password using bcrypt (cost factor 12).
 * Returns a Promise — callers must await.
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a bcrypt hash.
 * Returns a Promise<boolean> — callers must await.
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword
};
