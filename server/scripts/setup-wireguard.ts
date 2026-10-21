#!/usr/bin/env tsx
/**
 * WireGuard Setup Script
 *
 * Configures WireGuard tunnel for secure MCP communication:
 * - Generates server WireGuard keypair
 * - Creates interface configuration
 * - Provides instructions for client setup
 *
 * Requirements:
 * - macOS: wireguard-go (brew install wireguard-go wireguard-tools)
 * - Linux: wireguard-tools (apt install wireguard-tools)
 *
 * Usage:
 *   pnpm setup:wireguard
 *   # or
 *   tsx scripts/setup-wireguard.ts [--start]
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir, platform, networkInterfaces } from 'os';
import { execSync } from 'child_process';
import { consola } from 'consola';
import sodium from 'sodium-native';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG_DIR = join(homedir(), '.secure-mobile-mcp');
const WG_DIR = join(CONFIG_DIR, 'wireguard');
const WG_INTERFACE = 'wg-mcp0';
const WG_PORT = 51820;
const SUBNET_BASE = '10.200.0';
const SERVER_IP = `${SUBNET_BASE}.1`;

// ============================================================================
// Helpers
// ============================================================================

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
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

function checkCommand(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Key Generation
// ============================================================================

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

function generateWgKeyPair(): KeyPair {
  const publicKey = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES);
  const secretKey = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES);
  sodium.crypto_box_keypair(publicKey, secretKey);
  return {
    publicKey: publicKey.toString('base64'),
    privateKey: secretKey.toString('base64'),
  };
}

// ============================================================================
// Configuration Generation
// ============================================================================

interface WgConfig {
  interfaceName: string;
  address: string;
  listenPort: number;
  privateKey: string;
  peers: Array<{
    publicKey: string;
    allowedIps: string;
    persistentKeepalive?: number;
  }>;
}

function generateServerConfig(config: WgConfig): string {
  const lines = [
    '[Interface]',
    `# Secure Mobile MCP WireGuard Interface`,
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

function generateClientConfig(
  deviceId: string,
  clientIp: string,
  serverPublicKey: string,
  serverEndpoint: string
): string {
  return `[Interface]
# Device: ${deviceId}
# Replace <PRIVATE_KEY> with the device's private key
Address = ${clientIp}/32
PrivateKey = <PRIVATE_KEY>
DNS = 1.1.1.1

[Peer]
# Secure Mobile MCP Server
PublicKey = ${serverPublicKey}
Endpoint = ${serverEndpoint}
AllowedIPs = ${SERVER_IP}/32
PersistentKeepalive = 25
`;
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const startInterface = process.argv.includes('--start');
  const os = platform();

  consola.start('Secure Mobile MCP - WireGuard Setup');
  console.log();

  // Check platform support
  if (os !== 'darwin' && os !== 'linux') {
    consola.error(`Unsupported platform: ${os}`);
    consola.info('WireGuard setup requires macOS or Linux');
    process.exit(1);
  }

  // Check prerequisites
  consola.info('Checking prerequisites...');

  const hasWg = checkCommand('wg');
  const hasWgQuick = checkCommand('wg-quick');
  const hasWgGo = checkCommand('wireguard-go');

  if (!hasWg) {
    consola.error('wireguard-tools not found');
    if (os === 'darwin') {
      consola.info('Install with: brew install wireguard-tools');
    } else {
      consola.info('Install with: sudo apt install wireguard-tools');
    }
    process.exit(1);
  }

  if (os === 'darwin' && !hasWgGo) {
    consola.warn('wireguard-go not found (optional but recommended for macOS)');
    consola.info('Install with: brew install wireguard-go');
  }

  consola.success('Prerequisites satisfied');
  console.log();

  // Ensure directories
  ensureDir(CONFIG_DIR);
  ensureDir(WG_DIR);

  // Generate or load keys
  const privateKeyPath = join(WG_DIR, 'private.key');
  const publicKeyPath = join(WG_DIR, 'public.key');

  let keys: KeyPair;

  if (existsSync(privateKeyPath) && existsSync(publicKeyPath)) {
    keys = {
      privateKey: readFileSync(privateKeyPath, 'utf8').trim(),
      publicKey: readFileSync(publicKeyPath, 'utf8').trim(),
    };
    consola.info('Using existing WireGuard keypair');
  } else {
    keys = generateWgKeyPair();
    writeFileSync(privateKeyPath, keys.privateKey + '\n');
    chmodSync(privateKeyPath, 0o600);
    writeFileSync(publicKeyPath, keys.publicKey + '\n');
    chmodSync(publicKeyPath, 0o644);
    consola.success('Generated WireGuard keypair');
  }

  consola.info(`Server public key: ${keys.publicKey}`);
  console.log();

  // Generate server configuration
  const configPath = join(WG_DIR, `${WG_INTERFACE}.conf`);
  const serverConfig = generateServerConfig({
    interfaceName: WG_INTERFACE,
    address: `${SERVER_IP}/24`,
    listenPort: WG_PORT,
    privateKey: keys.privateKey,
    peers: [], // Peers added dynamically
  });

  writeFileSync(configPath, serverConfig);
  chmodSync(configPath, 0o600);
  consola.success(`Generated server configuration: ${configPath}`);

  // Generate sample client configuration
  const localIp = getLocalIP();
  const clientConfigPath = join(WG_DIR, 'client-sample.conf');
  const clientConfig = generateClientConfig(
    '<DEVICE_ID>',
    `${SUBNET_BASE}.2`,
    keys.publicKey,
    `${localIp}:${WG_PORT}`
  );

  writeFileSync(clientConfigPath, clientConfig);
  consola.success(`Generated sample client configuration: ${clientConfigPath}`);
  console.log();

  // Start interface if requested
  if (startInterface) {
    consola.info('Starting WireGuard interface...');

    try {
      if (os === 'darwin') {
        // macOS: use wg-quick with userspace implementation
        if (hasWgGo) {
          execSync(`sudo wg-quick up ${configPath}`, { stdio: 'inherit' });
        } else {
          consola.warn('wireguard-go not found, manual setup required');
        }
      } else {
        // Linux: use wg-quick
        execSync(`sudo wg-quick up ${configPath}`, { stdio: 'inherit' });
      }
      consola.success('WireGuard interface started');
    } catch (error) {
      consola.error('Failed to start interface:', error);
      consola.info('You may need to run with sudo privileges');
    }
  }

  // Display summary
  consola.box({
    title: 'WireGuard Setup Complete',
    message: [
      '',
      `  Interface:     ${WG_INTERFACE}`,
      `  Server IP:     ${SERVER_IP}`,
      `  Listen Port:   ${WG_PORT}`,
      `  Public Key:    ${keys.publicKey}`,
      '',
      `  Configuration: ${configPath}`,
      `  Sample Client: ${clientConfigPath}`,
      '',
      '  To start the interface:',
      `    sudo wg-quick up ${configPath}`,
      '',
      '  To stop the interface:',
      `    sudo wg-quick down ${WG_INTERFACE}`,
      '',
      '  To add a peer dynamically:',
      '    sudo wg set wg-mcp0 peer <PUBLIC_KEY> allowed-ips <IP>/32',
      '',
    ].join('\n'),
  });

  // Firewall notes
  console.log();
  consola.info('Firewall configuration:');
  if (os === 'darwin') {
    consola.info('  macOS: Allow incoming connections in System Settings > Network > Firewall');
  } else {
    consola.info(`  Linux: sudo ufw allow ${WG_PORT}/udp`);
  }
}

main().catch((err) => {
  consola.error('WireGuard setup failed:', err);
  process.exit(1);
});
