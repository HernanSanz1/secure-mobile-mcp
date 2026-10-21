/**
 * Audit logging for security events.
 *
 * Features:
 * - Structured logging with severity levels
 * - Persistent storage in SQLite
 * - Rotation and retention policies
 * - Sensitive data redaction
 */

import { Database } from 'better-sqlite3';
import { consola } from 'consola';
import type { AuditLog, AuditEventType } from '../types/index.js';

// ============================================================================
// Redaction
// ============================================================================

const SENSITIVE_KEYS = [
  'password',
  'secret',
  'token',
  'privateKey',
  'secretKey',
  'apiKey',
  'authorization',
];

/**
 * Redact sensitive values from an object.
 */
export function redactSensitive(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some(k => lowerKey.includes(k));

    if (isSensitive && typeof value === 'string') {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      redacted[key] = redactSensitive(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

// ============================================================================
// Audit Logger
// ============================================================================

type Severity = AuditLog['severity'];

export interface AuditEntry {
  eventType: AuditEventType;
  deviceId?: string;
  sessionId?: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
  severity: Severity;
}

let db: Database | null = null;

/**
 * Initialize audit logging with database connection.
 */
export function initAuditLog(database: Database): void {
  db = database;

  // Create audit table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      device_id TEXT,
      session_id TEXT,
      ip_address TEXT,
      details TEXT,
      severity TEXT NOT NULL DEFAULT 'info'
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_device ON audit_log(device_id);
    CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(event_type);
    CREATE INDEX IF NOT EXISTS idx_audit_severity ON audit_log(severity);
  `);

  consola.debug('Audit log initialized');
}

/**
 * Log an audit event.
 */
export function logAudit(entry: AuditEntry): void {
  const timestamp = Date.now();

  // Redact sensitive data
  const details = entry.details ? redactSensitive(entry.details) : undefined;

  // Write to database if available
  if (db) {
    try {
      const stmt = db.prepare(`
        INSERT INTO audit_log (timestamp, event_type, device_id, session_id, ip_address, details, severity)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        timestamp,
        entry.eventType,
        entry.deviceId ?? null,
        entry.sessionId ?? null,
        entry.ipAddress ?? null,
        details ? JSON.stringify(details) : null,
        entry.severity
      );
    } catch (error) {
      consola.error('Failed to write audit log:', error);
    }
  }

  // Also log to console based on severity
  const msg = `[AUDIT] ${entry.eventType}` +
    (entry.deviceId ? ` device=${entry.deviceId.slice(0, 8)}...` : '') +
    (entry.ipAddress ? ` ip=${entry.ipAddress}` : '');

  switch (entry.severity) {
    case 'critical':
    case 'error':
      consola.error(msg, details);
      break;
    case 'warn':
      consola.warn(msg, details);
      break;
    case 'info':
    default:
      consola.debug(msg, details);
      break;
  }
}

/**
 * Query audit logs.
 */
export interface AuditQuery {
  limit?: number;
  offset?: number;
  eventTypes?: AuditEventType[];
  deviceId?: string;
  severity?: Severity[];
  startTime?: number;
  endTime?: number;
}

export function queryAuditLogs(query: AuditQuery): AuditLog[] {
  if (!db) return [];

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (query.eventTypes?.length) {
    conditions.push(`event_type IN (${query.eventTypes.map(() => '?').join(',')})`);
    params.push(...query.eventTypes);
  }

  if (query.deviceId) {
    conditions.push('device_id = ?');
    params.push(query.deviceId);
  }

  if (query.severity?.length) {
    conditions.push(`severity IN (${query.severity.map(() => '?').join(',')})`);
    params.push(...query.severity);
  }

  if (query.startTime) {
    conditions.push('timestamp >= ?');
    params.push(query.startTime);
  }

  if (query.endTime) {
    conditions.push('timestamp <= ?');
    params.push(query.endTime);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = query.limit ?? 100;
  const offset = query.offset ?? 0;

  try {
    const stmt = db.prepare(`
      SELECT id, timestamp, event_type as eventType, device_id as deviceId,
             session_id as sessionId, ip_address as ipAddress, details, severity
      FROM audit_log
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);

    const rows = stmt.all(...params, limit, offset) as Array<{
      id: number;
      timestamp: number;
      eventType: string;
      deviceId: string | null;
      sessionId: string | null;
      ipAddress: string | null;
      details: string | null;
      severity: Severity;
    }>;

    return rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.eventType,
      deviceId: row.deviceId ?? undefined,
      sessionId: row.sessionId ?? undefined,
      ipAddress: row.ipAddress ?? undefined,
      details: row.details ?? undefined,
      severity: row.severity,
    }));
  } catch (error) {
    consola.error('Failed to query audit logs:', error);
    return [];
  }
}

/**
 * Clean up old audit logs.
 */
export function cleanupAuditLogs(retentionDays: number = 90): number {
  if (!db) return 0;

  const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

  try {
    const stmt = db.prepare('DELETE FROM audit_log WHERE timestamp < ?');
    const result = stmt.run(cutoff);
    const deleted = result.changes;

    if (deleted > 0) {
      consola.info(`Cleaned up ${deleted} audit log entries older than ${retentionDays} days`);
    }

    return deleted;
  } catch (error) {
    consola.error('Failed to cleanup audit logs:', error);
    return 0;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function auditAuthAttempt(
  deviceId: string,
  ipAddress: string,
  success: boolean,
  details?: Record<string, unknown>
): void {
  logAudit({
    eventType: success ? 'auth_success' : 'auth_failure',
    deviceId,
    ipAddress,
    details,
    severity: success ? 'info' : 'warn',
  });
}

export function auditDeviceAction(
  eventType: 'device_registered' | 'device_approved' | 'device_rejected' | 'device_revoked',
  deviceId: string,
  ipAddress?: string,
  details?: Record<string, unknown>
): void {
  logAudit({
    eventType,
    deviceId,
    ipAddress,
    details,
    severity: eventType === 'device_revoked' ? 'warn' : 'info',
  });
}

export function auditSessionEvent(
  eventType: 'session_created' | 'session_expired' | 'session_revoked',
  sessionId: string,
  deviceId: string,
  ipAddress?: string
): void {
  logAudit({
    eventType,
    sessionId,
    deviceId,
    ipAddress,
    severity: 'info',
  });
}

export function auditCommand(
  eventType: 'command_sent' | 'command_received',
  deviceId: string,
  sessionId: string,
  action: string,
  success?: boolean
): void {
  logAudit({
    eventType,
    deviceId,
    sessionId,
    details: { action, success },
    severity: 'info',
  });
}

export function auditTunnelEvent(
  eventType: 'tunnel_connected' | 'tunnel_disconnected',
  deviceId: string,
  ipAddress: string,
  peerPublicKey?: string
): void {
  logAudit({
    eventType,
    deviceId,
    ipAddress,
    details: peerPublicKey ? { peerKey: peerPublicKey.slice(0, 8) + '...' } : undefined,
    severity: 'info',
  });
}

export function auditSecurityEvent(
  eventType: 'auth_lockout' | 'config_changed' | 'key_rotated',
  details: Record<string, unknown>,
  deviceId?: string,
  ipAddress?: string
): void {
  logAudit({
    eventType,
    deviceId,
    ipAddress,
    details,
    severity: eventType === 'auth_lockout' ? 'warn' : 'info',
  });
}
