# ClickPawPay — Complete Agent Handoff Prompt

> **Copy everything below this line and paste it into any AI assistant (Cursor, Windsurf, ChatGPT, Gemini, etc.) to give it full context of this project.**

---

## SYSTEM CONTEXT FOR AI ASSISTANT

You are helping develop **ClickPawPay** — a production-ready, multi-tenant SaaS platform that provides an AI-powered payment agent for Algerian e-commerce sellers. The payment provider is **SlickPay** (Algerian fintech). Users interact with the platform via a natural-language chat interface powered by **Anthropic Claude**.

**GitHub Repository:** `https://github.com/Clickdzpro1/ClickPawPay.git`
**Branch:** `main`
**Status as of 2026-02-27:** All core features implemented. Docker deployment configured.

---

## 1. TECH STACK

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express 4.18
- **ORM:** Prisma 5.7 → PostgreSQL 15/16
- **Auth:** JWT (jsonwebtoken 9, HS256 only), bcryptjs (cost factor 12)
- **Encryption:** AES-256-GCM (Node `crypto` built-in)
- **AI/LLM:** Anthropic Claude (`claude-3-5-sonnet-20241022`) via Messages API with tool calling
- **Rate Limiting:** express-rate-limit 7 + Redis 7 (in-memory fallback if Redis unavailable)
- **Logging:** Winston 3 (JSON, file rotation, console in dev)
- **Validation:** Joi 17
- **HTTP Client:** Axios 1.6 (for SlickPay API calls)
- **Security:** Helmet 7 (CSP, HSTS, etc.)

### Frontend
- **Framework:** React 18 + Vite 5
- **Styling:** Tailwind CSS 3
- **State:** Zustand 4.4.7 with persist middleware
- **Routing:** React Router v6
- **HTTP:** Axios 1.6 (proxied to backend in dev)
- **Icons:** Lucide React
- **Notifications:** react-hot-toast

### Deployment
- **Containerization:** Docker + Docker Compose (5 services)
- **Reverse Proxy:** Nginx (custom Dockerfile, config baked in)
- **Target:** Hostinger VPS (Ubuntu)

---

## 2. DIRECTORY STRUCTURE

```
ClickPawPay/
├── backend/
│   ├── src/
│   │   ├── agent/
│   │   │   ├── engine.js          # Observe-think-act loop (max 10 iterations)
│   │   │   ├── promptBuilder.js   # System prompt for Claude
│   │   │   └── toolExecutor.js    # Dispatches tool calls to SlickPay skills
│   │   ├── api/
│   │   │   ├── auth.js            # POST /api/auth/register, /login, /verify
│   │   │   ├── chat.js            # POST /api/chat + conversation CRUD
│   │   │   ├── balance.js         # GET /api/balance
│   │   │   ├── transactions.js    # GET /api/transactions (list, export, single)
│   │   │   ├── tenants.js         # GET/PATCH /api/tenants/me
│   │   │   └── settings.js        # GET/PUT /api/settings, POST /api/settings/test
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT verification → req.user
│   │   │   ├── tenantScope.js     # Loads tenant from DB → req.tenant
│   │   │   └── rateLimit.js       # Redis-backed rate limiting
│   │   ├── skills/
│   │   │   └── slickpaySkills.js  # 8 SlickPay API methods
│   │   └── utils/
│   │       ├── encryption.js      # AES-256-GCM encrypt/decrypt
│   │       ├── logger.js          # Winston logger singleton
│   │       ├── prisma.js          # Prisma client singleton (prevents pool exhaustion)
│   │       └── slickpayClient.js  # Axios client for SlickPay (with retry)
│   ├── prisma/
│   │   ├── schema.prisma          # 5 models, 4 enums
│   │   └── seed.js                # Demo tenant: demo@demo.com / Demo@1234
│   ├── logs/                      # Winston log output (gitkeep)
│   ├── __tests__/
│   │   └── health.test.js         # Jest test for /health endpoint
│   ├── server.js                  # Express entry point, port 3000
│   ├── docker-entrypoint.sh       # Auto-generates JWT_SECRET/ENCRYPTION_KEY if missing
│   ├── Dockerfile
│   ├── .env.example
│   ├── .eslintrc.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # 3-state routing: setup → login → app
│   │   ├── main.jsx
│   │   ├── index.css              # Tailwind base + custom styles
│   │   ├── components/
│   │   │   └── Layout.jsx         # Navbar + sidebar
│   │   ├── pages/
│   │   │   ├── SetupWizard.jsx    # Tenant registration
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx      # Balance, stats, recent transactions
│   │   │   ├── Chat.jsx           # AI agent chat UI
│   │   │   ├── Transactions.jsx   # Paginated transaction list + CSV export
│   │   │   └── Settings.jsx       # Tenant & SlickPay key management
│   │   ├── store/
│   │   │   └── configStore.js     # Zustand store (persisted)
│   │   └── utils/
│   │       └── api.js             # Axios client + API wrapper functions
│   ├── index.html
│   ├── vite.config.js             # Port 5173, /api proxy → localhost:3000
│   ├── tailwind.config.js
│   ├── nginx.conf                 # Nginx config for SPA (used inside frontend Docker image)
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   ├── Dockerfile                 # Bakes nginx.conf into image
│   ├── nginx.conf                 # Reverse proxy: / → frontend, /api → api:3000
│   ├── logs/                      # (gitkeep)
│   └── ssl/                       # SSL certs (gitignored)
├── docker-compose.yml             # 5 services: postgres, redis, api, frontend, nginx
├── AGENT_HANDOFF_PROMPT.md        # THIS FILE
├── README.md
├── DEPLOYMENT.md
├── SECURITY.md
├── PROJECT-SUMMARY.md
├── GITHUB-SETUP.md
└── .gitignore
```

