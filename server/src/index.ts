/**
 * Secure Mobile MCP Server
 *
 * Entry point that initializes:
 * - Cryptographic keys
 * - Database
 * - WireGuard tunnel (optional)
 * - Secure WebSocket server
 * - Secure API server
 */

import { config as dotenvConfig } from 'dotenv';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir, networkInterfaces } from 'os';
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { consola } from 'consola';
import {
  SecureConfigSchema,
  type SecureConfig,
  type RegisteredDevice,
} from './types/index.js';
import { getOrCreateServerKeys, ensureConfigDirs } from './auth/crypto.js';
import { initAuditLog, logAudit, cleanupAuditLogs } from './util/audit.js';
import {
  createSecureWebSocketServer,
  type DeviceStore,
} from './mcp/secure-websocket.js';
import { startSecureApiServer } from './mcp/secure-server.js';
import { WireGuardTunnel } from './tunnel/wireguard.js';

// Load environment variables
dotenvConfig();

// ============================================================================
// Configuration
// ============================================================================

const CONFIG_DIR = join(homedir(), '.secure-mobile-mcp');
const STATUS_FILE = join(CONFIG_DIR, 'status.json');
const PID_FILE = join(CONFIG_DIR, 'server.pid');

function ensureConfigDirectory(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function writeStatusFile(status: Record<string, unknown>): void {
  try {
    writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch {
    // Non-critical
  }
}

function writePidFile(): void {
  try {
    writeFileSync(PID_FILE, String(process.pid));
  } catch {
    // Non-critical
  }
}

function removeStatusFiles(): void {
  try {
    unlinkSync(STATUS_FILE);
    unlinkSync(PID_FILE);
  } catch {
    // Ignore
  }
}

function getLocalIP(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

// ============================================================================
// Database & Device Store
// ============================================================================

let db: Database.Database;

function initDatabase(dbPath: string): Database.Database {
  db = new Database(dbPath);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      platform TEXT NOT NULL,
      os_version TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      peer_key TEXT NOT NULL,
      wireguard_key TEXT,
      wireguard_ip TEXT,
      created_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      last_auth_attempt INTEGER,
      auth_attempts INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
  `);

  consola.debug(`Database initialized: ${dbPath}`);
  return db;
}

function createDeviceStore(): DeviceStore {
  const getStmt = db.prepare('SELECT * FROM devices WHERE id = ?');
  const upsertStmt = db.prepare(`
    INSERT INTO devices (id, name, model, manufacturer, platform, os_version, status, peer_key, wireguard_key, wireguard_ip, created_at, last_seen, last_auth_attempt, auth_attempts)
    VALUES (@id, @name, @model, @manufacturer, @platform, @osVersion, @status, @peerKey, @wireguardKey, @wireguardIp, @createdAt, @lastSeen, @lastAuthAttempt, @authAttempts)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      model = @model,
      manufacturer = @manufacturer,
      os_version = @osVersion,
      status = @status,
      peer_key = @peerKey,
      wireguard_key = @wireguardKey,
      wireguard_ip = @wireguardIp,
      last_seen = @lastSeen,
      last_auth_attempt = @lastAuthAttempt,
      auth_attempts = @authAttempts
  `);
  const updateStatusStmt = db.prepare('UPDATE devices SET status = ? WHERE id = ?');

  return {
    get(deviceId: string): RegisteredDevice | undefined {
      const row = getStmt.get(deviceId) as Record<string, unknown> | undefined;
      if (!row) return undefined;

      return {
        id: row.id as string,
        name: row.name as string,
        model: row.model as string,
        manufacturer: row.manufacturer as string,
        platform: row.platform as 'android' | 'ios',
        osVersion: row.os_version as string,
        status: row.status as RegisteredDevice['status'],
        peerKey: JSON.parse(row.peer_key as string),
        wireguardKey: row.wireguard_key as string | undefined,
        wireguardIp: row.wireguard_ip as string | undefined,
        createdAt: row.created_at as number,
        lastSeen: row.last_seen as number,
        lastAuthAttempt: row.last_auth_attempt as number | undefined,
        authAttempts: row.auth_attempts as number,
      };
    },

    upsert(device: RegisteredDevice): RegisteredDevice {
      upsertStmt.run({
        id: device.id,
        name: device.name,
        model: device.model,
        manufacturer: device.manufacturer,
        platform: device.platform,
        osVersion: device.osVersion,
        status: device.status,
        peerKey: JSON.stringify(device.peerKey),
        wireguardKey: device.wireguardKey ?? null,
        wireguardIp: device.wireguardIp ?? null,
        createdAt: device.createdAt,
        lastSeen: device.lastSeen,
        lastAuthAttempt: device.lastAuthAttempt ?? null,
        authAttempts: device.authAttempts,
      });
      return device;
    },

    updateStatus(deviceId: string, status: RegisteredDevice['status']): boolean {
      const result = updateStatusStmt.run(status, deviceId);
      return result.changes > 0;
    },
  };
}

// ============================================================================
// Main Server
// ============================================================================

export async function startSecureServer(overrides: Partial<SecureConfig> = {}): Promise<void> {
  // Parse configuration
  const config = SecureConfigSchema.parse({
    serverId: process.env.SERVER_ID || randomUUID(),
    wsPort: parseInt(process.env.WS_PORT || '5987', 10),
    apiPort: parseInt(process.env.API_PORT || '5988', 10),
    dbPath: process.env.DB_PATH || './secure-mcp.db',
    commandTimeout: parseInt(process.env.COMMAND_TIMEOUT || '30000', 10),
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
    heartbeatTimeout: parseInt(process.env.HEARTBEAT_TIMEOUT || '90000', 10),
    authTimeout: parseInt(process.env.AUTH_TIMEOUT || '10000', 10),
    maxAuthAttempts: parseInt(process.env.MAX_AUTH_ATTEMPTS || '5', 10),
    authLockoutMs: parseInt(process.env.AUTH_LOCKOUT_MS || '300000', 10),
    sessionTtlMs: parseInt(process.env.SESSION_TTL_MS || '86400000', 10),
    requireMtls: process.env.REQUIRE_MTLS !== 'false',
    wireguard: process.env.WIREGUARD_ENABLED === 'true' ? {
      enabled: true,
      interfaceName: process.env.WG_INTERFACE || 'wg-mcp0',
      listenPort: parseInt(process.env.WG_PORT || '51820', 10),
      privateKeyPath: process.env.WG_PRIVATE_KEY || join(CONFIG_DIR, 'wireguard', 'private.key'),
      publicKeyPath: process.env.WG_PUBLIC_KEY || join(CONFIG_DIR, 'wireguard', 'public.key'),
      subnet: process.env.WG_SUBNET || '10.200.0.0/24',
      serverAddress: process.env.WG_ADDRESS || '10.200.0.1/24',
    } : undefined,
    ...overrides,
  });

  // Initialize
  ensureConfigDirectory();
  ensureConfigDirs();

  // Initialize cryptographic keys
  const serverKeys = getOrCreateServerKeys();
  consola.info(`Server ID: ${config.serverId}`);

  // Initialize database
  const database = initDatabase(config.dbPath);
  const deviceStore = createDeviceStore();

  // Initialize audit logging
  initAuditLog(database);
  logAudit({
    eventType: 'config_changed',
    details: { action: 'server_started', serverId: config.serverId },
    severity: 'info',
  });

  // Initialize WireGuard tunnel (optional)
  let tunnel: WireGuardTunnel | null = null;
  if (config.wireguard?.enabled) {
    tunnel = new WireGuardTunnel({
      enabled: true,
      listenPort: config.wireguard.listenPort,
      serverEndpoint: `${getLocalIP()}:${config.wireguard.listenPort}`,
    });

    if (await tunnel.initialize()) {
      await tunnel.start();
      consola.success(`WireGuard tunnel started on port ${config.wireguard.listenPort}`);
    }
  }

  // Start WebSocket server
  createSecureWebSocketServer({
    port: config.wsPort,
    authTimeoutMs: config.authTimeout,
    heartbeatIntervalMs: config.heartbeatInterval,
    heartbeatTimeoutMs: config.heartbeatTimeout,
    commandTimeoutMs: config.commandTimeout,
    sessionTtlMs: config.sessionTtlMs,
    maxAuthAttempts: config.maxAuthAttempts,
    authLockoutMs: config.authLockoutMs,
  }, deviceStore);

  // Start API server
  await startSecureApiServer({
    port: config.apiPort,
    requireAuth: config.requireMtls,
  }, deviceStore);

  // Display startup info
  const localIP = getLocalIP();
  consola.box({
    title: 'Secure Mobile MCP Server',
    message: [
      '',
      `  Server ID:     ${config.serverId}`,
      `  WebSocket:     wss://${localIP}:${config.wsPort}`,
      `  API:           https://${localIP}:${config.apiPort}`,
      tunnel ? `  WireGuard:     ${localIP}:${config.wireguard?.listenPort}` : '',
      '',
      `  Database:      ${config.dbPath}`,
      `  Config:        ${CONFIG_DIR}`,
      '',
    ].filter(Boolean).join('\n'),
  });

  // Write status file
  writePidFile();
  writeStatusFile({
    pid: process.pid,
    serverId: config.serverId,
    startedAt: new Date().toISOString(),
    wsPort: config.wsPort,
    apiPort: config.apiPort,
    wireguardPort: config.wireguard?.listenPort,
    dbPath: config.dbPath,
  });

  // Setup cleanup interval
  setInterval(() => {
    cleanupAuditLogs(90);
  }, 24 * 60 * 60 * 1000); // Daily

  // Handle shutdown
  const shutdown = async () => {
    consola.info('Shutting down...');

    logAudit({
      eventType: 'config_changed',
      details: { action: 'server_stopped' },
      severity: 'info',
    });

    removeStatusFiles();

    if (tunnel) {
      tunnel.stop();
    }

    database.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// ============================================================================
// Exports
// ============================================================================

export * from './types/index.js';
export * from './auth/index.js';
export * from './tunnel/index.js';
export * from './mcp/index.js';
export * from './util/index.js';

// Auto-start when run directly
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const currentFile = fileURLToPath(import.meta.url);
const mainScript = resolve(process.argv[1]);

if (currentFile === mainScript) {
  startSecureServer().catch((err) => {
    consola.error('Failed to start server:', err);
    process.exit(1);
  });
}
