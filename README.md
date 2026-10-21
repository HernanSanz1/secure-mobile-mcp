<p align="center">
  <img src="./assets/logo.png" alt="Aster Logo" width="120" />
</p>

<h1 align="center">Aster — Secure Fork</h1>

<p align="center">
  <a href="https://openally.ai"><img src="./assets/openally-mark.svg" width="15" alt="" /></a>
  <sub>by <a href="https://openally.ai"><b>OpenAlly</b></a><sup>&trade;</sup></sub>
</p>

<p align="center">
  <strong>Your AI CoPilot on Mobile — with cryptographic authentication</strong>
</p>

<p align="center">
  <a href="https://github.com/HernanSanz1/secure-mobile-mcp/releases/tag/v1.0.0"><img src="https://img.shields.io/badge/APK-v1.0.0-success?style=flat-square" alt="APK Download" /></a>
  <a href="https://github.com/HernanSanz1/secure-mobile-mcp"><img src="https://img.shields.io/badge/repo-secure--mobile--mcp-blue?style=flat-square" alt="Repository" /></a>
  <a href="https://github.com/HernanSanz1/secure-mobile-mcp/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/49-MCP_tools-2dd4bf?style=flat-square" alt="49 MCP tools" />
  <img src="https://img.shields.io/badge/Android_8%2B-supported-3DDC84?style=flat-square&logo=android&logoColor=white" alt="Android 8+" />
  <img src="https://img.shields.io/badge/no_root-required-ff6b6b?style=flat-square" alt="No root required" />
  <img src="https://img.shields.io/badge/self--hosted-privacy_first-gold?style=flat-square" alt="Self-hosted" />
</p>

<p align="center">
  <a href="#security-model">Security Model</a> •
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#usage">Usage</a> •
  <a href="#integrations">Integrations</a> •
  <a href="#mcp-tools">MCP Tools</a>
</p>

<p align="center">
  <img src="./assets/aster_poster.jpg" alt="Aster — Your AI CoPilot on Mobile" width="100%" />
</p>

---

## Security Model

This fork implements **cryptographic authentication** not present in the original project. Every connection is authenticated using ECDSA P-256 signatures with hardware-backed key storage.

### QR-Based Pairing

1. The server generates a QR code containing its public key and a unique token
2. The Android app scans the QR and generates its own keys in Android Keystore (hardware-backed)
3. Public keys are exchanged — only this device can connect to this server
4. The pairing is permanent until explicitly revoked

### Cryptographic Handshake

- Every WebSocket connection starts with a signed handshake
- The server verifies the device's signature before accepting any commands
- Connections without valid credentials are **silently ignored** — the port appears closed to attackers
- No approval gate visible to unauthorized parties

### Hardware-Backed Keys

- ECDSA P-256 keys stored in Android Keystore
- Protected by TEE (Trusted Execution Environment) or StrongBox when available
- Private keys **never leave the device** — not even to the server

### Signed Commands

- The server signs every command it sends
- The device verifies signatures before execution
- Prevents command injection even if the network is compromised

### Comparison with Original

| Aspect | Original | This Fork |
|--------|----------|-----------|
| Authentication | Status-based approval gate | Cryptographic keys |
| Pairing | IP + port | QR with key exchange |
| Unauthorized connections | Visible as pending | Silently rejected |
| Key storage | N/A | Android Keystore (hardware) |
| Commands | Unsigned | Signed by server |
| Attack surface | Network-visible approval queue | Nothing visible without keys |

---

**Aster** bridges any Android device to AI assistants like Claude through the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). Use it as your AI CoPilot on mobile — or plug a spare Android into a charger, install Aster, and give your AI its own device. It can call you, text you, monitor notifications, and act on its own. Screenshots, UI automation, file management, media search, and 49 MCP tools — all through natural language.

<table align="center">
  <tr>
    <td align="center"><sub><b>Connection Setup</b></sub></td>
    <td align="center"><sub><b>Device Dashboard</b></sub></td>
    <td align="center"><sub><b>Tool Call Logs</b></sub></td>
    <td align="center"><sub><b>Permissions</b> &mdash; "Ask all together"</sub></td>
  </tr>
  <tr>
    <td><img src="./apps/android/screenshots/connection-setup.jpg" width="190" alt="Connection Setup, dark theme" /></td>
    <td><img src="./apps/android/screenshots/device-dashboard.jpg" width="190" alt="Device Dashboard, dark theme" /></td>
    <td><img src="./apps/android/screenshots/services-logs.jpg" width="190" alt="Tool Call Logs, dark theme" /></td>
    <td><img src="./apps/android/screenshots/permissions.jpg" width="190" alt="Permissions, dark theme" /></td>
  </tr>
  <tr>
    <td><img src="./apps/android/screenshots/light/connection-setup.jpg" width="190" alt="Connection Setup, light theme" /></td>
    <td><img src="./apps/android/screenshots/light/device-dashboard.jpg" width="190" alt="Device Dashboard, light theme" /></td>
    <td><img src="./apps/android/screenshots/light/services-logs.jpg" width="190" alt="Tool Call Logs, light theme" /></td>
    <td><img src="./apps/android/screenshots/light/permissions.jpg" width="190" alt="Permissions, light theme" /></td>
  </tr>