---

## 3. DATABASE SCHEMA (Prisma — PostgreSQL)

```prisma
// backend/prisma/schema.prisma

model Tenant {
  id             String   @id @default(uuid())
  subdomain      String   @unique           // e.g. "mystore" → mystore.clickpawpay.com
  name           String
  plan           Plan     @default(STARTER)
  slickpayKeyEnc String                     // AES-256-GCM encrypted SlickPay API key
  isActive       Boolean  @default(true)
  requestCount   Int      @default(0)
  requestLimit   Int      @default(100)     // STARTER=100, PRO=1000, BUSINESS=999999
  resetDate      DateTime @default(now())
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  users          User[]
  conversations  Conversation[]
  transactions   Transaction[]
  auditLogs      AuditLog[]
  @@map("tenants")
}

model User {
  id           String    @id @default(uuid())
  tenantId     String
  email        String
  passwordHash String
  role         Role      @default(MEMBER)
  firstName    String?
  lastName     String?
  isActive     Boolean   @default(true)
  lastLogin    DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  tenant       Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  conversations Conversation[]
  @@unique([tenantId, email])
  @@map("users")
}

model Conversation {
  id        String   @id @default(uuid())
  tenantId  String
  userId    String
  messages  Json     // Array of {role, content, timestamp, toolCalls?}
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("conversations")
}

model Transaction {
  id          String          @id @default(uuid())
  tenantId    String
  slickpayRef String?         // SlickPay transaction reference (nullable, unique per tenant)
  type        TransactionType
  amount      Decimal         @db.Decimal(18, 2)
  currency    String          @default("DZD")
  fromAccount String?
  toAccount   String?
  status      TxStatus        @default(PENDING)
  description String?
  metadata    Json?           // Full SlickPay response data
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt
  tenant      Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([tenantId, slickpayRef], name: "unique_tenant_slickpay_ref")
  @@map("transactions")
}

model AuditLog {
  id        String   @id @default(uuid())
  tenantId  String
  action    String   // e.g. "create_transfer", "list_accounts"
  userId    String?
  details   Json
  ipAddress String?
  userAgent String?
  timestamp DateTime @default(now())
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@map("audit_logs")
}

enum Plan          { STARTER PRO BUSINESS }
enum Role          { OWNER ADMIN MEMBER }
enum TransactionType { TRANSFER INVOICE REFUND }
enum TxStatus      { PENDING COMPLETED FAILED CANCELLED }
```

