#!/usr/bin/env tsx
/**
 * Key Generation Script
 *
 * Generates all required cryptographic keys for the secure MCP server:
 * - Ed25519 signing keypair (server identity)
 * - X25519 encryption keypair (session key exchange)
 * - WireGuard keypair (tunnel encryption)
 *
 * Usage:
 *   pnpm setup:keys
 *   # or
 *   tsx scripts/generate-keys.ts [--force]
 */

import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { consola } from 'consola';
import { randomUUID, createHash } from 'crypto';

// Inline key generation to avoid import issues during setup
import sodium from 'sodium-native';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG_DIR = join(homedir(), '.secure-mobile-mcp');
const KEYS_DIR = join(CONFIG_DIR, 'keys');
const WG_DIR = join(CONFIG_DIR, 'wireguard');

// ============================================================================
// Helpers
// ============================================================================

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    consola.info(`Created directory: ${dir}`);
  }
}

function writeKeyFile(path: string, content: string, isSecret: boolean): void {
  writeFileSync(path, content + '\n');
  chmodSync(path, isSecret ? 0o600 : 0o644);
}

function fingerprintKey(publicKey: Buffer): string {
  const hash = createHash('sha256').update(publicKey).digest();
  return hash.subarray(0, 8).toString('hex').match(/.{2}/g)!.join(':').toUpperCase();
}

// ============================================================================
// Key Generation
// ============================================================================

interface KeyPair {
  publicKey: Buffer;
  secretKey: Buffer;
}

function generateSigningKeyPair(): KeyPair {
  const publicKey = Buffer.alloc(sodium.crypto_sign_PUBLICKEYBYTES);
  const secretKey = Buffer.alloc(sodium.crypto_sign_SECRETKEYBYTES);
  sodium.crypto_sign_keypair(publicKey, secretKey);
  return { publicKey, secretKey };
}

function generateBoxKeyPair(): KeyPair {
  const publicKey = Buffer.alloc(sodium.crypto_box_PUBLICKEYBYTES);
  const secretKey = Buffer.alloc(sodium.crypto_box_SECRETKEYBYTES);
  sodium.crypto_box_keypair(publicKey, secretKey);
  return { publicKey, secretKey };
}

function saveKeyPair(name: string, keyPair: KeyPair, dir: string): void {
  const publicKeyPath = join(dir, `${name}.pub`);
  const secretKeyPath = join(dir, `${name}.key`);

  writeKeyFile(publicKeyPath, keyPair.publicKey.toString('base64'), false);
  writeKeyFile(secretKeyPath, keyPair.secretKey.toString('base64'), true);

  consola.success(`Generated ${name} keypair`);
  consola.info(`  Public key: ${publicKeyPath}`);
  consola.info(`  Private key: ${secretKeyPath} (restricted)`);
  consola.info(`  Fingerprint: ${fingerprintKey(keyPair.publicKey)}`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const forceRegenerate = process.argv.includes('--force');

  consola.start('Secure Mobile MCP - Key Generation');
  console.log();

  // Ensure directories
  ensureDir(CONFIG_DIR);
  ensureDir(KEYS_DIR);
  ensureDir(WG_DIR);

  // Generate server ID if not exists
  const serverIdPath = join(CONFIG_DIR, 'server-id');
  if (!existsSync(serverIdPath) || forceRegenerate) {
    const serverId = randomUUID();
    writeFileSync(serverIdPath, serverId);
    chmodSync(serverIdPath, 0o644);
    consola.success(`Generated server ID: ${serverId}`);
  } else {
    const serverId = readFileSync(serverIdPath, 'utf8').trim();
    consola.info(`Existing server ID: ${serverId}`);
  }
  console.log();

  // Generate signing keypair
  const signingPubPath = join(KEYS_DIR, 'server-signing.pub');
  if (!existsSync(signingPubPath) || forceRegenerate) {
    const signingKeys = generateSigningKeyPair();
    saveKeyPair('server-signing', signingKeys, KEYS_DIR);
  } else {
    consola.info('Signing keypair already exists (use --force to regenerate)');
    const pubKey = Buffer.from(readFileSync(signingPubPath, 'utf8').trim(), 'base64');
    consola.info(`  Fingerprint: ${fingerprintKey(pubKey)}`);
  }
  console.log();

  // Generate encryption keypair
  const boxPubPath = join(KEYS_DIR, 'server-box.pub');
  if (!existsSync(boxPubPath) || forceRegenerate) {
    const boxKeys = generateBoxKeyPair();
    saveKeyPair('server-box', boxKeys, KEYS_DIR);
  } else {
    consola.info('Encryption keypair already exists (use --force to regenerate)');
    const pubKey = Buffer.from(readFileSync(boxPubPath, 'utf8').trim(), 'base64');
    consola.info(`  Fingerprint: ${fingerprintKey(pubKey)}`);
  }
  console.log();

  // Generate WireGuard keypair
  const wgPubPath = join(WG_DIR, 'public.key');
  if (!existsSync(wgPubPath) || forceRegenerate) {
    const wgKeys = generateBoxKeyPair(); // WireGuard uses X25519
    writeKeyFile(join(WG_DIR, 'public.key'), wgKeys.publicKey.toString('base64'), false);
    writeKeyFile(join(WG_DIR, 'private.key'), wgKeys.secretKey.toString('base64'), true);

    consola.success('Generated WireGuard keypair');
    consola.info(`  Public key: ${wgKeys.publicKey.toString('base64')}`);
  } else {
    consola.info('WireGuard keypair already exists (use --force to regenerate)');
    const pubKey = readFileSync(wgPubPath, 'utf8').trim();
    consola.info(`  Public key: ${pubKey}`);
  }
  console.log();

  // Generate sample .env file
  const envPath = join(process.cwd(), '.env.example');
  const envContent = `# Secure Mobile MCP Server Configuration

# Server Identity
SERVER_ID=${readFileSync(serverIdPath, 'utf8').trim()}

# Network Ports
WS_PORT=5987
API_PORT=5988

# Database
DB_PATH=./secure-mcp.db

# Security Settings
REQUIRE_MTLS=true
MAX_AUTH_ATTEMPTS=5
AUTH_LOCKOUT_MS=300000
SESSION_TTL_MS=86400000
AUTH_TIMEOUT=10000

# Timeouts
COMMAND_TIMEOUT=30000
HEARTBEAT_INTERVAL=30000
HEARTBEAT_TIMEOUT=90000

# WireGuard Tunnel (optional)
WIREGUARD_ENABLED=false
WG_PORT=51820
WG_INTERFACE=wg-mcp0
WG_SUBNET=10.200.0.0/24
WG_ADDRESS=10.200.0.1/24
`;

  writeFileSync(envPath, envContent);
  consola.success(`Generated .env.example`);
  consola.info('  Copy to .env and adjust as needed');
  console.log();

  // Summary
  consola.box({
    title: 'Key Generation Complete',
    message: [
      '',
      `  Config directory: ${CONFIG_DIR}`,
      '',
      '  Generated keys:',
      '    - Server signing keypair (Ed25519)',
      '    - Server encryption keypair (X25519)',
      '    - WireGuard keypair (X25519)',
      '',
      '  Next steps:',
      '    1. Copy .env.example to .env',
      '    2. Run: pnpm dev',
      '',
    ].join('\n'),
  });
}

main().catch((err) => {
  consola.error('Key generation failed:', err);
  process.exit(1);
});
