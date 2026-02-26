// Authentication middleware
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

// JWT_SECRET is guaranteed non-null by server.js startup guard.
const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token — explicit algorithms prevents alg:none / algorithm-confusion attacks
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

    // Attach user info to request
    req.user = {
      userId:   decoded.userId,
      tenantId: decoded.tenantId,
      role:     decoded.role
    };

    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    logger.error('Auth middleware error', { error: error.message });
    return res.status(401).json({ error: 'Invalid token' }); // return added to prevent double-response
  }
}

module.exports = authMiddleware;