> **CRITICAL:** All enum values are **UPPERCASE**. Frontend status configs must use `PENDING`, `COMPLETED`, `FAILED`, `CANCELLED` — not lowercase.

---

## 4. ALL API ENDPOINTS

### Auth (public, rate-limited: 5 req / 15 min per IP)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create tenant + owner user, returns JWT |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/verify` | Validate JWT token |

**Register request body:**
```json
{
  "subdomain": "mystore",
  "name": "My Store",
  "email": "owner@mystore.com",
  "password": "SecurePass123",
  "slickpayKey": "sk_live_...",
  "plan": "STARTER"
}
```

**Register / Login response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "tenant": { "id": "uuid", "name": "My Store", "subdomain": "mystore", "plan": "STARTER" },
  "user": { "id": "uuid", "email": "owner@mystore.com", "role": "OWNER" }
}
```

### Protected Routes (require `Authorization: Bearer <token>`)

| Method | Path | Middleware | Description |
|--------|------|-----------|-------------|
| GET | `/api/balance` | auth + tenantScope | Fetch SlickPay balance |
| GET | `/api/tenants/me` | auth | Tenant profile + usage |
| PATCH | `/api/tenants/me` | auth | Update name or SlickPay key |
| POST | `/api/chat` | auth + tenantScope + chatLimiter | AI agent chat (10 req/min per user) |
| GET | `/api/chat/conversations` | auth + tenantScope | List 20 recent conversations |
| GET | `/api/chat/:conversationId` | auth + tenantScope | Get specific conversation |
| DELETE | `/api/chat/conversations/:id` | auth + tenantScope | Soft-delete conversation |
| GET | `/api/transactions` | auth + tenantScope | Paginated list with filters + stats |
| GET | `/api/transactions/export` | auth + tenantScope | CSV export (MUST be before /:id route) |
| GET | `/api/transactions/:id` | auth + tenantScope | Single transaction |
| GET | `/api/settings` | auth + tenantScope | Tenant settings (masked SlickPay key) |
| PUT | `/api/settings` | auth + tenantScope | Update settings |
| POST | `/api/settings/test` | auth + tenantScope | Test SlickPay integration |
| GET | `/health` | none | Health check (used by Docker) |

**Chat request:**
```json
{ "message": "Send 5000 DZD to +213555123456", "conversationId": "uuid-or-null" }
```

**Chat response:**
```json
{
  "reply": "I'll transfer 5,000 DZD to +213555123456. Shall I confirm?",
  "conversationId": "uuid",
  "toolCallsExecuted": [{ "tool": "create_transfer", "success": true }]
}
```

**Transactions list response:**
```json
{
  "transactions": [...],
  "total": 42,
  "page": 1,
  "limit": 10,
  "stats": { "today": 3, "month": 15, "total": 42 }
}
```

**Balance response:**
```json
{ "balance": 125000.50, "currency": "DZD", "accountId": "acc_123" }
```

**Settings response:**
```json
{
  "id": "uuid", "name": "My Store", "subdomain": "mystore",
  "plan": "STARTER", "isActive": true,
  "requestCount": 45, "requestLimit": 100, "resetDate": "2026-03-01T00:00:00.000Z",
  "slickpayKeyMasked": "****5678",
  "createdAt": "...", "updatedAt": "..."
}
```

---

## 5. ENVIRONMENT VARIABLES

### `backend/.env` (create from `backend/.env.example`)

```bash
# Server
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com

# Database (required)
DATABASE_URL="postgresql://username:password@localhost:5432/clickpawpay?schema=public"

# Auth (required)
JWT_SECRET=replace-with-at-least-32-random-characters
JWT_EXPIRES_IN=7d

# Encryption (required) — MUST be exactly 64 hex characters (32 bytes)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=replace-with-64-hex-chars

# AI (required)
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-your-api-key-here

# SlickPay
SLICKPAY_API_URL=https://api.slick-pay.com

