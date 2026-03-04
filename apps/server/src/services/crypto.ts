import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a consistent 32-byte key from the ENCRYPTION_KEY env var.
 */
function getKey(): Buffer {
    return crypto.scryptSync(env.ENCRYPTION_KEY, 'airoom-salt', KEY_LENGTH);
}

/**
 * Encrypt a plaintext API key using AES-256-GCM.
 * Returns { encryptedKey, iv, authTag } all as hex strings.
 */
export function encryptApiKey(plaintext: string): {
    encryptedKey: string;
    iv: string;
    authTag: string;
} {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
        encryptedKey: encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
    };
}

/**
 * Decrypt an encrypted API key using AES-256-GCM.
 * Returns the plaintext key string.
 */
export function decryptApiKey(encryptedKey: string, iv: string, authTag: string): string {
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
