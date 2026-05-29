const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const ORIGINAL_SECRET = process.env.JWT_SECRET;

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('auth middleware', () => {
  before(() => {
    process.env.JWT_SECRET = 'test-secret-for-unit-tests';
    delete require.cache[require.resolve('../middleware/auth')];
  });

  after(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = ORIGINAL_SECRET;
    delete require.cache[require.resolve('../middleware/auth')];
  });

  it('signToken produces verifiable JWT', () => {
    const { signToken, JWT_SECRET } = require('../middleware/auth');
    const token = signToken({ id: 1, role: 'athlete', email: 'a@test.com' });
    const decoded = jwt.verify(token, JWT_SECRET);
    assert.equal(decoded.id, 1);
    assert.equal(decoded.role, 'athlete');
  });

  it('authenticate rejects missing Authorization header', () => {
    const { authenticate } = require('../middleware/auth');
    const req = { headers: {} };
    const res = mockRes();
    let nextCalled = false;
    authenticate(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /Authentication required/i);
  });

  it('authenticate rejects malformed Bearer token', () => {
    const { authenticate } = require('../middleware/auth');
    const req = { headers: { authorization: 'Bearer not-a-valid-jwt' } };
    const res = mockRes();
    authenticate(req, res, () => {});
    assert.equal(res.statusCode, 401);
    assert.match(res.body.error, /Invalid or expired/i);
  });

  it('authenticate attaches user and calls next for valid token', () => {
    const { signToken, authenticate } = require('../middleware/auth');
    const payload = { id: 42, role: 'coach', email: 'c@test.com' };
    const req = { headers: { authorization: `Bearer ${signToken(payload)}` } };
    const res = mockRes();
    let nextCalled = false;
    authenticate(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(req.user.id, 42);
    assert.equal(req.user.role, 'coach');
  });

  it('requireRole allows matching role', () => {
    const { requireRole } = require('../middleware/auth');
    const middleware = requireRole('coach', 'admin');
    const req = { user: { role: 'coach' } };
    const res = mockRes();
    let nextCalled = false;
    middleware(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  it('requireRole returns 403 for wrong role', () => {
    const { requireRole } = require('../middleware/auth');
    const middleware = requireRole('admin');
    const req = { user: { role: 'athlete' } };
    const res = mockRes();
    middleware(req, res, () => {});
    assert.equal(res.statusCode, 403);
    assert.match(res.body.error, /Insufficient permissions/i);
  });

  it('requireRole returns 401 without user', () => {
    const { requireRole } = require('../middleware/auth');
    const middleware = requireRole('coach');
    const req = {};
    const res = mockRes();
    middleware(req, res, () => {});
    assert.equal(res.statusCode, 401);
  });
});
