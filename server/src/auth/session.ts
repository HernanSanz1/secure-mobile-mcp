/**
 * Session management for secure MCP server.
 *
 * Security features:
 * - Secure session token generation
 * - Session expiration and rotation
 * - Rate limiting for auth attempts
 * - Audit logging for all auth events
 */

import { randomUUID } from 'crypto';
import type { Session, RegisteredDevice, AuditEventType } from '../types/index.js';
import { generateSessionToken, verifyAuthRequest, fingerprintKey } from './crypto.js';
import { consola } from 'consola';

// ============================================================================
// In-Memory Session Store (production: use Redis or DB)
// ============================================================================

interface SessionStore {
  sessions: Map<string, Session>;
  deviceSessions: Map<string, Set<string>>; // deviceId -> sessionIds
  tokenIndex: Map<string, string>; // token -> sessionId
}

const store: SessionStore = {
  sessions: new Map(),
  deviceSessions: new Map(),
  tokenIndex: new Map(),
};

// ============================================================================
// Rate Limiting
// ============================================================================

interface AuthAttempt {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const authAttempts = new Map<string, AuthAttempt>();

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 60000; // 1 minute
const DEFAULT_LOCKOUT_MS = 300000; // 5 minutes

export interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
}

/**
 * Check if a device is rate limited.
 */
export function isRateLimited(
  deviceId: string,
  config: RateLimitConfig = {
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    windowMs: DEFAULT_WINDOW_MS,
    lockoutMs: DEFAULT_LOCKOUT_MS,
  }
): { limited: boolean; retryAfter?: number } {
  const now = Date.now();
  const attempt = authAttempts.get(deviceId);

  if (!attempt) {
    return { limited: false };
  }

  // Check lockout
  if (attempt.lockedUntil && now < attempt.lockedUntil) {
    return {
      limited: true,
      retryAfter: attempt.lockedUntil - now,
    };
  }

  // Reset if window expired
  if (now - attempt.firstAttempt > config.windowMs) {
    authAttempts.delete(deviceId);
    return { limited: false };
  }

  // Check attempts within window
  if (attempt.attempts >= config.maxAttempts) {
    attempt.lockedUntil = now + config.lockoutMs;
    return {
      limited: true,
      retryAfter: config.lockoutMs,
    };
  }

  return { limited: false };
}

/**
 * Record an auth attempt.
 */
export function recordAuthAttempt(deviceId: string, success: boolean): void {
  const now = Date.now();

  if (success) {
    authAttempts.delete(deviceId);
    return;
  }

  const existing = authAttempts.get(deviceId);
  if (existing) {
    existing.attempts++;
  } else {
    authAttempts.set(deviceId, {
      attempts: 1,
      firstAttempt: now,
      lockedUntil: null,
    });
  }
}

// ============================================================================
// Session Operations
// ============================================================================

export interface CreateSessionOptions {
  deviceId: string;
  ipAddress: string;
  userAgent?: string;
  ttlMs?: number;
}

/**
 * Create a new session for a device.
 */
export function createSession(options: CreateSessionOptions): Session {
  const { deviceId, ipAddress, userAgent, ttlMs = 86400000 } = options;
  const now = Date.now();

  const session: Session = {
    id: randomUUID(),
    deviceId,
    token: generateSessionToken(),
    createdAt: now,
    expiresAt: now + ttlMs,
    lastActivity: now,
    ipAddress,
    userAgent,
  };

  // Store session
  store.sessions.set(session.id, session);
  store.tokenIndex.set(session.token, session.id);

  // Track device sessions
  const deviceSessions = store.deviceSessions.get(deviceId) ?? new Set();
  deviceSessions.add(session.id);
  store.deviceSessions.set(deviceId, deviceSessions);

  consola.debug(`Created session ${session.id} for device ${deviceId}`);

  return session;
}

/**
 * Get session by token.
 */
export function getSessionByToken(token: string): Session | null {
  const sessionId = store.tokenIndex.get(token);
  if (!sessionId) return null;

  const session = store.sessions.get(sessionId);
  if (!session) return null;

  // Check expiration
  if (Date.now() > session.expiresAt) {
    revokeSession(session.id);
    return null;
  }

  return session;
}

/**
 * Get session by ID.
 */
export function getSession(sessionId: string): Session | null {
  return store.sessions.get(sessionId) ?? null;
}

/**
 * Update session activity timestamp.
 */
export function touchSession(sessionId: string): void {
  const session = store.sessions.get(sessionId);
  if (session) {
    session.lastActivity = Date.now();
  }
}

/**
 * Revoke a session.
 */
