// Database seed — creates a demo tenant and owner user for development
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');

const prisma = new PrismaClient();

// Simple AES-256-GCM encrypt (matches src/utils/encryption.js)
function encryptDemo(text) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

async function main() {
  console.log('🌱 Seeding database...');

  const subdomain = 'demo';
  const existing  = await prisma.tenant.findUnique({ where: { subdomain } });

  if (existing) {
    console.log('✅ Demo tenant already exists — skipping');
    return;
  }

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      subdomain,
      name:          'Demo Company',
      plan:          'PRO',
      slickpayKeyEnc: encryptDemo('sk_demo_placeholder_key_12345'),
      requestLimit:  1000,
      resetDate:     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // +30 days
    }
  });

  // Create owner user
  const passwordHash = await bcrypt.hash('Demo@1234', 12);
  const user = await prisma.user.create({
    data: {
      tenantId:     tenant.id,
      email:        'demo@demo.com',
      passwordHash,
      role:         'OWNER',
      firstName:    'Demo',
      lastName:     'User'
    }
  });

  console.log('✅ Created demo tenant:', tenant.subdomain);
  console.log('✅ Created demo user:  ', user.email);
  console.log('');
  console.log('  Subdomain: demo');
  console.log('  Email:     demo@demo.com');
  console.log('  Password:  Demo@1234');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
