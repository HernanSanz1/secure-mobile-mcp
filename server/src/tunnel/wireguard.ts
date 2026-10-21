/**
 * WireGuard tunnel management.
 *
 * This module provides utilities for:
 * - Configuring WireGuard interfaces
 * - Adding/removing peers
 * - IP address allocation
 * - Integration with the secure MCP protocol
 *
 * Security notes:
 * - Private keys are never logged
 * - Configuration files have restricted permissions
 * - Peer management requires authentication
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir, platform } from 'os';
import { consola } from 'consola';
import { generateWireGuardKeyPair, deriveWireGuardPublicKey } from '../auth/crypto.js';
import type { WireGuardInterface, WireGuardPeer } from '../types/index.js';

// ============================================================================
// Configuration Paths
// ============================================================================

const CONFIG_DIR = join(homedir(), '.secure-mobile-mcp', 'wireguard');
const WG_INTERFACE = 'wg-mcp0';

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function getConfigPath(): string {
  return join(CONFIG_DIR, `${WG_INTERFACE}.conf`);
}

function getPrivateKeyPath(): string {
  return join(CONFIG_DIR, 'private.key');
}

function getPublicKeyPath(): string {
  return join(CONFIG_DIR, 'public.key');
}

// ============================================================================
// Platform Detection
// ============================================================================

type SupportedPlatform = 'darwin' | 'linux';

function detectPlatform(): SupportedPlatform {
  const os = platform();
  if (os !== 'darwin' && os !== 'linux') {
    throw new Error(`Unsupported platform: ${os}. WireGuard tunnel requires macOS or Linux.`);
  }
  return os;
}

function isWireGuardAvailable(): boolean {
  try {
    execSync('which wg', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function isWireGuardGoAvailable(): boolean {
  try {
    execSync('which wireguard-go', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Key Management
// ============================================================================

export interface WireGuardKeys {
  privateKey: string;
  publicKey: string;
}

/**
 * Get or generate WireGuard keys for the server.
 */
export function getOrCreateServerKeys(): WireGuardKeys {
  ensureConfigDir();

  const privateKeyPath = getPrivateKeyPath();
  const publicKeyPath = getPublicKeyPath();

  if (existsSync(privateKeyPath) && existsSync(publicKeyPath)) {
    return {
      privateKey: readFileSync(privateKeyPath, 'utf8').trim(),
      publicKey: readFileSync(publicKeyPath, 'utf8').trim(),
    };
  }

  consola.info('Generating WireGuard keypair...');
  const keys = generateWireGuardKeyPair();

  writeFileSync(privateKeyPath, keys.privateKey + '\n');
  chmodSync(privateKeyPath, 0o600);

  writeFileSync(publicKeyPath, keys.publicKey + '\n');
  chmodSync(publicKeyPath, 0o644);

  consola.success(`WireGuard public key: ${keys.publicKey}`);
  return keys;
}

// ============================================================================
// IP Address Allocation
// ============================================================================

const SUBNET_BASE = '10.200.0';
const SERVER_IP = `${SUBNET_BASE}.1`;

/**
 * Tracks allocated IPs. In production, persist to database.
 */
const allocatedIps = new Set<string>([SERVER_IP]);

/**
 * Allocate an IP address for a new peer.
 */
export function allocateIp(): string | null {
  // Simple sequential allocation (2-254)
  for (let i = 2; i < 255; i++) {
    const ip = `${SUBNET_BASE}.${i}`;
    if (!allocatedIps.has(ip)) {
      allocatedIps.add(ip);
      return ip;
    }
  }
  return null;
}

/**
 * Release an allocated IP.
 */
export function releaseIp(ip: string): void {
  if (ip !== SERVER_IP) {
    allocatedIps.delete(ip);
  }
}

/**
 * Check if an IP is allocated.
 */
export function isIpAllocated(ip: string): boolean {
  return allocatedIps.has(ip);
}

// ============================================================================
// Configuration Generation
// ============================================================================

export interface WireGuardConfig {
  listenPort: number;
  privateKey: string;
  address: string;
  peers: Array<{
    publicKey: string;
    allowedIps: string;
    persistentKeepalive?: number;
  }>;
}

/**
 * Generate WireGuard configuration file content.
 */
