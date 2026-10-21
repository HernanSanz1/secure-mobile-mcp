/**
 * Secure MCP API Server.
 *
 * Features:
 * - Session-based authentication
 * - Input validation on all endpoints
 * - Audit logging
 * - CORS with strict origin checking
 */

import Fastify, { FastifyInstance } from 'fastify';
import { consola } from 'consola';
import type { SecureConfig, RegisteredDevice } from '../types/index.js';
import {
  validateSession,
  getSessionStats,
  cleanupExpiredSessions,
} from '../auth/session.js';
import {
  getConnectedPeers,
  sendSecureCommand,
  approveDevice,
  rejectDevice,
  revokeDevice,
  type DeviceStore,
} from './secure-websocket.js';
import { queryAuditLogs, type AuditQuery } from '../util/audit.js';
import { UUIDSchema, formatValidationErrors } from '../util/validation.js';
import { z } from 'zod';

// ============================================================================
// Request Schemas
// ============================================================================

const ExecuteToolSchema = z.object({
  name: z.string().min(1).max(100),
  args: z.record(z.unknown()).optional(),
});

const AuditQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  eventTypes: z.string().optional(), // comma-separated
  deviceId: z.string().optional(),
  severity: z.string().optional(), // comma-separated
  startTime: z.coerce.number().optional(),
  endTime: z.coerce.number().optional(),
});

// ============================================================================
// Server Factory
// ============================================================================

export interface SecureApiServerConfig {
  port: number;
  corsOrigins?: string[];
  requireAuth: boolean;
}

