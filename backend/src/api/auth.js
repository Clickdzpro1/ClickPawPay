// Authentication API
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { encrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

/**
 * POST /api/auth/register - Register new tenant
 */
router.post('/register', async (req, res) => {
  try {
    const { subdomain, name, email, password, slickpayKey, plan = 'STARTER' } = req.body;

    // Validate required fields
    if (!subdomain || !name || !email || !password || !slickpayKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if subdomain already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain }
    });

    if (existingTenant) {
      return res.status(409).json({ error: 'Subdomain already taken' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Encrypt SlickPay key
    const slickpayKeyEnc = encrypt(slickpayKey);

    // Set request limit based on plan
    const requestLimits = {
      STARTER: 100,
      PRO: 1000,
      BUSINESS: 999999
    };

    // Create tenant and owner user
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
            lastName: name.split(' ').slice(1).join(' ')
          }
        }
      },
      include: {
        users: true
      }
    });

    const user = tenant.users[0];

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, tenantId: tenant.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logger.info('Tenant registered', { tenantId: tenant.id, subdomain });

    res.status(201).json({
      token,
      tenant: {
        id: tenant.id,
        subdomain: tenant.subdomain,
        name: tenant.name,
        plan: tenant.plan
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    logger.error('Registration error', { error: error.message });
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login - Login
 */
router.post('/login', async (req, res) => {
  try {
    const { subdomain, email, password } = req.body;

    if (!subdomain || !email || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain },
      include: {
        users: {
          where: { email, isActive: true }
        }
      }
    });

    if (!tenant || tenant.users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = tenant.users[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, tenantId: tenant.id, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logger.info('User logged in', { userId: user.id, tenantId: tenant.id });

    res.json({
      token,
      tenant: {
        id: tenant.id,
        subdomain: tenant.subdomain,
        name: tenant.name,
        plan: tenant.plan
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });

  } catch (error) {
    logger.error('Login error', { error: error.message });
    res.status(500).json({ error: 'Login failed' });
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

    const decoded = jwt.verify(token, JWT_SECRET);

    res.json({ valid: true, userId: decoded.userId, tenantId: decoded.tenantId });

  } catch (error) {
    res.status(401).json({ valid: false, error: 'Invalid token' });
  }
});

module.exports = router;
