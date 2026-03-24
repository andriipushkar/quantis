/**
 * Security middleware — unit tests
 *
 * Tests sanitizeResponse, validateContentType, preventParamPollution.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Request, Response, NextFunction } from 'express';
import { sanitizeResponse, validateContentType, preventParamPollution } from '../middleware/security.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'GET',
    headers: {},
    query: {},
    ...overrides,
  } as Request;
}

function mockRes(): { res: Response; statusCode: number; body: any; jsonCalled: boolean } {
  const state = { statusCode: 200, body: null as any, jsonCalled: false };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(data: any) {
      state.body = data;
      state.jsonCalled = true;
      return res;
    },
  } as unknown as Response;
  return { res, get statusCode() { return state.statusCode; }, get body() { return state.body; }, get jsonCalled() { return state.jsonCalled; } };
}

const next: NextFunction = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// sanitizeResponse
// ---------------------------------------------------------------------------

describe('sanitizeResponse', () => {
  test('strips password_hash from response body', () => {
    const req = mockReq();
    const r = mockRes();
    // Apply middleware — it wraps res.json
    sanitizeResponse(req, r.res, next);
    expect(next).toHaveBeenCalled();

    // Now call the wrapped json
    r.res.json({ name: 'Alice', password_hash: 'hashed123' });
    expect(r.body).toEqual({ name: 'Alice' });
  });

  test('strips totp_secret_enc', () => {
    const req = mockReq();
    const r = mockRes();
    sanitizeResponse(req, r.res, next);
    r.res.json({ id: 1, totp_secret_enc: 'secret' });
    expect(r.body).toEqual({ id: 1 });
  });

  test('strips api_key_encrypted and api_secret_encrypted', () => {
    const req = mockReq();
    const r = mockRes();
    sanitizeResponse(req, r.res, next);
    r.res.json({ id: 1, api_key_encrypted: 'k', api_secret_encrypted: 's', name: 'test' });
    expect(r.body).toEqual({ id: 1, name: 'test' });
  });

  test('strips fields ending in _secret suffix', () => {
    const req = mockReq();
    const r = mockRes();
    sanitizeResponse(req, r.res, next);
    r.res.json({ my_custom_secret: 'hidden', visible: true });
    expect(r.body).toEqual({ visible: true });
  });

  test('strips fields ending in _encrypted suffix', () => {
    const req = mockReq();
    const r = mockRes();
    sanitizeResponse(req, r.res, next);
    r.res.json({ wallet_encrypted: 'enc', public_key: '0x123' });
    expect(r.body).toEqual({ public_key: '0x123' });
  });

  test('recursively strips from nested objects', () => {
    const req = mockReq();
    const r = mockRes();
    sanitizeResponse(req, r.res, next);
    r.res.json({
      user: { name: 'Alice', password_hash: 'x' },
      settings: { theme: 'dark', secret: 'y' },
    });
    expect(r.body).toEqual({
      user: { name: 'Alice' },
      settings: { theme: 'dark' },
    });
  });

  test('strips from arrays of objects', () => {
    const req = mockReq();
    const r = mockRes();
    sanitizeResponse(req, r.res, next);
    r.res.json([
      { id: 1, password_hash: 'a' },
      { id: 2, password_hash: 'b' },
    ]);
    expect(r.body).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test('null body → passes through', () => {
    const req = mockReq();
    const r = mockRes();
    sanitizeResponse(req, r.res, next);
    r.res.json(null);
    expect(r.body).toBeNull();
  });

  test('primitive body → passes through', () => {
    const req = mockReq();
    const r = mockRes();
    sanitizeResponse(req, r.res, next);
    r.res.json('hello' as any);
    expect(r.body).toBe('hello');
  });

  test('empty object → passes through', () => {
    const req = mockReq();
    const r = mockRes();
    sanitizeResponse(req, r.res, next);
    r.res.json({});
    expect(r.body).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// validateContentType
// ---------------------------------------------------------------------------

describe('validateContentType', () => {
  test('GET request → passes regardless of content-type', () => {
    const req = mockReq({ method: 'GET' });
    const r = mockRes();
    validateContentType(req, r.res, next);
    expect(next).toHaveBeenCalled();
  });

  test('POST with application/json → passes', () => {
    const req = mockReq({
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': '42' } as any,
    });
    const r = mockRes();
    validateContentType(req, r.res, next);
    expect(next).toHaveBeenCalled();
  });

  test('POST with content-length 0 (no body) → passes', () => {
    const req = mockReq({
      method: 'POST',
      headers: { 'content-length': '0' } as any,
    });
    const r = mockRes();
    validateContentType(req, r.res, next);
    expect(next).toHaveBeenCalled();
  });

  test('POST with text/xml and body → 415', () => {
    const req = mockReq({
      method: 'POST',
      headers: { 'content-type': 'text/xml', 'content-length': '100' } as any,
    });
    const r = mockRes();
    validateContentType(req, r.res, next);
    expect(r.statusCode).toBe(415);
    expect(r.body.error).toContain('Unsupported Media Type');
  });

  test('PUT with multipart/form-data and body → 415', () => {
    const req = mockReq({
      method: 'PUT',
      headers: { 'content-type': 'multipart/form-data', 'content-length': '500' } as any,
    });
    const r = mockRes();
    validateContentType(req, r.res, next);
    expect(r.statusCode).toBe(415);
  });

  test('PATCH with no content-type but has body → 415', () => {
    const req = mockReq({
      method: 'PATCH',
      headers: { 'content-length': '50' } as any,
    });
    const r = mockRes();
    validateContentType(req, r.res, next);
    expect(r.statusCode).toBe(415);
  });

  test('DELETE request → passes (not checked)', () => {
    const req = mockReq({ method: 'DELETE' });
    const r = mockRes();
    validateContentType(req, r.res, next);
    expect(next).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// preventParamPollution
// ---------------------------------------------------------------------------

describe('preventParamPollution', () => {
  test('single-value params → unchanged', () => {
    const req = mockReq({ query: { page: '1', limit: '10' } as any });
    const r = mockRes();
    preventParamPollution(req, r.res, next);
    expect(req.query.page).toBe('1');
    expect(req.query.limit).toBe('10');
    expect(next).toHaveBeenCalled();
  });

  test('duplicate param → keeps last value', () => {
    const req = mockReq({ query: { sort: ['asc', 'desc'] } as any });
    const r = mockRes();
    preventParamPollution(req, r.res, next);
    expect(req.query.sort).toBe('desc');
  });

  test('mixed single and array params → only arrays flattened', () => {
    const req = mockReq({ query: { page: '1', filter: ['a', 'b', 'c'] } as any });
    const r = mockRes();
    preventParamPollution(req, r.res, next);
    expect(req.query.page).toBe('1');
    expect(req.query.filter).toBe('c');
  });

  test('empty query → passes', () => {
    const req = mockReq({ query: {} });
    const r = mockRes();
    preventParamPollution(req, r.res, next);
    expect(next).toHaveBeenCalled();
  });
});
