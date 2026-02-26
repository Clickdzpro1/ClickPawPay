const request = require('supertest');

// Minimal smoke test — verifies the Express app boots and the
// health endpoint responds without needing a real database.

// Stub environment variables so server.js doesn't crash on boot
process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-for-testing';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
process.env.NODE_ENV = 'test';

// Mock Prisma before requiring the app
jest.mock('../src/utils/prisma', () => ({
  $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  $disconnect: jest.fn(),
}));

const app = require('../server');

describe('GET /health', () => {
  it('should return 200 with healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('service', 'ClickPawPay API');
  });
});

describe('GET /unknown-route', () => {
  it('should return 404', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.statusCode).toBe(404);
    expect(res.body).toHaveProperty('error', 'Route not found');
  });
});
