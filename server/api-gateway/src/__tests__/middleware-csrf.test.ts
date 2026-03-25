/**
 * CSRF middleware — unit tests
 *
 * Tests csrfProtection: safe methods pass, JSON content-type passes,
 * empty body with auth header passes, missing headers → 403.
 */

 

import { Request, Response, NextFunction } from 'express';
import { csrfProtection } from '../middleware/csrf.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    headers: {},
    ...overrides,
  } as Request;
}

function mockRes(): { res: Response; statusCode: number; body: any } {
  const state = { statusCode: 200, body: null as any };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(data: any) {
      state.body = data;
      return res;
    },
  } as unknown as Response;
  return { res, get statusCode() { return state.statusCode; }, get body() { return state.body; } };
}

const next: NextFunction = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('csrfProtection', () => {
  describe('safe methods bypass', () => {
    test.each(['GET', 'HEAD', 'OPTIONS'])('%s request → passes', (method) => {
      const req = mockReq({ method });
      const r = mockRes();
      csrfProtection(req, r.res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('state-changing methods with JSON content-type', () => {
    test.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
      '%s with application/json → passes',
      (method) => {
        const req = mockReq({
          method,
          headers: { 'content-type': 'application/json' } as any,
        });
        const r = mockRes();
        csrfProtection(req, r.res, next);
        expect(next).toHaveBeenCalledTimes(1);
      },
    );

    test('POST with application/json; charset=utf-8 → passes', () => {
      const req = mockReq({
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' } as any,
      });
      const r = mockRes();
      csrfProtection(req, r.res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('empty body with Authorization header', () => {
    test('POST with content-length=0 and Authorization → passes', () => {
      const req = mockReq({
        method: 'POST',
        headers: { 'content-length': '0', authorization: 'Bearer token123' } as any,
      });
      const r = mockRes();
      csrfProtection(req, r.res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test('POST with content-length=0 and X-Requested-With → passes', () => {
      const req = mockReq({
        method: 'POST',
        headers: { 'content-length': '0', 'x-requested-with': 'XMLHttpRequest' } as any,
      });
      const r = mockRes();
      csrfProtection(req, r.res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('blocked requests → 403', () => {
    test('POST without content-type or auth headers → 403', () => {
      const req = mockReq({ method: 'POST' });
      const r = mockRes();
      csrfProtection(req, r.res, next);
      expect(r.statusCode).toBe(403);
      expect(r.body.error).toContain('CSRF validation failed');
      expect(next).not.toHaveBeenCalled();
    });

    test('DELETE without content-type or auth headers → 403', () => {
      const req = mockReq({ method: 'DELETE' });
      const r = mockRes();
      csrfProtection(req, r.res, next);
      expect(r.statusCode).toBe(403);
    });

    test('POST with form-urlencoded content-type and body → 403', () => {
      const req = mockReq({
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': '50' } as any,
      });
      const r = mockRes();
      csrfProtection(req, r.res, next);
      expect(r.statusCode).toBe(403);
    });

    test('POST with content-length > 0 but no content-type and no auth → 403', () => {
      const req = mockReq({
        method: 'POST',
        headers: { 'content-length': '100' } as any,
      });
      const r = mockRes();
      csrfProtection(req, r.res, next);
      expect(r.statusCode).toBe(403);
    });
  });
});