</table>

<table align="center">
  <tr>
    <td align="center"><sub><b>Companion Face Overlay</b></sub></td>
    <td align="center"><sub><b>On-device MCP Server</b> &mdash; Local MCP mode</sub></td>
  </tr>
  <tr>
    <td><img src="./apps/android/screenshots/companion-overlay.jpg" width="190" alt="Companion Face Overlay, dark theme" /></td>
    <td><img src="./apps/android/screenshots/on-device-mcp.jpg" width="190" alt="On-device MCP Server, dark theme" /></td>
  </tr>
  <tr>
    <td><img src="./apps/android/screenshots/light/companion-overlay.jpg" width="190" alt="Companion Face Overlay, light theme" /></td>
    <td><img src="./apps/android/screenshots/light/on-device-mcp.jpg" width="190" alt="On-device MCP Server, light theme" /></td>
  </tr>
</table>

<p align="center">
  <sub><b>Every screen ships in both themes</b> &mdash; dark on the top row, light on the bottom. Aster follows your device setting.</sub>
</p>

## Features

- **Screen Control** — Take screenshots, analyze UI hierarchy, tap, swipe, and type
- **App Automation** — Launch apps, click buttons by text/ID, navigate with gestures
- **Device Access** — Read notifications, SMS, clipboard, location, and battery info
- **File Management** — Browse, read, write, and delete files on device storage
- **Media Search** — Find photos and videos using natural language queries
- **Calls, SMS & Voice** — Make calls, send SMS, or use `make_call_with_voice` to dial and speak a TTS message on speakerphone
- **System Actions** — Back, Home, Recents, volume control, and more
- **Camera & Video** — Take photos or record video remotely — pet cam, baby monitor, security checks
- **Proactive Events** — Your AI reacts to incoming SMS, notifications, and device events in real-time via webhooks
- **AI's Own Phone** — Dedicate a spare Android to your AI. It monitors, calls, texts, and acts on its own
- **App Automations** — Record a flow on-device (taps, text, scrolls) with the recording overlay, replay it as an automation
- **Companion Face** — An animated on-screen companion that talks along with TTS and reacts to your music, built on a privacy-focused event classifier
- **Safety Rails** — A persistent kill-switch notification while the AI controls the screen, and a fail-closed package policy that blocks control of banking apps by default

## What's new in this fork

All original features plus:

- **ECDSA P-256 cryptographic authentication** with hardware-backed keys
- **QR-based pairing** — scan once, paired forever
- **Signed commands** — server authenticates every instruction
- **Silent rejection** — unauthorized connections see nothing
- **Zero trust surface** — no approval queue visible to attackers

## Web Dashboard

The server ships with a web dashboard on `:5989` — device registry and approvals, live telemetry, click-through screen control, filtered logs, a file browser, panels for messages, apps, storage and media, and an explorer for all 49 MCP tools.

<table align="center">
  <tr>
    <td align="center"><sub><b>Overview</b></sub></td>
    <td align="center"><sub><b>Device Telemetry</b></sub></td>
  </tr>
  <tr>
    <td><img src="./mcp/dashboard/screenshots/dark/dashboard-overview.png" width="430" alt="Overview, dark theme" /></td>
    <td><img src="./mcp/dashboard/screenshots/dark/device-telemetry.png" width="430" alt="Device Telemetry, dark theme" /></td>
  </tr>
  <tr>
    <td><img src="./mcp/dashboard/screenshots/light/dashboard-overview.png" width="430" alt="Overview, light theme" /></td>
    <td><img src="./mcp/dashboard/screenshots/light/device-telemetry.png" width="430" alt="Device Telemetry, light theme" /></td>
  </tr>
</table>

<table align="center">
  <tr>
    <td align="center"><sub><b>Screen Control</b></sub></td>
    <td align="center"><sub><b>MCP Tool Explorer</b></sub></td>
  </tr>
  <tr>
    <td><img src="./mcp/dashboard/screenshots/dark/device-screen-control.png" width="430" alt="Screen Control, dark theme" /></td>
    <td><img src="./mcp/dashboard/screenshots/dark/mcp-tool-explorer.png" width="430" alt="MCP Tool Explorer, dark theme" /></td>
  </tr>
  <tr>
    <td><img src="./mcp/dashboard/screenshots/light/device-screen-control.png" width="430" alt="Screen Control, light theme" /></td>
    <td><img src="./mcp/dashboard/screenshots/light/mcp-tool-explorer.png" width="430" alt="MCP Tool Explorer, light theme" /></td>
  </tr>
