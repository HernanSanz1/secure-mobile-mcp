import { z } from 'zod';

// ============================================================================
// Security Configuration
// ============================================================================

export const SecureConfigSchema = z.object({
  // Server identity
  serverId: z.string().uuid(),

  // TLS/Certificate paths
  tlsCertPath: z.string().optional(),
  tlsKeyPath: z.string().optional(),
  caCertPath: z.string().optional(),

  // WireGuard configuration
  wireguard: z.object({
    enabled: z.boolean().default(false),
    interfaceName: z.string().default('wg-mcp0'),
    listenPort: z.number().min(1024).max(65535).default(51820),
    privateKeyPath: z.string(),
    publicKeyPath: z.string(),
    subnet: z.string().default('10.200.0.0/24'),
    serverAddress: z.string().default('10.200.0.1/24'),
  }).optional(),

  // Server ports
  wsPort: z.number().min(1024).max(65535).default(5987),
  apiPort: z.number().min(1024).max(65535).default(5988),

  // Database
  dbPath: z.string().default('./secure-mcp.db'),

  // Timeouts (ms)
  commandTimeout: z.number().positive().default(30000),
  heartbeatInterval: z.number().positive().default(30000),
  heartbeatTimeout: z.number().positive().default(90000),
  authTimeout: z.number().positive().default(10000),

  // Security settings
  maxAuthAttempts: z.number().positive().default(5),
  authLockoutMs: z.number().positive().default(300000), // 5 min
  sessionTtlMs: z.number().positive().default(86400000), // 24h
  requireMtls: z.boolean().default(true),
});

export type SecureConfig = z.infer<typeof SecureConfigSchema>;

// ============================================================================
// Device/Peer Authentication
// ============================================================================

export const DeviceStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVOKED: 'revoked',
} as const;

export type DeviceStatus = (typeof DeviceStatus)[keyof typeof DeviceStatus];

export const PeerKeySchema = z.object({
  publicKey: z.string().min(32),
  fingerprint: z.string(),
  createdAt: z.number(),
  expiresAt: z.number().optional(),
  revokedAt: z.number().optional(),
});

export type PeerKey = z.infer<typeof PeerKeySchema>;

export const RegisteredDeviceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(255),
  model: z.string().max(255),
  manufacturer: z.string().max(255),
  platform: z.enum(['android', 'ios']),
  osVersion: z.string().max(50),
  status: z.enum(['pending', 'approved', 'rejected', 'revoked']),

  // Cryptographic identity
  peerKey: PeerKeySchema,
  wireguardKey: z.string().optional(),
  wireguardIp: z.string().optional(),

  // Audit
  createdAt: z.number(),
  lastSeen: z.number(),
  lastAuthAttempt: z.number().optional(),
  authAttempts: z.number().default(0),
});

export type RegisteredDevice = z.infer<typeof RegisteredDeviceSchema>;

// ============================================================================
// Session Management
// ============================================================================

export const SessionSchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string().uuid(),
  token: z.string().min(64),
  createdAt: z.number(),
  expiresAt: z.number(),
  lastActivity: z.number(),
  ipAddress: z.string(),
  userAgent: z.string().optional(),
});

export type Session = z.infer<typeof SessionSchema>;

// ============================================================================
// Secure WebSocket Messages
// ============================================================================

export const SecureAuthRequestSchema = z.object({
  type: z.literal('secure_auth'),
  deviceId: z.string().uuid(),
  timestamp: z.number(),
  signature: z.string(), // Ed25519 signature of deviceId + timestamp
  deviceInfo: z.object({
    name: z.string(),
    model: z.string(),
    manufacturer: z.string(),
    platform: z.enum(['android', 'ios']),
    osVersion: z.string(),
    appVersion: z.string(),
  }),
});

export type SecureAuthRequest = z.infer<typeof SecureAuthRequestSchema>;

