/**
 * Input validation utilities.
 *
 * Security-focused validators for:
 * - Device IDs and identifiers
 * - IP addresses
 * - Public keys
 * - Command parameters
 */

import { z } from 'zod';

// ============================================================================
// UUID Validation
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

export const UUIDSchema = z.string().regex(UUID_REGEX, 'Invalid UUID format');

// ============================================================================
// IP Address Validation
// ============================================================================

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){0,6}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/;

export function isValidIPv4(value: string): boolean {
  return IPV4_REGEX.test(value);
}

export function isValidIPv6(value: string): boolean {
  return IPV6_REGEX.test(value);
}

export function isValidIP(value: string): boolean {
  return isValidIPv4(value) || isValidIPv6(value);
}

export const IPv4Schema = z.string().regex(IPV4_REGEX, 'Invalid IPv4 address');
export const IPv6Schema = z.string().regex(IPV6_REGEX, 'Invalid IPv6 address');
export const IPSchema = z.string().refine(isValidIP, 'Invalid IP address');

// ============================================================================
// Public Key Validation
// ============================================================================

// Base64-encoded 32-byte key (WireGuard/X25519 format)
const BASE64_32_BYTES = /^[A-Za-z0-9+/]{43}=$/;

// Ed25519 public key (also 32 bytes)
const ED25519_PUBKEY_REGEX = BASE64_32_BYTES;

export function isValidWireGuardKey(value: string): boolean {
  return BASE64_32_BYTES.test(value);
}

export function isValidEd25519PublicKey(value: string): boolean {
  return ED25519_PUBKEY_REGEX.test(value);
}

export const WireGuardKeySchema = z.string().regex(BASE64_32_BYTES, 'Invalid WireGuard key format');
export const Ed25519PublicKeySchema = z.string().regex(ED25519_PUBKEY_REGEX, 'Invalid Ed25519 public key');

// ============================================================================
// Session Token Validation
// ============================================================================

// 48 bytes base64url encoded
const SESSION_TOKEN_REGEX = /^[A-Za-z0-9_-]{64}$/;

export function isValidSessionToken(value: string): boolean {
  return SESSION_TOKEN_REGEX.test(value);
}

export const SessionTokenSchema = z.string().regex(SESSION_TOKEN_REGEX, 'Invalid session token format');

// ============================================================================
// Device Name Validation
// ============================================================================

const MAX_DEVICE_NAME = 255;
const DEVICE_NAME_REGEX = /^[\w\s\-_.()]+$/;

export function isValidDeviceName(value: string): boolean {
  return value.length > 0 && value.length <= MAX_DEVICE_NAME && DEVICE_NAME_REGEX.test(value);
}

export const DeviceNameSchema = z.string()
  .min(1, 'Device name required')
  .max(MAX_DEVICE_NAME, `Device name too long (max ${MAX_DEVICE_NAME})`)
  .regex(DEVICE_NAME_REGEX, 'Device name contains invalid characters');

// ============================================================================
// Command Parameter Validation
// ============================================================================

const SAFE_STRING_REGEX = /^[\w\s\-_.,:;@#$%&*()+=\[\]{}|\\/<>?!'"~`]+$/;
const MAX_PARAM_LENGTH = 10000;

export function isSafeString(value: string): boolean {
  return value.length <= MAX_PARAM_LENGTH && SAFE_STRING_REGEX.test(value);
}

/**
 * Sanitize a string for safe use in commands.
 */
export function sanitizeString(value: string): string {
  // Remove control characters
  let sanitized = value.replace(/[\x00-\x1F\x7F]/g, '');
  // Truncate if too long
  if (sanitized.length > MAX_PARAM_LENGTH) {
    sanitized = sanitized.slice(0, MAX_PARAM_LENGTH);
  }
  return sanitized;
}

/**
 * Validate command parameters recursively.
 */
export function validateCommandParams(
  params: Record<string, unknown>,
  maxDepth: number = 5
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  function validate(obj: unknown, depth: number, path: string): void {
    if (depth > maxDepth) {
      errors.push(`Maximum nesting depth exceeded at ${path}`);
      return;
    }

    if (obj === null || obj === undefined) {
      return;
    }

    if (typeof obj === 'string') {
      if (obj.length > MAX_PARAM_LENGTH) {
        errors.push(`String too long at ${path} (max ${MAX_PARAM_LENGTH})`);
      }
      // Check for potential injection patterns
      if (/[;|&$`]/.test(obj)) {
        errors.push(`Potentially unsafe characters at ${path}`);
      }
    } else if (Array.isArray(obj)) {
      if (obj.length > 1000) {
        errors.push(`Array too large at ${path} (max 1000 elements)`);
      }
      obj.forEach((item, i) => validate(item, depth + 1, `${path}[${i}]`));
    } else if (typeof obj === 'object') {
      const keys = Object.keys(obj as Record<string, unknown>);
      if (keys.length > 100) {
        errors.push(`Object too large at ${path} (max 100 keys)`);
      }
      for (const key of keys) {
        validate((obj as Record<string, unknown>)[key], depth + 1, `${path}.${key}`);
      }
    }
  }

  validate(params, 0, 'params');
  return { valid: errors.length === 0, errors };
}

// ============================================================================
// Timestamp Validation
// ============================================================================

const MAX_TIMESTAMP_DRIFT_MS = 30000; // 30 seconds

export function isTimestampFresh(timestamp: number, maxDriftMs: number = MAX_TIMESTAMP_DRIFT_MS): boolean {
  const now = Date.now();
  return Math.abs(now - timestamp) <= maxDriftMs;
}

export function validateTimestamp(timestamp: unknown): timestamp is number {
  return typeof timestamp === 'number' &&
    Number.isInteger(timestamp) &&
    timestamp > 0 &&
    timestamp < Date.now() + 60000; // Not more than 1 minute in future
}

// ============================================================================
// Signature Validation
// ============================================================================

// Base64-encoded 64-byte Ed25519 signature
const SIGNATURE_REGEX = /^[A-Za-z0-9+/]{86}==$/;

export function isValidSignatureFormat(value: string): boolean {
  return SIGNATURE_REGEX.test(value);
}

export const SignatureSchema = z.string().regex(SIGNATURE_REGEX, 'Invalid signature format');

// ============================================================================
// Combined Validators
// ============================================================================

export const SecureAuthRequestValidator = z.object({
  type: z.literal('secure_auth'),
  deviceId: UUIDSchema,
  timestamp: z.number().int().positive(),
  signature: SignatureSchema,
  deviceInfo: z.object({
    name: DeviceNameSchema,
    model: z.string().max(255),
    manufacturer: z.string().max(255),
    platform: z.enum(['android', 'ios']),
    osVersion: z.string().max(50),
    appVersion: z.string().max(50),
  }),
});

export const SecureCommandValidator = z.object({
  type: z.literal('secure_command'),
  id: UUIDSchema,
  action: z.string().min(1).max(100),
  params: z.record(z.unknown()).optional(),
  timestamp: z.number().int().positive(),
  signature: SignatureSchema,
});

// ============================================================================
// Error Messages
// ============================================================================

export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.issues.map(issue => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });
}