export function createSecureApiServer(
  config: SecureApiServerConfig,
  deviceStore: DeviceStore
): FastifyInstance {
  const app = Fastify({ logger: false });

  // ============================================================================
  // CORS
  // ============================================================================

  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;

    // Strict origin checking if configured
    if (config.corsOrigins?.length) {
      if (origin && config.corsOrigins.includes(origin)) {
        reply.header('Access-Control-Allow-Origin', origin);
      }
    } else {
      reply.header('Access-Control-Allow-Origin', '*');
    }

    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    reply.header('Access-Control-Allow-Credentials', 'true');

    if (request.method === 'OPTIONS') {
      reply.status(204).send();
    }
  });

  // ============================================================================
  // Security Headers
  // ============================================================================

  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  });

  // ============================================================================
  // Authentication Middleware
  // ============================================================================

  const requireAuth = async (request: { headers: { authorization?: string } }, reply: { status: (code: number) => { send: (body: unknown) => void } }) => {
    if (!config.requireAuth) return;

    const session = validateSession(request.headers.authorization);
    if (!session) {
      reply.status(401).send({ error: 'Unauthorized' });
    }
  };

  // ============================================================================
  // Health & Status
  // ============================================================================

  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  app.get('/api/status', async () => {
    const connected = getConnectedPeers();
    const sessionStats = getSessionStats();

    return {
      serverTime: Date.now(),
      connectedDevices: connected.size,
      ...sessionStats,
    };
  });

  // ============================================================================
  // Device Management
  // ============================================================================

  app.get('/api/devices', { preHandler: requireAuth }, async () => {
    const connected = getConnectedPeers();
    const devices: Array<RegisteredDevice & { online: boolean }> = [];

    // Get all devices from store (simplified - in production, implement full list)
    for (const [deviceId, peer] of connected) {
      devices.push({
        ...peer.device,
        online: true,
      });
    }

    return devices;
  });

  app.get<{ Params: { id: string } }>(
    '/api/devices/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const deviceId = request.params.id;
      const validation = UUIDSchema.safeParse(deviceId);
      if (!validation.success) {
        reply.status(400);
        return { error: formatValidationErrors(validation.error) };
      }

      const device = deviceStore.get(deviceId);
      if (!device) {
        reply.status(404);
        return { error: 'Device not found' };
      }

      const connected = getConnectedPeers();
      return {
        ...device,
        online: connected.has(deviceId),
      };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/devices/:id/approve',
    { preHandler: requireAuth },
    async (request, reply) => {
      const deviceId = request.params.id;
      const validation = UUIDSchema.safeParse(deviceId);
      if (!validation.success) {
        reply.status(400);
        return { error: formatValidationErrors(validation.error) };
      }

      const success = approveDevice(deviceId, deviceStore);
      if (!success) {
        reply.status(404);
        return { error: 'Device not found' };
      }
      return { success: true };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/devices/:id/reject',
    { preHandler: requireAuth },
    async (request, reply) => {
      const deviceId = request.params.id;
      const validation = UUIDSchema.safeParse(deviceId);
      if (!validation.success) {
        reply.status(400);
        return { error: formatValidationErrors(validation.error) };
      }

      const success = rejectDevice(deviceId, deviceStore);
      if (!success) {
        reply.status(404);
        return { error: 'Device not found' };
      }
      return { success: true };
    }
  );

  app.post<{ Params: { id: string } }>(
    '/api/devices/:id/revoke',
    { preHandler: requireAuth },
    async (request, reply) => {
      const deviceId = request.params.id;
      const validation = UUIDSchema.safeParse(deviceId);
      if (!validation.success) {
        reply.status(400);
        return { error: formatValidationErrors(validation.error) };
      }

      const success = revokeDevice(deviceId, deviceStore);
      if (!success) {
        reply.status(404);
        return { error: 'Device not found' };
      }
      return { success: true };
    }
  );

  // ============================================================================
  // Command Execution
  // ============================================================================

  app.post<{ Params: { id: string }; Body: unknown }>(
    '/api/devices/:id/execute',
    { preHandler: requireAuth },
    async (request, reply) => {
      const deviceId = request.params.id;
      const deviceValidation = UUIDSchema.safeParse(deviceId);
      if (!deviceValidation.success) {
        reply.status(400);
        return { error: formatValidationErrors(deviceValidation.error) };
      }

      const bodyValidation = ExecuteToolSchema.safeParse(request.body);
      if (!bodyValidation.success) {
        reply.status(400);
        return { error: formatValidationErrors(bodyValidation.error) };
      }

      const { name, args } = bodyValidation.data;
      const device = deviceStore.get(deviceId);

      if (!device) {
        reply.status(404);
        return { error: 'Device not found' };
      }

      try {
        const result = await sendSecureCommand(deviceId, name, args);
        return result;
      } catch (error) {
        reply.status(500);
        return {
          isError: true,
          content: [{
            type: 'text',
            text: error instanceof Error ? error.message : String(error),
          }],
        };
      }
    }
  );

  // ============================================================================
  // Audit Logs
  // ============================================================================

  app.get<{ Querystring: Record<string, string> }>(
    '/api/audit',
    { preHandler: requireAuth },
    async (request, reply) => {
      const validation = AuditQuerySchema.safeParse(request.query);
      if (!validation.success) {
        reply.status(400);
        return { error: formatValidationErrors(validation.error) };
      }

      const query = validation.data;
      const auditQuery: AuditQuery = {
        limit: query.limit,
        offset: query.offset,
        deviceId: query.deviceId,
        startTime: query.startTime,
        endTime: query.endTime,
      };

      if (query.eventTypes) {
        auditQuery.eventTypes = query.eventTypes.split(',') as AuditQuery['eventTypes'];
      }

      if (query.severity) {
        auditQuery.severity = query.severity.split(',') as AuditQuery['severity'];
      }

      return queryAuditLogs(auditQuery);
    }
  );

  // ============================================================================
  // Session Management
  // ============================================================================

  app.get('/api/sessions/stats', { preHandler: requireAuth }, async () => {
    return getSessionStats();
  });

  app.post('/api/sessions/cleanup', { preHandler: requireAuth }, async () => {
    const cleaned = cleanupExpiredSessions();
    return { cleaned };
  });

  return app;
}

export async function startSecureApiServer(
  config: SecureApiServerConfig,
  deviceStore: DeviceStore
): Promise<void> {
  const app = createSecureApiServer(config, deviceStore);

  await app.listen({ port: config.port, host: '0.0.0.0' });
  consola.success(`Secure API server listening on port ${config.port}`);
}
