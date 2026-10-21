/**
 * Cryptographic utilities for secure MCP server.
 * Uses sodium-native for Ed25519 signatures and X25519 key exchange.
 *
 * Security notes:
 * - All keys are generated using CSPRNG
 * - Private keys are never logged or exposed
 * - Session keys are derived using authenticated key exchange
 */

import sodium from 'sodium-native';
import { randomUUID, createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { consola } from 'consola';

// ============================================================================
// Key Types
// ============================================================================

export interface KeyPair {
  publicKey: Buffer;
  secretKey: Buffer;
}

export interface SigningKeyPair extends KeyPair {
  type: 'signing';
}

export interface BoxKeyPair extends KeyPair {
  type: 'box';
}

export interface DerivedSession {
  sessionKey: Buffer;
  nonce: Buffer;
}

// ============================================================================
// Key Generation
// ============================================================================

/**
 * Generate Ed25519 signing keypair.
 */
export function generateSigningKeyPair(): SigningKeyPair {
  const publicKey = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES);
  const secretKey = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES);

  sodium.crypto_sign_keypair(publicKey, secretKey);

  return { type: 'signing', publicKey, secretKey };
}

/**
 * Generate X25519 keypair for encryption/key exchange.
 */
export function generateBoxKeyPair(): BoxKeyPair {
  const publicKey = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES);
  const secretKey = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES);

  sodium.crypto_box_keypair(publicKey, secretKey);

  return { type: 'box', publicKey, secretKey };
}

/**
 * Generate a secure random session token.
 */
export function generateSessionToken(): string {
  const tokenBytes = Buffer.alloc(48);
  sodium.randombytes_buf(tokenBytes);
  return tokenBytes.toString('base64url');
}

/**
 * Generate a secure random nonce.
 */
export function generateNonce(): Buffer {
  const nonce = Buffer.alloc(sodium.crypto_box_NONCEBYTES);
  sodium.randombytes_buf(nonce);
  return nonce;
}

// ============================================================================
// Signing Operations
// ============================================================================

/**
 * Sign a message with Ed25519 secret key.
 */
export function sign(message: Buffer, secretKey: Buffer): Buffer {
  const signature = Buffer.alloc(sodium.crypto_sign_BYTES);
  sodium.crypto_sign_detached(signature, message, secretKey);
  return signature;
}

/**
 * Verify an Ed25519 signature.
 */
export function verify(signature: Buffer, message: Buffer, publicKey: Buffer): boolean {
  try {
    return sodium.crypto_sign_verify_detached(signature, message, publicKey);
  } catch {
    return false;
  }
}

/**
 * Create a signable payload from device auth data.
 */
export function createAuthPayload(deviceId: string, timestamp: number): Buffer {
  return Buffer.from(`${deviceId}:${timestamp}`, 'utf8');
}

/**
 * Sign an auth request for a device.
 */
export function signAuthRequest(deviceId: string, timestamp: number, secretKey: Buffer): string {
  const payload = createAuthPayload(deviceId, timestamp);
  const signature = sign(payload, secretKey);
  return signature.toString('base64');
}

/**
 * Verify an auth request signature.
 */
export function verifyAuthRequest(
  deviceId: string,
  timestamp: number,
  signatureBase64: string,
  publicKey: Buffer
): boolean {
  const payload = createAuthPayload(deviceId, timestamp);
  const signature = Buffer.from(signatureBase64, 'base64');

  if (signature.length !== sodium.crypto_sign_BYTES) {
    return false;
  }

  return verify(signature, payload, publicKey);
}

// ============================================================================
// Encryption Operations
// ============================================================================

/**
 * Derive a shared session key using X25519 + BLAKE2b.
 */
export function deriveSessionKey(
  ourSecretKey: Buffer,
  theirPublicKey: Buffer,
  context: string = 'mcp-session'
): Buffer {
  const sharedSecret = Buffer.alloc(sodium.crypto_scalarmult_BYTES);
  sodium.crypto_scalarmult(sharedSecret, ourSecretKey, theirPublicKey);

  // Derive symmetric key from shared secret
  const sessionKey = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
  const contextBuf = Buffer.alloc(16);
  contextBuf.write(context.slice(0, 16));

  sodium.crypto_kdf_derive_from_key(sessionKey, 1, contextBuf, sharedSecret);

  // Zero out shared secret
  sodium.sodium_memzero(sharedSecret);

  return sessionKey;
}

/**
 * Encrypt a message using symmetric key (XSalsa20-Poly1305).
 */
export function encryptMessage(message: Buffer, key: Buffer): { nonce: Buffer; ciphertext: Buffer } {
  const nonce = generateNonce();
  const ciphertext = Buffer.alloc(message.length + sodium.crypto_secretbox_MACBYTES);

  sodium.crypto_secretbox_easy(ciphertext, message, nonce, key);

  return { nonce, ciphertext };
}

/**
 * Decrypt a message using symmetric key.
 */