</table>

<p align="center">
  <sub><b>Every page ships in both themes</b> &mdash; dark on the top row, light on the bottom. The dashboard follows your system setting.</sub>
</p>

<details>
<summary><b>More screenshots</b> &mdash; registry, panels, logs, connect, files, event forwarding</summary>
<br>

<table align="center">
  <tr>
    <td align="center"><sub><b>Device Registry</b></sub></td>
    <td align="center"><sub><b>Messages</b></sub></td>
  </tr>
  <tr>
    <td><img src="./mcp/dashboard/screenshots/dark/device-registry.png" width="430" alt="Device Registry, dark theme" /></td>
    <td><img src="./mcp/dashboard/screenshots/dark/panel-messages.png" width="430" alt="Messages, dark theme" /></td>
  </tr>
  <tr>
    <td><img src="./mcp/dashboard/screenshots/light/device-registry.png" width="430" alt="Device Registry, light theme" /></td>
    <td><img src="./mcp/dashboard/screenshots/light/panel-messages.png" width="430" alt="Messages, light theme" /></td>
  </tr>
</table>

<table align="center">
  <tr>
    <td align="center"><sub><b>Apps Inventory</b></sub></td>
    <td align="center"><sub><b>Storage &amp; Media</b></sub></td>
  </tr>
  <tr>
    <td><img src="./mcp/dashboard/screenshots/dark/panel-apps.png" width="430" alt="Apps Inventory, dark theme" /></td>
    <td><img src="./mcp/dashboard/screenshots/dark/panel-storage.png" width="430" alt="Storage &amp; Media, dark theme" /></td>
  </tr>
  <tr>
    <td><img src="./mcp/dashboard/screenshots/light/panel-apps.png" width="430" alt="Apps Inventory, light theme" /></td>
    <td><img src="./mcp/dashboard/screenshots/light/panel-storage.png" width="430" alt="Storage &amp; Media, light theme" /></td>
  </tr>
</table>

<table align="center">
  <tr>
    <td align="center"><sub><b>Logs</b></sub></td>
    <td align="center"><sub><b>Connect</b></sub></td>
  </tr>
  <tr>
    <td><img src="./mcp/dashboard/screenshots/dark/logs.png" width="430" alt="Logs, dark theme" /></td>
    <td><img src="./mcp/dashboard/screenshots/dark/connect.png" width="430" alt="Connect, dark theme" /></td>
  </tr>
  <tr>
    <td><img src="./mcp/dashboard/screenshots/light/logs.png" width="430" alt="Logs, light theme" /></td>
    <td><img src="./mcp/dashboard/screenshots/light/connect.png" width="430" alt="Connect, light theme" /></td>
  </tr>
</table>

<table align="center">
  <tr>
    <td align="center"><sub><b>File Browser</b></sub></td>
    <td align="center"><sub><b>Event Forwarding</b></sub></td>
  </tr>
  <tr>
    <td><img src="./mcp/dashboard/screenshots/dark/file-browser.png" width="430" alt="File Browser, dark theme" /></td>
    <td><img src="./mcp/dashboard/screenshots/dark/event-forwarding.png" width="430" alt="Event Forwarding, dark theme" /></td>
  </tr>
  <tr>
    <td><img src="./mcp/dashboard/screenshots/light/file-browser.png" width="430" alt="File Browser, light theme" /></td>
    <td><img src="./mcp/dashboard/screenshots/light/event-forwarding.png" width="430" alt="Event Forwarding, light theme" /></td>
  </tr>
</table>
</details>

**What the dashboard covers**

| Page | What it does |
|---|---|
| **Overview** | Device counts, online state, recent activity, server health |
| **Devices** | Registry with approve / reject / un-reject / delete, live online state |
| **Device detail** | Full telemetry — ABIs, build tags, radio, RAM, storage, display, uptime, live battery |
| **Screen control** | Live screenshot, click-through tapping, gestures, text input, global actions, element search |
| **Messages** | Read and send SMS |
| **Notifications** | Read the notification stream, post notifications |
| **Apps** | Installed-app inventory with paging, package list, launch by intent |
| **Storage & media** | Storage analytics, large-file finder, media indexing, natural-language media search |
| **Contacts / Alarms / Audio / Location / Shell / Utilities** | The remaining tool families as purpose-built panels |
| **Logs** | Level, device and full-text filters, pagination, structured event payloads |
| **Connect** | MCP, dashboard, WebSocket and Tailscale URLs with a ready-to-paste `.mcp.json` |
| **Tools** | Every registered MCP tool, grouped exactly as the Android app groups them |