export function revokeSession(sessionId: string): boolean {
  const session = store.sessions.get(sessionId);
  if (!session) return false;

  // Remove from all indices
  store.tokenIndex.delete(session.token);
  store.sessions.delete(sessionId);

  const deviceSessions = store.deviceSessions.get(session.deviceId);
  deviceSessions?.delete(sessionId);

  consola.debug(`Revoked session ${sessionId}`);
  return true;
}

/**
 * Revoke all sessions for a device.
 */
export function revokeDeviceSessions(deviceId: string): number {
  const deviceSessions = store.deviceSessions.get(deviceId);
  if (!deviceSessions) return 0;

  let count = 0;
  for (const sessionId of deviceSessions) {
    const session = store.sessions.get(sessionId);
    if (session) {
      store.tokenIndex.delete(session.token);
      store.sessions.delete(sessionId);
      count++;
    }
  }

  store.deviceSessions.delete(deviceId);
  consola.debug(`Revoked ${count} sessions for device ${deviceId}`);
  return count;
}

/**
 * Get all active sessions for a device.
 */
export function getDeviceSessions(deviceId: string): Session[] {
  const sessionIds = store.deviceSessions.get(deviceId);
  if (!sessionIds) return [];

  const sessions: Session[] = [];
  const now = Date.now();

  for (const sessionId of sessionIds) {
    const session = store.sessions.get(sessionId);
    if (session && session.expiresAt > now) {
      sessions.push(session);
    }
  }

  return sessions;
}

/**
 * Cleanup expired sessions.
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, session] of store.sessions) {
    if (session.expiresAt < now) {
      revokeSession(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    consola.debug(`Cleaned up ${cleaned} expired sessions`);
  }

  return cleaned;
}

// ============================================================================
// Authentication Flow
// ============================================================================

export interface AuthResult {
  success: boolean;
  session?: Session;
  error?: string;
  retryAfter?: number;
}

export interface AuthenticateOptions {
  deviceId: string;
  timestamp: number;
  signature: string;
  publicKey: Buffer;
  ipAddress: string;
  userAgent?: string;
  deviceStatus: RegisteredDevice['status'];
  rateLimitConfig?: RateLimitConfig;
  sessionTtlMs?: number;
}

/**
 * Authenticate a device and create a session.
 */
export function authenticate(options: AuthenticateOptions): AuthResult {
  const {
    deviceId,
    timestamp,
    signature,
    publicKey,
    ipAddress,
    userAgent,
    deviceStatus,
    rateLimitConfig,
    sessionTtlMs,
  } = options;

  // Check rate limit
  const rateLimit = isRateLimited(deviceId, rateLimitConfig);
  if (rateLimit.limited) {
    return {
      success: false,
      error: 'Too many auth attempts',
      retryAfter: rateLimit.retryAfter,
    };
  }

  // Check timestamp freshness (prevent replay attacks)
  const now = Date.now();
  const maxDrift = 30000; // 30 seconds
  if (Math.abs(now - timestamp) > maxDrift) {
    recordAuthAttempt(deviceId, false);
    return {
      success: false,
      error: 'Timestamp out of range',
    };
  }

  // Verify signature
  if (!verifyAuthRequest(deviceId, timestamp, signature, publicKey)) {
    recordAuthAttempt(deviceId, false);
    return {
      success: false,
      error: 'Invalid signature',
    };
  }

  // Check device status
  if (deviceStatus === 'rejected' || deviceStatus === 'revoked') {
    recordAuthAttempt(deviceId, false);
    return {
      success: false,
      error: `Device is ${deviceStatus}`,
    };
  }

  if (deviceStatus === 'pending') {
    // Allow connection but no session
    recordAuthAttempt(deviceId, true);
    return {
      success: true,
      error: 'Device pending approval',
    };
  }

  // Create session for approved device
  recordAuthAttempt(deviceId, true);
  const session = createSession({
    deviceId,
    ipAddress,
    userAgent,
    ttlMs: sessionTtlMs,
  });

  return {
    success: true,
    session,
  };
}

/**
 * Validate a session token from request headers.
 */
export function validateSession(authHeader: string | undefined): Session | null {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  const session = getSessionByToken(token);

  if (session) {
    touchSession(session.id);
  }

  return session;
}

// ============================================================================
// Session Stats
// ============================================================================

export function getSessionStats(): {
  activeSessions: number;
  activeDevices: number;
  lockedDevices: number;
} {
  const now = Date.now();
  let activeSessions = 0;
  const activeDevices = new Set<string>();

  for (const session of store.sessions.values()) {
    if (session.expiresAt > now) {
      activeSessions++;
      activeDevices.add(session.deviceId);
    }
  }

  let lockedDevices = 0;
  for (const attempt of authAttempts.values()) {
    if (attempt.lockedUntil && attempt.lockedUntil > now) {
      lockedDevices++;
    }
  }

  return {
    activeSessions,
    activeDevices: activeDevices.size,
    lockedDevices,
  };
}