# Agent tuning
MAX_CONVERSATION_HISTORY=20
MAX_MESSAGE_LENGTH=4000
LLM_TIMEOUT_MS=60000
TOOL_TIMEOUT_MS=30000

# Redis (optional — falls back to in-memory rate limiting if unavailable)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
LOG_DIR=./logs
```

### `frontend/.env` (create from `frontend/.env.example`)
```bash
VITE_API_URL=http://localhost:3000
```

### Docker Compose env vars (in `.env` at root or passed directly):
```bash
DB_PASSWORD=your-database-password
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-64-hex-char-key
ANTHROPIC_API_KEY=sk-ant-...
ALLOWED_ORIGINS=https://yourdomain.com
API_URL=http://localhost:3000
```

---

## 6. FRONTEND STATE MANAGEMENT

### Zustand Store (`frontend/src/store/configStore.js`)

```javascript
// Persisted to localStorage key: "clickpawpay-config" (version 1)
State: {
  isConfigured: boolean,  // Has user ever registered on this device?
  isLoggedIn: boolean,    // Is user authenticated this session?
  tenant: { id, name, subdomain, plan } | null
}

Actions:
  login(token, tenant)  // Stores JWT to localStorage "clickpawpay-token", sets isLoggedIn=true
  logout()              // Clears JWT, sets isLoggedIn=false (keeps isConfigured=true → shows Login)
  resetConfig()         // Full reset → shows SetupWizard
```

### Routing Logic (`frontend/src/App.jsx`)
```
if (!isConfigured)                    → redirect to /setup (SetupWizard)
if (isConfigured && !authenticated)   → redirect to /login (Login)
if (authenticated)                    → /dashboard, /chat, /transactions, /settings
```

Where `authenticated = isLoggedIn || !!localStorage.getItem('clickpawpay-token')`

### localStorage Keys
- `clickpawpay-config` — Zustand persisted state (JSON)
- `clickpawpay-token` — JWT token string

### Axios API Client (`frontend/src/utils/api.js`)
- Base URL: `/api` (proxied to `localhost:3000` in dev via Vite)
- Auto-attaches `Authorization: Bearer <token>` header
- On 401 → clears token, redirects to `/login` (NOT `/setup`)
- Exports: `auth.register()`, `auth.login()`, `auth.verify()`, `chat.send()`, `chat.getConversations()`, `transactions.list()`, `transactions.export()`, `balance.get()`, `settings.get()`, `settings.update()`, `settings.test()`

---

## 7. AGENT ARCHITECTURE

### Flow
```
POST /api/chat
  → chat.js (checks request limit, creates/resumes conversation)
  → AgentEngine.processMessage({ tenantId, userId, userMessage, conversationHistory, slickpayKey })
    → promptBuilder.buildSystemPrompt(tenant)
    → Anthropic Messages API (tool_choice: auto)
    → If tool_use response → ToolExecutor.execute(toolName, args, slickpayKey)
      → SlickPaySkills[toolName](args)  // calls SlickPay REST API
    → Appends tool_result → LLM again (up to 10 iterations)
    → Returns { reply, toolCallsExecuted[] }
  → Saves updated messages to Conversation (DB)
  → Creates Transaction record if transfer/invoice succeeded
  → Creates AuditLog entry
  → Returns { reply, conversationId, toolCallsExecuted }