export const SecureAuthResponseSchema = z.object({
  type: z.literal('secure_auth_response'),
  success: z.boolean(),
  status: z.enum(['pending', 'approved', 'rejected', 'revoked', 'error']),
  sessionToken: z.string().optional(),
  serverPublicKey: z.string().optional(),
  message: z.string().optional(),
  retryAfter: z.number().optional(), // ms until lockout expires
});

export type SecureAuthResponse = z.infer<typeof SecureAuthResponseSchema>;

export const EncryptedMessageSchema = z.object({
  type: z.literal('encrypted'),
  nonce: z.string(), // Base64 encoded
  ciphertext: z.string(), // Base64 encoded
  tag: z.string().optional(), // Auth tag for AEAD
});

export type EncryptedMessage = z.infer<typeof EncryptedMessageSchema>;

// ============================================================================
// Audit Logging
// ============================================================================

export const AuditEventType = {
  AUTH_ATTEMPT: 'auth_attempt',
  AUTH_SUCCESS: 'auth_success',
  AUTH_FAILURE: 'auth_failure',
  AUTH_LOCKOUT: 'auth_lockout',
  DEVICE_REGISTERED: 'device_registered',
  DEVICE_APPROVED: 'device_approved',
  DEVICE_REJECTED: 'device_rejected',
  DEVICE_REVOKED: 'device_revoked',
  SESSION_CREATED: 'session_created',
  SESSION_EXPIRED: 'session_expired',
  SESSION_REVOKED: 'session_revoked',
  COMMAND_SENT: 'command_sent',
  COMMAND_RECEIVED: 'command_received',
  TUNNEL_CONNECTED: 'tunnel_connected',
  TUNNEL_DISCONNECTED: 'tunnel_disconnected',
  CONFIG_CHANGED: 'config_changed',
  KEY_ROTATED: 'key_rotated',
} as const;

export type AuditEventType = (typeof AuditEventType)[keyof typeof AuditEventType];

export const AuditLogSchema = z.object({
  id: z.number(),
  timestamp: z.number(),
  eventType: z.string(),
  deviceId: z.string().optional(),
  sessionId: z.string().optional(),
  ipAddress: z.string().optional(),
  details: z.string().optional(), // JSON string
  severity: z.enum(['info', 'warn', 'error', 'critical']),
});

export type AuditLog = z.infer<typeof AuditLogSchema>;

// ============================================================================
// WireGuard Types
// ============================================================================

export const WireGuardPeerSchema = z.object({
  publicKey: z.string(),
  allowedIps: z.array(z.string()),
  endpoint: z.string().optional(),
  persistentKeepalive: z.number().optional(),
  lastHandshake: z.number().optional(),
  rxBytes: z.number().optional(),
  txBytes: z.number().optional(),
});

export type WireGuardPeer = z.infer<typeof WireGuardPeerSchema>;

export const WireGuardInterfaceSchema = z.object({
  name: z.string(),
  publicKey: z.string(),
  listenPort: z.number(),
  address: z.string(),
  peers: z.array(WireGuardPeerSchema),
});

export type WireGuardInterface = z.infer<typeof WireGuardInterfaceSchema>;

// ============================================================================
// MCP Tool Result (matches upstream)
// ============================================================================

export interface McpToolResult {
  content: Array<{ type: 'text' | 'image'; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

// ============================================================================
// Command/Response (matches upstream but adds encryption envelope)
// ============================================================================

export const SecureCommandSchema = z.object({
  type: z.literal('secure_command'),
  id: z.string().uuid(),
  action: z.string(),
  params: z.record(z.unknown()).optional(),
  timestamp: z.number(),
  signature: z.string(), // Server signs commands
});

export type SecureCommand = z.infer<typeof SecureCommandSchema>;

export const SecureCommandResponseSchema = z.object({
  type: z.literal('secure_command_response'),
  id: z.string().uuid(),
  success: z.boolean(),
  data: z.unknown().nullish(),
  error: z.string().nullish(),
  timestamp: z.number(),
  signature: z.string(), // Device signs responses
});

export type SecureCommandResponse = z.infer<typeof SecureCommandResponseSchema>;
