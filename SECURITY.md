# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅ Yes    |

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, send a private email to:

📧 **info@clickdz.ai**

### What to include in your report
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Our commitment
- We will acknowledge your report within **48 hours**
- We will investigate and provide an update within **7 days**
- Critical vulnerabilities will be patched within **7 days**
- We will credit you in the changelog (unless you prefer to remain anonymous)

## Security Features Built Into ClickClawPay

- **AES-256-GCM** encryption for all stored SlickPay API keys
- **JWT** authentication with short-lived tokens
- **Rate limiting** via Redis to prevent abuse
- **Tenant isolation** — each seller's data is strictly separated
- **Audit logging** — all payment operations are logged with IP and user agent
- **Helmet.js** — security headers on all API responses
- **Secret scanning** — GitHub monitors this repo for accidental credential commits