Run it with `aster start` (or `aster dashboard` to open it), then visit <http://localhost:5989>.

## Quick Start

### 1. Download the APK

Download from [Releases v1.0.0](https://github.com/HernanSanz1/secure-mobile-mcp/releases/tag/v1.0.0) and install on your Android device.

### 2. Install the MCP Server

```bash
cd mcp
npm install
npm start
```

### 3. Pair Your Device (QR)

1. Open the dashboard at `http://localhost:5989`
2. Click **Add Device** to generate a QR code
3. In the Android app, go to **Settings > Pair via QR**
4. Scan the QR — keys are generated automatically in hardware
5. Connect — the cryptographic handshake happens automatically

### 4. Configure Your AI Client

Add to your `.mcp.json` or Claude settings:

```json
{
  "mcpServers": {
    "secure-mobile": {
      "type": "http",
      "url": "http://localhost:5988/mcp"
    }
  }
}
```

## Usage

### CLI Commands

```bash
aster start              # Start the server (with optional event forwarding setup)
aster stop               # Stop the server
aster status             # Show server and device status
aster dashboard          # Open web dashboard

aster devices list       # List connected devices
aster devices approve    # Approve a pending device
aster devices reject     # Reject a device
aster devices remove     # Remove a device

aster set-event-forwarding    # Configure proactive event forwarding
                              # (alias: aster set-openclaw-callbacks)
```

### Status & Health Checks

Need to confirm the server is up before pointing an agent at it? Three surfaces:

```bash
aster status                              # human-readable server + device snapshot
curl http://localhost:5988/api/health     # -> { "status": "ok", "timestamp": ... }
curl http://localhost:5988/api/stats      # device counts
```

`aster status` reads `~/.aster/status.json`, written by the running server. The `/api/health` endpoint is the one to poll from scripts and monitors.

### Example Prompts

Once connected, try these with your AI assistant:

**Your CoPilot on Mobile:**

> "Take a screenshot of my phone"

> "Open YouTube and search for cooking videos"

> "Read my latest notifications"

> "Find photos from my trip to Mumbai last month"

> "What apps are using the most storage?"

**AI's own phone — let it act for you:**

> "Call me if my flight gets delayed and tell me the new time" *(uses make_call_with_voice)*

> "Text me when my delivery arrives" *(uses send_sms)*

> "Back up new photos to Google Drive every night"

## Proactive Event Forwarding

Aster can push real-time events from the phone to your AI agent via webhook. Your AI reacts the moment something happens — no polling needed.

| Event | Example |
|-------|---------|
| **SMS** | Auto-reply while driving, forward messages, extract info |
| **Notifications** | Flight delays, delivery updates, ride arrivals — instant alerts |
| **Device status** | Device online/offline, new pairing requests |
| **Incoming call** | Phone rings — log it, ping you, or wait for pickup |

Works out of the box with **OpenClaw**, **ClawdBot**, and **MoltBot**. Configure via dashboard or CLI:

```bash
aster set-event-forwarding
```

## Integrations

### Claude Code / Claude Desktop

Add to your `.mcp.json` or Claude settings:

```json
{
  "mcpServers": {
    "aster": {
      "type": "http",
      "url": "http://localhost:5988/mcp"
    }
  }
}
```

### OpenClaw / Moltbot / Clawbot

Aster is available as a skill on [ClawHub](https://clawhub.ai/satyajit/aster). Install it directly:

```bash
clawhub install aster
```

Or add manually to your OpenClaw/Moltbot/Clawbot skills directory and configure the MCP endpoint.

### Any MCP-Compatible Client

Aster exposes a standard MCP HTTP endpoint at `http://localhost:5988/mcp` that works with any MCP-compatible AI client.

### Which URL goes where (topologies)

The most common setup mistake is pasting the wrong port into the wrong app. Rule of thumb: **`:5987` is for the phone, `:5988/mcp` is for your AI client, `:5989` is the dashboard in your browser.**

| Topology | `aster` server runs on | Android app connects to | MCP client connects to |
|---|---|---|---|
| Same machine *(recommended)* | your PC / Mac / NAS | `ws://<pc-ip>:5987` | `http://localhost:5988/mcp` |
| LAN, separate machines | PC / Mac / NAS | `ws://<server-lan-ip>:5987` | `http://<server-lan-ip>:5988/mcp` |
| Tailscale | any tailnet box | `wss://<magicdns>` (via `tailscale serve`) or `ws://<ts-ip>:5987` | `http://<ts-ip>:5988/mcp` |
| Everything on the phone | — none needed | n/a | Use the app's **Local MCP Server** mode (see [Connection Modes](#connection-modes)) and point the client at `http://<phone-ip>:8080/mcp` |

Running the npm server itself inside Termux on the phone is untested and unsupported — the Local MCP mode exists precisely so you don't have to.

## MCP Tools

**49 tools**, exposed over MCP at `http://localhost:5988/mcp`. Each does one job your AI can call by name:

| Category | Tools | What they do |
|----------|-------|--------------|
| **Screen** | `take_screenshot`, `get_screen_hierarchy`, `find_element` | Capture the screen, read the live UI tree, locate elements |
| **Input** | `input_gesture`, `input_text`, `click_by_text`, `click_by_id` | Tap, swipe, type, and click elements by visible text or ID |
| **Navigation** | `global_action`, `launch_intent` | Back / Home / Recents / Notifications / power & lock, and launch apps or deep links |
| **Device** | `list_devices`, `get_device_info`, `get_battery`, `get_location` | Enumerate devices and read status, battery, GPS |
| **Notifications & SMS** | `read_notifications`, `read_sms`, `send_sms`, `post_notification` | Read notifications and SMS, send texts, push a notification |
| **Calls** | `make_call`, `make_call_with_voice` | Dial a number — optionally speak a TTS message on speakerphone |
| **Contacts** | `search_contacts`, `list_contacts_full`, `delete_contacts` | Look up, page through, and delete address-book entries |
| **Files** | `list_files`, `read_file`, `write_file`, `delete_file` | Browse and manage on-device storage |
| **Storage & Media** | `analyze_storage`, `find_large_files`, `index_media_metadata`, `search_media` | Audit space, find big files, index EXIF, search photos/videos by query |
| **Camera** | `take_photo`, `record_video` | Capture a photo or a short (max 8s) clip remotely |
| **Audio** | `speak_tts`, `play_audio`, `stop_audio`, `vibrate`, `get_volume`, `set_volume` | Speak text, play/stop audio, buzz, read and set stream volumes |
| **Clipboard** | `get_clipboard`, `set_clipboard` | Read and write the device clipboard |
| **Alarms** | `get_alarms`, `set_alarm`, `dismiss_alarm`, `delete_alarm` | List, create, dismiss, and delete clock alarms |
| **UI overlay** | `show_overlay`, `show_toast` | Render a web overlay or a toast on the device |
| **Apps & shell** | `list_packages`, `list_installed_apps`, `execute_shell` | List installed apps (with metadata); run a shell command **in the app's own unprivileged sandbox — no root**, with 30s / 1MB limits |

## Architecture

```
┌─────────────────┐     Cryptographic     ┌─────────────────┐
│                 │      Handshake        │                 │
│  Aster Server   │◄────────────────────►│  Android App    │
│  (Node.js)      │     WebSocket         │  (Keystore +    │
│  + Crypto       │     + Signatures      │   Accessibility)│
└────────┬────────┘                       └─────────────────┘
         │
         │ MCP (HTTP)
         │
┌────────▼────────┐
│                 │
│  Claude / AI    │
│                 │
└─────────────────┘
```

## Connection Modes

The diagram above is the *default* path, but it's not the only one. The companion app speaks **three** transports — pick one per device:

| Mode | How a client reaches the phone | Use it when |
|------|--------------------------------|-------------|
| **Remote WebSocket** *(default)* | The phone dials out to the `aster` Node server; your AI talks MCP-over-HTTP to that server (the flow above). | You run the server on a laptop / home box and point any MCP client at it. |
| **Local MCP Server** | The phone runs its **own** MCP server on-device — embedded **Ktor** + the **MCP Kotlin SDK** (Streamable HTTP), default port `8080`. No Node server in the middle. | You want an MCP client (local, or remote over [Tailscale](#tailscale-support)) to hit the phone **directly**. |
| **IPC (Binder)** | An app **on the same device** — e.g. the [OpenAlly.ai](https://openally.ai) app — drives Aster over Android **Binder IPC**, with 32-char token auth (constant-time check) plus an on-device approval prompt. Never touches the network. | An on-device agent (like [OpenAlly.ai](https://openally.ai)) controls the phone locally — lowest latency, fully offline. |

All three run on the same `CommandHandler` registry, but they do **not** expose the same catalogue. Remote WebSocket goes through the Node server, which registers **49 tools**, every one prefixed `aster_`. Local MCP Server and IPC talk to the handler map directly and expose **77 unprefixed actions** instead — a different set, not a superset: 47 names overlap, 29 on-device actions have no `aster_*` equivalent (`observe`, `tap`, `scroll`, the `screen_*` human-in-the-loop verbs, the overlay and companion-face verbs), and exactly one server tool has no on-device action behind it (`aster_list_devices`, which brokers between phones and so means nothing on the phone itself). They also differ in *how a client reaches the phone* and *how it's trusted*: the server's cryptographic handshake (Remote WS), a token + approval prompt (IPC), or your own network controls (Local MCP). The on-device **Kill Switch** and **PackagePolicyGuard** (below) apply in every mode.

## Security & Privacy

Aster is **self-hosted and local-first**. The server, the device, and your data stay on hardware you own.

### Cryptographic Authentication (This Fork)

This fork replaces the original status-based approval with ECDSA P-256 cryptographic authentication:

- **QR pairing**: Server and device exchange public keys via QR scan
- **Hardware-backed keys**: Private keys stored in Android Keystore (TEE/StrongBox)
- **Signed handshake**: Every connection authenticated with signatures
- **Signed commands**: Server signs all commands; device verifies before execution
- **Silent rejection**: Unauthorized connections see nothing — no pending queue, no attack surface

### Nothing leaves your network by default

- **No telemetry, no analytics, no tracking.** None. (Grep the source if you don't believe us.)
- Devices, logs, and the registry live in a **local SQLite file** (`./aster.db`).
- The AI/MCP client pulls data over the **local** MCP HTTP endpoint — the server and device are on your network.
- The **only** outbound call is the *optional* event-forwarding webhook, which is **off** unless you run `aster set-event-forwarding`. Even then it POSTs to **an endpoint you specify** (default `http://localhost:18789`) — never a vendor server.

### Android permissions — and why each one

Aster is a remote-control tool, so it asks for a lot. No root required. Every sensitive permission maps to a capability:

| Permission(s) | Why |
|---|---|
| `BIND_ACCESSIBILITY_SERVICE` | The core: read the UI tree, tap, swipe, type. This is screen control. |
| `BIND_NOTIFICATION_LISTENER_SERVICE` | Read notifications and forward them as proactive events. |
| `READ_SMS` / `SEND_SMS` / `RECEIVE_SMS` | Read and send texts; react to incoming SMS. |
| `CALL_PHONE`, `READ_PHONE_STATE`, `MODIFY_AUDIO_SETTINGS` | `make_call` / `make_call_with_voice` (speakerphone TTS). |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` | `get_location`. |
| `CAMERA`, `FOREGROUND_SERVICE_CAMERA` | Take photos / record video remotely. |
| `READ_CONTACTS` / `WRITE_CONTACTS` | Resolve and manage contacts for calls/SMS. |
| `MANAGE_EXTERNAL_STORAGE` (+ legacy read/write) | Browse, read, write, delete files. |
| `QUERY_ALL_PACKAGES`, `PACKAGE_USAGE_STATS` | List installed apps and usage. |
| `SYSTEM_ALERT_WINDOW` | Control overlay and the kill-switch banner. |
| `FOREGROUND_SERVICE` / `..._SPECIAL_USE` (`device_control`), `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Keep the always-on control service alive for a dedicated AI phone. |

### On-device safety rails

Two Android-side guards run regardless of what the AI asks:

- **Kill Switch** — while a screen-control session is active, a persistent high-priority *"AI is controlling your phone — STOP"* notification is shown. Tapping **STOP** aborts the control loop immediately and clears the overlay.
- **PackagePolicyGuard** — a **fail-closed** denylist. If the foreground app can't be identified, control is **refused**. A bundled banking/payments denylist (PhonePe, Paytm, PayPal, Venmo, Binance, ...) blocks screen control over financial apps by default unless you explicitly allow it. Read-only actions (`observe` / screenshot / hierarchy / `find_element`) are always permitted.

## Securing the connection

Three sanctioned setups. Pick one; mixing `wss://` with a port that only speaks `ws://` is the usual failure.

### Trusted LAN — `ws://`

Same Wi-Fi / ethernet. In the Aster app:

```
ws://<server-lan-ip>:5987
```

MCP client (Claude, AnythingLLM, OpenClaw, …):

```
http://<server-lan-ip>:5988/mcp
```

`aster status` prints this as `MCP: http://<ip>:5988/mcp  (paste into your MCP client)`. Do not expose these ports on the public internet.

On-device **Local MCP** (no npm server) listens on **`:8080`**, not `:5988`.

### Tailscale Serve — `wss://` for the app

If Tailscale is running, Aster runs `tailscale serve` for the device WebSocket (`https://:443` → local `:5987`) and the Nuxt dashboard (`:8443` → local `:5989`). Copy the **`wss://<magicdns>`** URL printed by `aster status` into the **Android app**. That is automatic TLS for the device link.

**Serve does not terminate Fastify.** The MCP HTTP endpoint stays on the API port. Paste this into your MCP client, not the Serve dashboard URL:

```
http://<tailscale-ip>:5988/mcp
```

Never `https://<magicdns>:8443/mcp`.

### Reverse proxy (Traefik / Caddy)

Terminate TLS in front of `:5987` and point the app at `wss://your.domain`. The Node process still speaks plaintext locally.

**Caddy** (`Caddyfile`):

```
aster.example.com {
    reverse_proxy localhost:5987
}
```

App URL: `wss://aster.example.com`

Optional MCP + dashboard:

```
mcp.aster.example.com {
    reverse_proxy localhost:5988
}

dash.aster.example.com {
    reverse_proxy localhost:5989
}
```

MCP client: `https://mcp.aster.example.com/mcp`

**Traefik** (file-provider sketch; HTTP routers already upgrade WebSockets):

```yaml
http:
  routers:
    aster-ws:
      rule: Host(`aster.example.com`)
      entryPoints: [websecure]
      tls:
        certResolver: letsencrypt
      service: aster-ws
  services:
    aster-ws:
      loadBalancer:
        servers:
          - url: http://127.0.0.1:5987
```

Same idea as Caddy: TLS at the proxy, `ws://` on localhost. Don't put `wss://<lan-ip>:5987` in the app — that port does not speak TLS.

## Why not just scrcpy / ADB?

Those are great — for a human at a keyboard with a USB cable. Aster solves a different problem.

| | scrcpy / raw ADB | Aster |
|---|---|---|
| **Connection** | USB cable or USB debugging on the LAN | App over the network — **no USB debugging** |
| **Remote** | Needs tunneling/ADB-over-TCP setup | Works anywhere via [Tailscale](#tailscale-support) |
| **Interface** | Mirrored screen + raw shell commands | High-level **MCP tools** an AI calls in natural language (`take_screenshot`, `click_by_text`, `send_sms`, `make_call_with_voice`...) |
| **Built for** | A person driving manually | An **AI agent** acting on its own, with an approval gate and kill switch |
| **Proactive** | Pull-only | Pushes SMS/notification events to your AI in real-time |

Aster isn't a screen mirror — it's a tool layer that lets an AI *operate* the phone, with safety rails scrcpy was never meant to have.

## Project Structure

```
Aster/
├── apps/android/     # Android companion app — Kotlin, Jetpack Compose (Material3),
│                     #   Hilt, Room, DataStore, OkHttp WS client; core is an
│                     #   AccessibilityService + NotificationListener + foreground
│                     #   'device_control' service. Also ML Kit OCR, CameraX, Ktor.
│                     #   minSdk 26 (Android 8), compileSdk 36, arm64-v8a, com.aster
│                     #   + KeyManager, HandshakeManager for ECDSA P-256 auth
├── mcp/              # MCP server (npm: aster-mcp) — Node.js + TypeScript (ESM, pnpm):
│   │                 #   Fastify (HTTP/API + MCP-over-HTTP), ws (device WebSocket),
│   │                 #   better-sqlite3, zod, commander CLI, @modelcontextprotocol/sdk
│   │                 #   + crypto endpoints for pairing and signature validation
│   └── dashboard/    # Web dashboard — Nuxt 4 (Vue) + Tailwind v4, SSR child process
└── skill/            # ClawHub / OpenClaw skill — a single SKILL.md manifest (no code)
```

## Requirements

- **Server**: Node.js >= 20
- **Android**: Android 8.0+ (API 26) with Accessibility Service enabled
- **Network**: Device and server on same network (or Tailscale)

## Troubleshooting & FAQ

<details>
<summary><strong>Device shows "connected" but every command fails or times out</strong></summary>
<br>
The device might not have completed the cryptographic handshake. Check the app logs for signature verification errors. Re-pair via QR if needed.
</details>

<details>
<summary><strong>QR scan fails or keys don't generate</strong></summary>
<br>
Make sure the device has a lock screen configured — Android Keystore requires device security. Check that the camera permission is granted.
</details>

<details>
<summary><strong>Device disconnects when I switch Wi-Fi / mobile networks</strong></summary>
<br>
The companion now reconnects automatically after a Wi-Fi / mobile switch (backoff, "Reconnecting…" in the app) instead of staying dead on a dropped socket. If it still never comes back, the advertised address itself changed — <code>aster status</code> prints a LAN IP that is only valid on that network. Keep both ends on the same network, or use a stable <a href="#tailscale-support">Tailscale</a> IP so the address survives network changes.
</details>

<details>
<summary><strong><code>make_call_with_voice</code> dials but there's no audio</strong></summary>
<br>
The TTS plays over the call audio path on speakerphone, so it needs <code>CALL_PHONE</code>, <code>READ_PHONE_STATE</code>, and <code>MODIFY_AUDIO_SETTINGS</code> granted, plus speakerphone reachable. It also waits a few seconds after dialing (default 8s, <code>waitSeconds</code>) for the call to be answered before speaking. Confirm those permissions in the app and that the device isn't on silent / call audio routed to a headset.
</details>

<details>
<summary><strong>Firewall / which ports do I need open?</strong></summary>
<br>
Three local ports:
<ul>
<li><code>5987</code> — WebSocket device link (<code>WS_PORT</code>)</li>
<li><code>5988</code> — API + MCP HTTP endpoint (<code>POST /mcp</code>) and health (<code>DASHBOARD_PORT</code>)</li>
<li><code>5989</code> — Nuxt web dashboard</li>
</ul>
The device needs <code>5987</code>; your AI client needs <code>5988</code>. Allow these on your LAN (or Tailscale) and keep them off the public internet.
</details>

## Development

Want to hack on Aster or add a tool? Here's the loop.

### Prerequisites

- **Node.js >= 20**, **pnpm 9.15.0** (the server), **JDK 17** (the Android app)

### MCP server

```bash
git clone https://github.com/HernanSanz1/secure-mobile-mcp
cd secure-mobile-mcp/mcp
pnpm install              # postinstall rebuilds better-sqlite3 native bindings

pnpm dev                  # tsx watch (server only)
pnpm dev:all              # server + Nuxt dashboard concurrently

pnpm build                # tsc -> dist/
pnpm build:all            # server + dashboard bundle
node dist/index.js        # or: aster start

pnpm test                 # vitest
pnpm lint                 # eslint
```

### Android app

```bash
cd apps/android
./gradlew assembleDebug    # debug APK
./gradlew assembleRelease  # signed release (arm64-v8a, minify+shrink on)
```

Release signing reads a keystore from env vars (`KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`; default `aster-release.jks`).

### Adding a new MCP tool

A tool is a **server-side triad + one device handler**:

1. **`mcp/src/mcp/tools.ts`** — add a zod input schema (e.g. `export const FooSchema = z.object({ deviceId: z.string(), ... })`).
2. **`mcp/src/mcp/tools.ts`** — add an entry to `TOOL_DEFINITIONS` (name `aster_foo`, description, JSON-schema `inputSchema`) so MCP clients can discover it.
3. **`mcp/src/mcp/handler.ts`** — add a case in `handleToolCall` that validates args and calls `sendCommand(deviceId, '<action>', params)`.
4. **Android** — implement a `CommandHandler` (`supportedActions()` + `handle()`) under `apps/android/.../service/handlers`, then register it in `provideCommandHandlers` in `di/ModeModule.kt`. Each handler's `supportedActions()` auto-maps action names into the `@CommandHandlerMap`.

## Tailscale Support

Aster automatically detects Tailscale and prints a `wss://<magicdns>` URL for the **app**, plus `http://<ts-ip>:5988/mcp` for your MCP client. Serve TLS-terminates the device WebSocket and the dashboard; it does **not** expose `/mcp`. See [Securing the connection](#securing-the-connection). Perfect for a dedicated AI phone that stays plugged in at home while you're away.

## OpenAlly.ai

<p align="center">
  <a href="https://openally.ai"><img src="./assets/openally-mark.svg" width="64" alt="OpenAlly" /></a>
</p>
<p align="center">
  <a href="https://openally.ai"><strong>OpenAlly.ai</strong></a> — the cross-platform AI agent platform Aster was built alongside.
</p>

Aster also ships as the **end-to-end companion** for the [**OpenAlly.ai**](https://openally.ai) app. OpenAlly drives the phone entirely on-device through Aster's [IPC (Binder) mode](#connection-modes) — no server, no network, nothing leaves the device. It works **out of the box**: install both, approve the on-device handshake once, and OpenAlly has the full on-device surface locally — all **77** unprefixed actions, which is a different and larger set than the 49 `aster_*` tools the Node server registers.

## License

GPL-3.0

---

<p align="center">
  <sub>Secure fork with cryptographic authentication by <a href="https://github.com/HernanSanz1">HernanSanz1</a></sub>
</p>

<p align="center">
  <sub>Based on <a href="https://github.com/satyajiit/aster-mcp">aster-mcp</a> by <a href="https://github.com/satyajiit">Satyajit Pradhan</a></sub>
</p>

<p align="center">
  <sub>OpenAlly is a trademark of Matterward Labs Private Limited.</sub>
</p>