```

### Shared Prisma Singleton (`backend/src/utils/prisma.js`)
All API files must use `require('../utils/prisma')` — NOT `new PrismaClient()` directly. This prevents connection pool exhaustion.

### The 8 SlickPay Skills (`backend/src/skills/slickpaySkills.js`)

| Tool Name | Method | SlickPay Endpoint | Required Args |
|-----------|--------|-------------------|---------------|
| `get_balance` | getBalance | GET /api/v2/users/balance | slickpayKey |
| `list_accounts` | listAccounts | GET /api/v2/users/accounts | slickpayKey |
| `create_account` | createAccount | POST /api/v2/users/accounts | firstName, lastName, phone, slickpayKey |
| `create_transfer` | createTransfer | POST /api/v2/transfers | toPhone, amount, description, slickpayKey |
| `get_transfer_details` | getTransferDetails | GET /api/v2/transfers/:id | transferId, slickpayKey |
| `list_transfers` | listTransfers | GET /api/v2/transfers | slickpayKey, limit? |
| `calculate_commission` | calculateCommission | GET /api/v2/commissions | amount, slickpayKey |
| `create_invoice` | createInvoice | POST /api/v2/invoices | amount, description, slickpayKey, customerEmail? |

- Phone pattern: `/^\+?[0-9]{9,15}$/`
- Amount max: 10,000,000 DZD
- All tools validated with Joi before API call

---

## 8. ENCRYPTION

### SlickPay Key Storage
- **Format:** `iv:authTag:ciphertext` (all hex-encoded, colon-separated)
- **Algorithm:** AES-256-GCM
- **Key source:** `ENCRYPTION_KEY` env var (must be exactly 64 hex chars = 32 bytes)
- **Files:** `backend/src/utils/encryption.js`

```javascript
// Usage
const { encrypt, decrypt } = require('../utils/encryption');
const encrypted = encrypt(slickpayApiKey);   // "iv:authTag:ciphertext"
const original  = decrypt(encrypted);        // back to plaintext
```

---

## 9. DOCKER SETUP

### Services (`docker-compose.yml`)

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | postgres:16-alpine | internal | Database |
| `redis` | redis:7-alpine | internal | Rate limiting |
| `api` | built from `./backend/Dockerfile` | internal:3000 | Node.js backend |
| `frontend` | built from `./frontend/Dockerfile` | internal:80 | React SPA (Nginx) |
| `nginx` | built from `./nginx/Dockerfile` | 80, 443 | Reverse proxy |

### Network
All services on: `clickpawpay-network`

### Startup Sequence
1. `postgres` starts → healthcheck (pg_isready)
2. `redis` starts → healthcheck (redis-cli ping)
3. `api` starts (after postgres + redis healthy) → `docker-entrypoint.sh` runs → auto-generates JWT_SECRET/ENCRYPTION_KEY if missing → `npx prisma db push --skip-generate && node server.js`
4. `frontend` starts (after api)
5. `nginx` starts (after api + frontend)

### Commands
```bash
# Start everything
docker-compose up -d

# View logs
docker-compose logs -f api

# Run database seed (demo tenant)
docker-compose exec api node prisma/seed.js

# Rebuild after code changes
docker-compose up -d --build

# Stop everything
docker-compose down