export function decryptMessage(ciphertext: Buffer, nonce: Buffer, key: Buffer): Buffer | null {
  if (ciphertext.length < sodium.crypto_secretbox_MACBYTES) {
    return null;
  }

  const plaintext = Buffer.alloc(ciphertext.length - sodium.crypto_secretbox_MACBYTES);

  try {
    sodium.crypto_secretbox_open_easy(plaintext, ciphertext, nonce, key);
    return plaintext;
  } catch {
    return null;
  }
}

// ============================================================================
// Key Fingerprinting
// ============================================================================

/**
 * Generate SHA-256 fingerprint of a public key.
 */
export function fingerprintKey(publicKey: Buffer): string {
  const hash = createHash('sha256').update(publicKey).digest();
  // Format: XX:XX:XX:XX:XX:XX:XX:XX (first 8 bytes)
  return hash
    .subarray(0, 8)
    .toString('hex')
    .match(/.{2}/g)!
    .join(':')
    .toUpperCase();
}

// ============================================================================
// Key Persistence
// ============================================================================

const CONFIG_DIR = join(homedir(), '.secure-mobile-mcp');
const KEYS_DIR = join(CONFIG_DIR, 'keys');

/**
 * Ensure config directories exist with secure permissions.
 */
export function ensureConfigDirs(): void {
  for (const dir of [CONFIG_DIR, KEYS_DIR]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }
}

/**
 * Save a keypair to disk securely.
 */
export function saveKeyPair(name: string, keyPair: SigningKeyPair | BoxKeyPair): void {
  ensureConfigDirs();

  const publicKeyPath = join(KEYS_DIR, `${name}.pub`);
  const secretKeyPath = join(KEYS_DIR, `${name}.key`);

  writeFileSync(publicKeyPath, keyPair.publicKey.toString('base64'));
  writeFileSync(secretKeyPath, keyPair.secretKey.toString('base64'));

  // Restrict permissions on secret key
  chmodSync(secretKeyPath, 0o600);
  chmodSync(publicKeyPath, 0o644);

  consola.info(`Saved keypair: ${name}`);
  consola.info(`  Public key: ${publicKeyPath}`);
  consola.info(`  Fingerprint: ${fingerprintKey(keyPair.publicKey)}`);
}

/**
 * Load a keypair from disk.
 */
export function loadKeyPair(name: string, type: 'signing' | 'box'): SigningKeyPair | BoxKeyPair | null {
  const publicKeyPath = join(KEYS_DIR, `${name}.pub`);
  const secretKeyPath = join(KEYS_DIR, `${name}.key`);

  if (!existsSync(publicKeyPath) || !existsSync(secretKeyPath)) {
    return null;
  }

  const publicKey = Buffer.from(readFileSync(publicKeyPath, 'utf8'), 'base64');
  const secretKey = Buffer.from(readFileSync(secretKeyPath, 'utf8'), 'base64');

  return { type, publicKey, secretKey } as SigningKeyPair | BoxKeyPair;
}

/**
 * Load only the public key.
 */
export function loadPublicKey(name: string): Buffer | null {
  const publicKeyPath = join(KEYS_DIR, `${name}.pub`);

  if (!existsSync(publicKeyPath)) {
    return null;
  }

  return Buffer.from(readFileSync(publicKeyPath, 'utf8'), 'base64');
}

/**
 * Get or generate server identity keypair.
 */
export function getOrCreateServerKeys(): { signing: SigningKeyPair; box: BoxKeyPair } {
  let signing = loadKeyPair('server-signing', 'signing') as SigningKeyPair | null;
  let box = loadKeyPair('server-box', 'box') as BoxKeyPair | null;

  if (!signing) {
    consola.info('Generating server signing keypair...');
    signing = generateSigningKeyPair();
    saveKeyPair('server-signing', signing);
  }

  if (!box) {
    consola.info('Generating server encryption keypair...');
    box = generateBoxKeyPair();
    saveKeyPair('server-box', box);
  }

  return { signing, box };
}

// ============================================================================
// Secure Memory Operations
// ============================================================================

/**
 * Securely zero a buffer.
 */
export function secureZero(buffer: Buffer): void {
  sodium.sodium_memzero(buffer);
}

/**
 * Generate a secure server ID.
 */
export function generateServerId(): string {
  return randomUUID();
}

// ============================================================================
// WireGuard Key Compatibility
// ============================================================================

/**
 * Generate a WireGuard-compatible X25519 keypair.
 * WireGuard uses base64-encoded 32-byte keys.
 */
export function generateWireGuardKeyPair(): { publicKey: string; privateKey: string } {
  const keyPair = generateBoxKeyPair();
  return {
    publicKey: keyPair.publicKey.toString('base64'),
    privateKey: keyPair.secretKey.toString('base64'),
  };
}

/**
 * Derive WireGuard public key from private key.
 */
export function deriveWireGuardPublicKey(privateKeyBase64: string): string {
  const privateKey = Buffer.from(privateKeyBase64, 'base64');
  const publicKey = Buffer.alloc(sodium.crypto_scalarmult_BYTES);

  sodium.crypto_scalarmult_base(publicKey, privateKey);

  return publicKey.toString('base64');
}
