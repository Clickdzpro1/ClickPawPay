// Authentication API
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const Joi     = require('joi');
const prisma  = require('../utils/prisma');
const { encrypt } = require('../utils/encryption');
const logger  = require('../utils/logger');

// JWT_SECRET and JWT_EXPIRES_IN — guaranteed non-null by server.js startup guard.
const JWT_SECRET     = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

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
// Generated once: bcrypt.hashSync('__dummy__', 12)
const DUMMY_HASH = '$2a$12$WwAb7bGXe3GFqeEANHAHEeG9N9r3vqpmJ.oV6sQJlpANRPSmm3kKK';
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register - Register new tenant
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

    // Encrypt SlickPay key with AES-256-GCM
    const slickpayKeyEnc = encrypt(slickpayKey);

    // Set request limit based on plan
    const requestLimits = { STARTER: 100, PRO: 1000, BUSINESS: 999999 };

    // Create tenant and owner user in one atomic operation
    const tenant = await prisma.tenant.create({
      data: {
        subdomain,
        name,
        plan,
        slickpayKeyEnc,
        requestLimit: requestLimits[plan],
        users: {
          create: {
            email,
            passwordHash,
            role: 'OWNER',
            firstName: name.split(' ')[0],
            lastName:  name.split(' ').slice(1).join(' ') || ''
          }
        }
      },
      include: { users: true }
    });

    const user = tenant.users[0];

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, tenantId: tenant.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' }
    );

    logger.info('Tenant registered', { tenantId: tenant.id, subdomain });

    return res.status(201).json({
      token,
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
    logger.error('Registration error', { error: error.message });
    return res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login - Login
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

    // Always run bcrypt — prevents user-enumeration via response timing.
    // If user not found, compare against a dummy hash (takes same time).
    const hashToCompare = user ? user.passwordHash : DUMMY_HASH;
    const isValid = await bcrypt.compare(password, hashToCompare);

    if (!tenant || !user || !isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!tenant.isActive) {
      return res.status(403).json({ error: 'Account suspended' });
    }

    // Update last login (fire-and-forget, non-critical)
    prisma.user.update({
      where: { id: user.id },
      data:  { lastLogin: new Date() }
    }).catch(() => {});

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, tenantId: tenant.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' }
    );

    logger.info('User logged in', { userId: user.id, tenantId: tenant.id });

    return res.json({
      token,
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
 * POST /api/auth/verify - Verify JWT token
 */
router.post('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    return res.json({
      valid:    true,
      userId:   decoded.userId,
      tenantId: decoded.tenantId
    });
  } catch (error) {
    return res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

module.exports = router;