# Stop + delete volumes (full reset)
docker-compose down -v
```

### Nginx Routing (reverse proxy)
- `GET /` → frontend container (React SPA)
- `GET /api/*` → api container:3000
- `GET /health` → api container:3000

---

## 10. LOCAL DEVELOPMENT SETUP

### Prerequisites
- Node.js 18+
- PostgreSQL 15/16 running locally
- Redis (optional — rate limiting falls back to in-memory)
- Anthropic API key

### Steps
```bash
# 1. Clone
git clone https://github.com/Clickdzpro1/ClickPawPay.git
cd ClickPawPay

# 2. Backend setup
cd backend
cp .env.example .env
# Edit .env — fill in DATABASE_URL, JWT_SECRET (32+ chars),
# ENCRYPTION_KEY (64 hex chars), ANTHROPIC_API_KEY

# Generate ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Install deps
npm install

# Push schema to database
npx prisma db push

# (Optional) Seed demo data
node prisma/seed.js  # demo@demo.com / Demo@1234

# Start backend
npm run dev   # nodemon server.js → port 3000

# 3. Frontend setup (new terminal)
cd ../frontend
cp .env.example .env
npm install
npm run dev   # Vite → port 5173, proxies /api → localhost:3000
```

### Demo Credentials (after seeding)
- **Subdomain:** demo
- **Email:** demo@demo.com
- **Password:** Demo@1234

---

## 11. KEY GOTCHAS & KNOWN ISSUES

### Critical Order Dependency
In `backend/src/api/transactions.js`, the `/export` route MUST be registered BEFORE the `/:id` route, or Express will match "export" as an ID:
```javascript
router.get('/export', ...)  // MUST come first
router.get('/:id', ...)
```

### Prisma Singleton — IMPORTANT
Every API file (`auth.js`, `chat.js`, `tenants.js`, `transactions.js`, `settings.js`, `tenantScope.js`) must import Prisma from the shared singleton:
```javascript
const prisma = require('../utils/prisma');    // CORRECT
// NOT: const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient();
```

### Docker Entrypoint Auto-Secret Generation
The `docker-entrypoint.sh` will auto-generate `JWT_SECRET` and `ENCRYPTION_KEY` if not set. BUT these are **ephemeral** — they reset on every container restart, which means:
- All JWT sessions become invalid after restart
- All stored SlickPay keys become unreadable after restart
**Always set these env vars explicitly in production.**

### CORS Configuration
`ALLOWED_ORIGINS` must be set to your actual domain in production. Default in dev: `http://localhost:5173` only.

### Seed Script Dotenv
`backend/prisma/seed.js` explicitly loads dotenv with `require('dotenv').config({ path: '../.env' })` since it runs from the `prisma/` directory.

### JWT Payload Structure
```javascript
{ userId: "uuid", tenantId: "uuid", role: "OWNER|ADMIN|MEMBER" }
```

### SlickPay Key Masking
Settings endpoint returns `slickpayKeyMasked: "****" + last4chars` — the actual key is never exposed via API.

### Rate Limiting
- Auth routes: 5 requests / 15 minutes per IP
- Chat routes: 10 messages / 1 minute per userId
- Redis-backed; gracefully falls back to in-memory if Redis is down

---

## 12. WHAT IS NOT YET IMPLEMENTED

These features are planned but not built:

- [ ] **GitHub Actions CI/CD** — No `.github/workflows/` directory exists
- [ ] **Email notifications** — No email service integrated
- [ ] **Subscription billing** — Plans are stored but no payment for the SaaS itself
- [ ] **WhatsApp/Telegram integration** — Chat only through web UI currently
- [ ] **Multi-user per tenant** — Only OWNER user is created at registration; no invite flow
- [ ] **Webhook support** — No incoming webhooks from SlickPay
- [ ] **i18n / Arabic language support** — UI is English only
- [ ] **Password reset flow** — No forgot-password email flow

---

## 13. IMPORTANT FILE CONTENTS FOR QUICK REFERENCE

### `backend/server.js` route registration (critical order)
```javascript
app.use('/api/auth',         authLimiter, authRoutes);              // Public
app.use('/api/tenants',      authMiddleware, tenantRoutes);         // Protected
app.use('/api/chat',         authMiddleware, tenantScopeMiddleware, chatLimiter, chatRoutes);
app.use('/api/transactions', authMiddleware, tenantScopeMiddleware, transactionRoutes);
app.use('/api/balance',      authMiddleware, tenantScopeMiddleware, balanceRoutes);
app.use('/api/settings',     authMiddleware, tenantScopeMiddleware, settingsRoutes);
```

### `frontend/vite.config.js` proxy
```javascript
server: {
  port: 5173,
  proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } }
}
```

### Prisma singleton pattern (all backend files)
```javascript
const prisma = require('../utils/prisma');
// or from middleware:
const prisma = require('./utils/prisma');
```

---

## 14. WHAT TO ASK/DO ON ANOTHER PLATFORM

When you start a new session on another AI platform with this document, tell the AI:

> "I have the ClickPawPay project cloned from GitHub at `https://github.com/Clickdzpro1/ClickPawPay.git`. Here is the full project specification: [paste this document]. I need help with: [describe your specific issue]."

**Common next tasks:**
1. Set up GitHub Actions for CI/CD (lint + test on PR, Docker build + push on merge to main)
2. Add multi-user invite flow (email invites per tenant)
3. Fix a specific bug (describe it here)
4. Add a new AI skill to the agent
5. Deploy to Hostinger VPS step by step

---

*Document generated: 2026-02-27 | Project version: main @ becf321*
