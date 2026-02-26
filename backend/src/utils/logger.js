// Logger utility using Winston
const winston = require('winston');
const path    = require('path');

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '../../logs');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'clickclawpay' },
  transports: [
    // File transports — always active in all environments
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize:  5242880, // 5 MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level:    'error',
      maxsize:  5242880,
      maxFiles: 5
    })
  ]
});

// Console transport in non-production only (added once — no duplicate)
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;