export function generateConfig(config: WireGuardConfig): string {
  const lines = [
    '[Interface]',
    `Address = ${config.address}`,
    `ListenPort = ${config.listenPort}`,
    `PrivateKey = ${config.privateKey}`,
    '',
  ];

  for (const peer of config.peers) {
    lines.push('[Peer]');
    lines.push(`PublicKey = ${peer.publicKey}`);
    lines.push(`AllowedIPs = ${peer.allowedIps}`);
    if (peer.persistentKeepalive) {
      lines.push(`PersistentKeepalive = ${peer.persistentKeepalive}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Write configuration to file.
 */
export function writeConfig(config: WireGuardConfig): string {
  ensureConfigDir();
  const configPath = getConfigPath();
  const content = generateConfig(config);

  writeFileSync(configPath, content);
  chmodSync(configPath, 0o600);

  consola.debug(`Wrote WireGuard config to ${configPath}`);
  return configPath;
}

// ============================================================================
// Interface Management
// ============================================================================

/**
 * Check if the WireGuard interface is up.
 */
export function isInterfaceUp(interfaceName: string = WG_INTERFACE): boolean {
  try {
    const os = detectPlatform();
    if (os === 'darwin') {
      execSync(`ifconfig utun0 2>/dev/null | grep -q "inet"`, { stdio: 'pipe' });
    } else {
      execSync(`ip link show ${interfaceName}`, { stdio: 'pipe' });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Bring up the WireGuard interface.
 */
export async function startInterface(configPath?: string): Promise<boolean> {
  const path = configPath ?? getConfigPath();

  if (!existsSync(path)) {
    consola.error(`WireGuard config not found: ${path}`);
    return false;
  }

  const os = detectPlatform();

  try {
    if (os === 'darwin') {
      // macOS: use wireguard-go userspace implementation
      if (!isWireGuardGoAvailable()) {
        consola.error('wireguard-go not found. Install with: brew install wireguard-go');
        return false;
      }

      // Start wireguard-go in background
      const wgGo = spawn('wireguard-go', ['utun'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      });

      wgGo.unref();

      // Wait a moment for interface to come up
      await new Promise(resolve => setTimeout(resolve, 500));

      // Configure with wg-quick style setup
      execSync(`wg setconf utun0 ${path}`, { stdio: 'pipe' });
      consola.success('WireGuard interface started on macOS');
      return true;
    } else {
      // Linux: use wg-quick
      execSync(`wg-quick up ${path}`, { stdio: 'pipe' });
      consola.success('WireGuard interface started on Linux');
      return true;
    }
  } catch (error) {
    consola.error('Failed to start WireGuard interface:', error);
    return false;
  }
}

/**
 * Bring down the WireGuard interface.
 */
export function stopInterface(interfaceName: string = WG_INTERFACE): boolean {
  const os = detectPlatform();

  try {
    if (os === 'darwin') {
      // Find and kill wireguard-go process
      execSync(`pkill -f "wireguard-go utun"`, { stdio: 'pipe' });
    } else {
      execSync(`wg-quick down ${interfaceName}`, { stdio: 'pipe' });
    }
    consola.info('WireGuard interface stopped');
    return true;
  } catch {
    // May already be down
    return true;
  }
}

// ============================================================================
// Peer Management
// ============================================================================

/**
 * Add a peer to the running interface.
 */
export function addPeer(
  interfaceName: string,
  publicKey: string,
  allowedIps: string,
  persistentKeepalive?: number
): boolean {
  try {
    let cmd = `wg set ${interfaceName} peer ${publicKey} allowed-ips ${allowedIps}`;
    if (persistentKeepalive) {
      cmd += ` persistent-keepalive ${persistentKeepalive}`;
    }
    execSync(cmd, { stdio: 'pipe' });
    consola.debug(`Added peer ${publicKey.slice(0, 8)}... to ${interfaceName}`);
    return true;
  } catch (error) {
    consola.error('Failed to add peer:', error);
    return false;
  }
}

/**
 * Remove a peer from the running interface.
 */
export function removePeer(interfaceName: string, publicKey: string): boolean {
  try {
    execSync(`wg set ${interfaceName} peer ${publicKey} remove`, { stdio: 'pipe' });
    consola.debug(`Removed peer ${publicKey.slice(0, 8)}... from ${interfaceName}`);
    return true;
  } catch (error) {
    consola.error('Failed to remove peer:', error);
    return false;
  }
}

/**
 * Get current interface status and peers.
 */
export function getInterfaceStatus(interfaceName: string = WG_INTERFACE): WireGuardInterface | null {
  if (!isWireGuardAvailable()) {
    return null;
  }

  try {
    const output = execSync(`wg show ${interfaceName} dump`, { encoding: 'utf8', stdio: 'pipe' });
    const lines = output.trim().split('\n');

    if (lines.length === 0) return null;

    // First line is interface info
    const [privateKey, publicKey, listenPort, fwmark] = lines[0].split('\t');

    const peers: WireGuardPeer[] = [];

    // Remaining lines are peers
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split('\t');
      if (parts.length >= 4) {
        peers.push({
          publicKey: parts[0],
          allowedIps: parts[3].split(','),
          endpoint: parts[2] !== '(none)' ? parts[2] : undefined,
          lastHandshake: parseInt(parts[4]) || undefined,
          rxBytes: parseInt(parts[5]) || undefined,
          txBytes: parseInt(parts[6]) || undefined,
        });
      }
    }

    return {
      name: interfaceName,
      publicKey,
      listenPort: parseInt(listenPort) || 51820,
      address: `${SERVER_IP}/24`,
      peers,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Client Configuration Generation
// ============================================================================

export interface ClientConfig {
  deviceId: string;
  devicePublicKey: string;
  serverPublicKey: string;
  serverEndpoint: string;
  clientIp: string;
  dns?: string;
}

/**
 * Generate client configuration for a device.
 */
export function generateClientConfig(client: ClientConfig): string {
  const privateKeyPlaceholder = '<DEVICE_PRIVATE_KEY>';

  return `[Interface]
# Device: ${client.deviceId}
Address = ${client.clientIp}/32
PrivateKey = ${privateKeyPlaceholder}
${client.dns ? `DNS = ${client.dns}` : ''}

[Peer]
# Secure Mobile MCP Server
PublicKey = ${client.serverPublicKey}
Endpoint = ${client.serverEndpoint}
AllowedIPs = ${SERVER_IP}/32
PersistentKeepalive = 25
`;
}

// ============================================================================
// Tunnel Manager Class
// ============================================================================

export interface TunnelConfig {
  enabled: boolean;
  listenPort: number;
  serverEndpoint: string;
}

export class WireGuardTunnel {
  private config: TunnelConfig;
  private keys: WireGuardKeys | null = null;
  private isRunning = false;

  constructor(config: TunnelConfig) {
    this.config = config;
  }

  /**
   * Initialize the tunnel.
   */
  async initialize(): Promise<boolean> {
    if (!this.config.enabled) {
      consola.info('WireGuard tunnel disabled');
      return true;
    }

    if (!isWireGuardAvailable()) {
      consola.warn('WireGuard (wg) command not found. Tunnel disabled.');
      return false;
    }

    this.keys = getOrCreateServerKeys();
    consola.info(`WireGuard server public key: ${this.keys.publicKey}`);
    return true;
  }

  /**
   * Start the tunnel interface.
   */
  async start(): Promise<boolean> {
    if (!this.config.enabled || !this.keys) {
      return false;
    }

    const config: WireGuardConfig = {
      listenPort: this.config.listenPort,
      privateKey: this.keys.privateKey,
      address: `${SERVER_IP}/24`,
      peers: [],
    };

    writeConfig(config);
    this.isRunning = await startInterface();
    return this.isRunning;
  }

  /**
   * Stop the tunnel interface.
   */
  stop(): void {
    if (this.isRunning) {
      stopInterface();
      this.isRunning = false;
    }
  }

  /**
   * Add a device as a peer.
   */
  addDevice(devicePublicKey: string): string | null {
    if (!this.isRunning) return null;

    const ip = allocateIp();
    if (!ip) {
      consola.error('No available IPs in subnet');
      return null;
    }

    if (addPeer(WG_INTERFACE, devicePublicKey, `${ip}/32`, 25)) {
      return ip;
    }

    releaseIp(ip);
    return null;
  }

  /**
   * Remove a device peer.
   */
  removeDevice(devicePublicKey: string, ip: string): boolean {
    if (!this.isRunning) return false;

    const success = removePeer(WG_INTERFACE, devicePublicKey);
    if (success) {
      releaseIp(ip);
    }
    return success;
  }

  /**
   * Get client configuration for a device.
   */
  getClientConfig(deviceId: string, devicePublicKey: string): string | null {
    if (!this.keys) return null;

    const ip = allocateIp();
    if (!ip) return null;

    return generateClientConfig({
      deviceId,
      devicePublicKey,
      serverPublicKey: this.keys.publicKey,
      serverEndpoint: this.config.serverEndpoint,
      clientIp: ip,
    });
  }

  /**
   * Get tunnel status.
   */
  getStatus(): WireGuardInterface | null {
    return getInterfaceStatus();
  }

  /**
   * Get server public key.
   */
  getPublicKey(): string | null {
    return this.keys?.publicKey ?? null;
  }
}
