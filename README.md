# ClickClawPay 🚀

![Node](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)
![License](https://img.shields.io/badge/License-MIT-blue)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)
![AI](https://img.shields.io/badge/AI-Claude%20Powered-blueviolet?logo=anthropic)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)

**AI-Powered Payment Management for Algerian Sellers**

ClickClawPay is an AI agent platform that helps Algerian e-commerce sellers manage SlickPay payments through natural language. Built on OpenClaw-inspired architecture, it provides a hosted, multi-tenant SaaS solution where sellers can link their SlickPay API keys and control payments via conversational AI.

---

## 🌟 Features

- **Natural Language Payment Control** - "Send 5000 DA to +213555123456" instead of clicking through dashboards
- **Multi-Tenant Architecture** - Each seller gets their own subdomain (`yourstore.clickclawpay.com`)
- **Secure API Key Management** - AES-256 encrypted SlickPay credentials
- **Real-Time Transaction Tracking** - Full audit trail of all payment operations
- **Usage-Based Billing** - Starter, Pro, and Business tiers with request limits
- **SlickPay Integration** - Transfers, invoices, balance checks, commission calculations

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Nginx Reverse Proxy                       │
│          (Subdomain routing + SSL termination)               │
└────────┬───────────────────────────────────────┬────────────┘
         │                                       │
    ┌────▼────────┐                      ┌──────▼──────┐
    │  Frontend   │                      │  Backend    │
    │  (React)    │◄─────────────────────┤  (Node.js)  │
    └─────────────┘      API calls       └──────┬──────┘
                                                 │
                 ┌───────────────────────────────┼─────────────┐
                 │                               │             │
            ┌────▼─────┐                   ┌────▼────┐  ┌─────▼──────┐
            │ Agent    │                   │  Prisma │  │  SlickPay  │
            │ Engine   │                   │   ORM   │  │    API     │
            │ (LLM)    │                   └────┬────┘  └────────────┘
            └──────────┘                        │
                                           ┌────▼────────┐
                                           │ PostgreSQL  │
                                           └─────────────┘
```

### Core Components

1. **Agent Engine** (`src/agent/engine.js`) - OpenClaw-style observe-think-act loop
2. **Tool Executor** (`src/agent/toolExecutor.js`) - Maps LLM tool calls to SlickPay API operations
3. **SlickPay Skills** (`src/skills/slickpaySkills.js`) - 8 payment skills (transfers, invoices, balance, etc.)
4. **Multi-Tenant Middleware** - Automatic tenant scoping per subdomain
5. **Encryption Layer** - Protects SlickPay API keys at rest

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (optional)
- SlickPay API key
- Anthropic Claude API key (or OpenAI)

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/yourusername/clickclawpay.git
cd clickclawpay
```

**2. Backend setup**

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
```

**3. Database setup**

```bash
npx prisma migrate dev --name init
npx prisma generate
```

**4. Start backend**

```bash
npm run dev
```

**5. Frontend setup (new terminal)**

```bash
cd frontend
npm install
npm run dev
```

**6. Access the app**

- Frontend: http://localhost:5173
- API: http://localhost:3000
- Health check: http://localhost:3000/health

---

## 🐳 Docker Deployment

**Full stack with one command:**

```bash
docker-compose up -d
```

This starts:
- PostgreSQL database
- Redis cache
- Backend API (port 3000)
- Frontend web (port 5173)
- Nginx reverse proxy (port 80)

---

## 📦 Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `JWT_SECRET` | JWT signing key | `your-secret-key` |
| `ENCRYPTION_KEY` | AES-256 key (32 bytes hex) | Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | Claude API key | `sk-ant-api03-xxx` |
| `SLICKPAY_API_URL` | SlickPay base URL | `https://api.slick-pay.com` |

---

## 🔐 Security Features

- **JWT Authentication** - Stateless, 7-day token expiry
- **AES-256-GCM Encryption** - SlickPay keys encrypted at rest
- **Rate Limiting** - 10 req/min for chat, 5 attempts/15min for auth
- **Tenant Isolation** - Database-level row security
- **Audit Logging** - Every payment action logged with IP, timestamp, details
- **HTTPS Only** - SSL termination at Nginx (production)

---

## 💰 Pricing Tiers

| Plan | Price/Month | Requests | Users | Features |
|------|------------|----------|-------|----------|
| **Starter** | 2,000 DZD | 100 | 1 | Basic skills |
| **Pro** | 5,000 DZD | 1,000 | 5 | All skills + priority support |
| **Business** | 12,000 DZD | Unlimited | Unlimited | Custom skills + API access |

---

## 🛠️ Development

**Run tests**

```bash
npm test
```

**Generate Prisma client**

```bash
npx prisma generate
```

**Create database migration**

```bash
npx prisma migrate dev --name description_here
```

**View database**

```bash
npx prisma studio
```

---

## 📚 API Documentation

See [API.md](./docs/API.md) for complete endpoint reference.

**Quick examples:**

```bash
# Register new tenant
POST /api/auth/register
{
  "subdomain": "mystore",
  "name": "My Store",
  "email": "owner@mystore.com",
  "password": "secure123",
  "slickpayKey": "your-slickpay-key",
  "plan": "STARTER"
}

# Login
POST /api/auth/login
{
  "subdomain": "mystore",
  "email": "owner@mystore.com",
  "password": "secure123"
}

# Send message to agent
POST /api/chat
Authorization: Bearer <token>
{
  "message": "Send 5000 DA to +213555123456"
}
```

---

## 🤖 Available Skills

The AI agent can perform these SlickPay operations:

1. **create_account** - Register new payment account
2. **list_accounts** - View all linked accounts
3. **create_transfer** - Send money (requires confirmation)
4. **get_transfer_details** - Check payment status
5. **list_transfers** - View recent transactions
6. **calculate_commission** - Preview fees
7. **create_invoice** - Generate payment link
8. **get_balance** - Check current balance

---

## 🚦 Production Deployment

**VPS Setup (Ubuntu 22.04)**

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. Clone repo
git clone https://github.com/yourusername/clickclawpay.git
cd clickclawpay

# 3. Configure environment
cp .env.example .env
nano .env  # Add production values

# 4. Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 5. Start services
docker-compose up -d

# 6. Run migrations
docker-compose exec api npx prisma migrate deploy

# 7. Configure DNS
# Point *.clickclawpay.com A record to your VPS IP

# 8. Setup SSL (Let's Encrypt)
sudo apt install certbot
sudo certbot certonly --standalone -d clickclawpay.com -d *.clickclawpay.com
```

---

## 📊 Monitoring

**Check service health:**

```bash
curl http://localhost:3000/health
```

**View logs:**

```bash
docker-compose logs -f api
tail -f backend/logs/combined.log
```

**Database backups:**

```bash
docker-compose exec postgres pg_dump -U clickclawpay clickclawpay > backup.sql
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

## 🆘 Support

- **Documentation:** [docs/](./docs/)
- **Issues:** [GitHub Issues](https://github.com/yourusername/clickclawpay/issues)
- **Email:** support@clickclawpay.com
- **Discord:** [Join our community](https://discord.gg/clickclawpay)

---

## 🙏 Acknowledgments

- Inspired by [OpenClaw](https://github.com/openclaw/openclaw)
- Built with [SlickPay API](https://developers.slick-pay.com)
- Powered by Anthropic Claude

---

**Made with ❤️ for Algerian e-commerce sellers**
