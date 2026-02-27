// Authentication API - Simplified
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const Joi     = require('joi');
const prisma  = require('../utils/prisma');
const logger  = require('../utils/logger');

// Simple token generation (OpenClaw style)
function generateApiToken() {
  return 'cpay_' + crypto.randomBytes(32).toString('hex');
}

// ── Validation schemas (Joi) ──────────────────────────────────────────────────────
const registerSchema = Joi.object({
  subdomain:    Joi.string()
                  .pattern(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/)
                  .required()
                  .messages({ 'string.pattern.base': 'Subdomain must be 3-63 lowercase alphanumeric characters or hyphens' }),
  name:         Joi.string().min(2).max(100).required(),
  email:        Joi.string().email().required(),
  password:     Joi.string().min(8).max(128).required()
                  .messages({ 'string.min': 'Password must be at least 8 characters' }),
  slickpayKey:  Joi.string().min(10).required(),
  plan:         Joi.string().valid('STARTER', 'PRO', 'BUSINESS').default('STARTER')
});

const loginSchema = Joi.object({
  subdomain: Joi.string().required(),
  email:     Joi.string().email().required(),
  password:  Joi.string().required()
});

// ── Constant-time dummy hash (prevents user-enumeration via login timing) ─────
const DUMMY_HASH = '$2a$12$WwAb7bGXe3GFqeEANHAHEeG9N9r3vqpmJ.oV6sQJlpANRPSmm3kKK';

/**
 * POST /api/auth/register - Register new tenant
 * Returns a simple API token (cpay_xxxxx)
 */
router.post('/register', async (req, res) => {
  try {
    // Validate and sanitize input
    const { error: ve, value } = registerSchema.validate(req.body, { abortEarly: false });
    if (ve) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ve.details.map(d => d.message)
      });
    }

    const { subdomain, name, email, password, slickpayKey, plan } = value;

    // Check if subdomain already exists
    const existingTenant = await prisma.tenant.findUnique({ where: { subdomain } });
    if (existingTenant) {
      return res.status(409).json({ error: 'Subdomain already taken' });
    }

    // Hash password using bcrypt (cost factor 12)
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate simple API token
    const apiToken = generateApiToken();
    const tokenHash = await bcrypt.hash(apiToken, 10);

    // Set request limit based on plan
    const requestLimits = { STARTER: 100, PRO: 1000, BUSINESS: 999999 };

    // Store SlickPay key directly (no encryption needed for open-source/self-hosted)
    // For future SaaS version, we can add encryption later
    const tenant = await prisma.tenant.create({
      data: {
        subdomain,
        name,
        plan,
        slickpayKeyEnc: slickpayKey, // Store directly for now
        requestLimit: requestLimits[plan],
        users: {
          create: {
            email,
            passwordHash,
            role: 'OWNER',
            firstName: name.split(' ')[0],
            lastName:  name.split(' ').slice(1).join(' ') || '',
            apiToken: tokenHash // Store hashed token for validation
          }
        }
      },
      include: { users: true }
    });

    const user = tenant.users[0];

    logger.info('Tenant registered', { tenantId: tenant.id, subdomain });

    // Return the plain API token (user needs to save this)
    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Save your API token - it won\'t be shown again.',
      token: apiToken, // cpay_xxxxx format
      tenant: {
        id:        tenant.id,
        subdomain: tenant.subdomain,
        name:      tenant.name,
        plan:      tenant.plan
      },
      user: {
        id:    user.id,
        email: user.email,
        role:  user.role
      }
    });

  } catch (error) {
    logger.error('Registration error', { error: error.message, stack: error.stack });
    return res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

/**
 * POST /api/auth/login - Login
 * Returns a simple API token
 */
router.post('/login', async (req, res) => {
  try {
    // Validate input
    const { error: ve, value } = loginSchema.validate(req.body, { abortEarly: false });
    if (ve) {
      return res.status(400).json({
        error: 'Validation failed',
        details: ve.details.map(d => d.message)
      });
    }

    const { subdomain, email, password } = value;

    // Find tenant + user in one query
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain },
      include: {
        users: { where: { email, isActive: true } }
      }
    });

    const user = tenant?.users?.[0] ?? null;

    // Always run bcrypt — prevents user-enumeration via response timing
    const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
    const isValid = await bcrypt.compare(password, hashToCompare);

    if (!tenant || !user || !isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!tenant.isActive) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Generate new API token on each login
    const apiToken = generateApiToken();
    const tokenHash = await bcrypt.hash(apiToken, 10);

    // Update user with new token and last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        apiToken: tokenHash,
        lastLogin: new Date()
      }
    });

    logger.info('User logged in', { userId: user.id, tenantId: tenant.id });

    return res.json({
      success: true,
      token: apiToken, // Return plain token
      tenant: {
        id:        tenant.id,
        subdomain: tenant.subdomain,
        name:      tenant.name,
        plan:      tenant.plan
      },
      user: {
        id:        user.id,
        email:     user.email,
        role:      user.role,
        firstName: user.firstName,
        lastName:  user.lastName
      }
    });

  } catch (error) {
    logger.error('Login error', { error: error.message });
    return res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/verify - Verify API token
 */
router.post('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token || !token.startsWith('cpay_')) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Find user with matching token hash
    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: { tenant: true }
    });

    for (const user of users) {
      if (user.apiToken && await bcrypt.compare(token, user.apiToken)) {
        return res.json({
          valid: true,
          userId: user.id,
          tenantId: user.tenant.id,
          subdomain: user.tenant.subdomain
        });
      }
    }

    return res.status(401).json({ valid: false, error: 'Invalid token' });

  } catch (error) {
    return res.status(401).json({ valid: false, error: 'Token verification failed' });
  }
});

module.exports = router;
