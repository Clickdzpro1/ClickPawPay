# ClickPawPay Deployment Guide

## VPS Setup (Ubuntu 22.04)

### 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y git curl wget nano ufw

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Create non-root user
sudo adduser clickpawpay
sudo usermod -aG sudo clickpawpay
su - clickpawpay
```

### 2. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 3. Clone and Configure Project

```bash
# Clone repository
cd ~
git clone https://github.com/Clickdzpro1/ClickPawPay.git
cd ClickPawPay

# Create environment file
cp .env.example .env
nano .env
```

**Required .env configuration:**

```bash
NODE_ENV=production
PORT=3000

# Generate strong JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Generate encryption key
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Database
DATABASE_URL="postgresql://clickpawpay:STRONG_PASSWORD@postgres:5432/clickpawpay"

# Your Anthropic API key
ANTHROPIC_API_KEY=sk-ant-your-key-here

# SlickPay
SLICKPAY_API_URL=https://api.slick-pay.com

# CORS (replace with your domain)
ALLOWED_ORIGINS=https://clickpawpay.com,https://*.clickpawpay.com
```

### 4. DNS Configuration

**At your domain registrar (e.g., Namecheap, GoDaddy):**

```
Type  Name  Value            TTL
A     @     YOUR_VPS_IP      300
A     *     YOUR_VPS_IP      300
```

Wait 5-10 minutes for DNS propagation. Test:

```bash
dig clickpawpay.com
dig test.clickpawpay.com
```

### 5. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot

# Stop any services using port 80
docker-compose down

# Get wildcard certificate
sudo certbot certonly --standalone \
  -d clickpawpay.com \
  -d *.clickpawpay.com \
  --agree-tos \
  --email your-email@example.com

# Copy certificates to nginx directory
sudo mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/clickpawpay.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/clickpawpay.com/privkey.pem nginx/ssl/
sudo chmod -R 644 nginx/ssl/*

# Setup auto-renewal
sudo crontab -e
# Add this line:
0 0 * * 0 certbot renew --quiet && docker-compose restart nginx
```

### 6. Start Services

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Run database migrations
docker-compose exec api npx prisma migrate deploy
```

### 7. Create First Tenant

```bash
curl -X POST https://clickpawpay.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "subdomain": "demo",
    "name": "Demo Store",
    "email": "admin@demo.com",
    "password": "SecurePassword123!",
    "slickpayKey": "your-slickpay-key",
    "plan": "PRO"
  }'
```

### 8. Monitoring & Maintenance

**View logs:**

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api

# Application logs
tail -f backend/logs/combined.log
```

**Database backup:**

```bash
# Create backup script
nano ~/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR
docker-compose exec -T postgres pg_dump -U clickpawpay clickpawpay > $BACKUP_DIR/backup_$DATE.sql
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
echo "Backup completed: backup_$DATE.sql"
```

```bash
chmod +x ~/backup.sh
# Schedule daily backups
crontab -e
# Add: 0 2 * * * ~/backup.sh
```

**Restore from backup:**

```bash
docker-compose exec -T postgres psql -U clickpawpay clickpawpay < backup.sql
```

### 9. Performance Tuning

**PostgreSQL optimization (docker-compose.yml):**

```yaml
postgres:
  command: postgres -c shared_buffers=256MB -c max_connections=200
```

**Nginx worker processes (nginx.conf):**

```nginx
events {
  worker_connections 2048;
}
```

### 10. Security Hardening

```bash
# Install fail2ban
sudo apt install -y fail2ban

# Configure SSH (only key-based auth)
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
sudo systemctl restart sshd

# Enable unattended security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## Scaling Considerations

### Horizontal Scaling (Multiple VPS)

1. **Database:** Move PostgreSQL to managed service (AWS RDS, DigitalOcean Managed DB)
2. **Load Balancer:** Use Nginx or Cloudflare load balancing
3. **Session Store:** Use Redis for distributed sessions
4. **File Storage:** Move logs to S3 or equivalent

### Vertical Scaling (Single VPS)

- **2GB RAM:** 10-20 concurrent tenants
- **4GB RAM:** 50-100 concurrent tenants
- **8GB RAM:** 200+ concurrent tenants

---

## Troubleshooting

**Service won't start:**

```bash
docker-compose logs api
docker-compose restart api
```

**Database connection issues:**

```bash
docker-compose exec postgres psql -U clickpawpay
\l   # List databases
\dt  # List tables
```

**SSL certificate errors:**

```bash
sudo certbot renew --dry-run
sudo certbot certificates
```

**Out of disk space:**

```bash
docker system prune -a
sudo apt autoremove
```

---

## Monitoring Tools (Optional)

**Install Portainer (Docker UI):**

```bash
docker volume create portainer_data
docker run -d -p 9000:9000 --name=portainer --restart=always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v portainer_data:/data \
  portainer/portainer-ce
```

Access: http://YOUR_VPS_IP:9000

---

## Production Checklist

- [ ] DNS configured with A records
- [ ] SSL certificates installed and auto-renewing
- [ ] Environment variables set (JWT_SECRET, ENCRYPTION_KEY, API keys)
- [ ] Database migrations applied
- [ ] Firewall configured (UFW)
- [ ] Daily database backups scheduled
- [ ] Application logs rotating
- [ ] Monitoring setup (optional: Portainer, Grafana)
- [ ] Email notifications configured
- [ ] Rate limiting enabled
- [ ] CORS origins restricted to your domain

---

**Your ClickPawPay instance is now live! 🚀**

Access: https://clickpawpay.com
