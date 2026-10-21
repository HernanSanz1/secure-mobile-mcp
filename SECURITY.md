# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

Send reports to: **security@matterwardlabs.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge your report within 48 hours and provide a detailed response within 7 days.

## Threat Model

### Assets
- **User credentials**: Device pairing tokens, session keys
- **Device access**: ADB bridge, accessibility services
- **Communication**: WebSocket connections between server and clients

### Trust Boundaries
1. **Server ↔ Android Device**: ADB over TCP/USB. Assumes physical or network access.
2. **Server ↔ AI Client**: MCP protocol over stdio/HTTP. Client must be authenticated.
3. **Dashboard ↔ Server**: Local HTTP. No auth by default (localhost only).

### Threats & Mitigations

| Threat | Mitigation |
|--------|------------|
| Unauthorized device control | Device pairing requires explicit user approval on Android |
| Credential theft | Tokens stored in SQLite with restrictive permissions; never logged |
| Man-in-the-middle | Use TLS for production deployments; ADB over USB preferred |
| Command injection | All shell commands sanitized; no eval/exec of user input |
| Denial of service | Rate limiting on WebSocket connections |

### Out of Scope
- Physical access attacks on the Android device
- Compromise of the host running the MCP server
- Vulnerabilities in third-party dependencies (report upstream)

## Secure Development Practices

### Code
- All PRs require review before merge
- CodeQL SAST runs on every PR and weekly
- Dependencies audited with `pnpm audit` and Dependabot

### Secrets
- Never commit secrets, keys, or credentials
- Use GitHub Secrets for CI/CD
- Pre-commit hooks detect secrets with gitleaks

### Dependencies
- Pin exact versions in lockfiles
- Review dependency changes in PRs
- High/critical vulnerabilities block merge

### Release
- Signed APKs only for releases
- Keystore never committed; stored in GitHub Secrets
- Tags trigger automated, auditable builds

## Security Checklist for Contributors

- [ ] No hardcoded credentials or API keys
- [ ] User input validated and sanitized
- [ ] Sensitive data not logged
- [ ] New dependencies reviewed for security
- [ ] Error messages don't leak internal details
