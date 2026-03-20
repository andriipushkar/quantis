import { Request, Response, NextFunction } from 'express';

/**
 * List of field names that must never appear in API responses.
 * Matches exact names and patterns (fields ending in _secret, _key_enc, etc.).
 */
const SENSITIVE_EXACT_FIELDS = new Set([
  'password_hash',
  'totp_secret_enc',
  'api_key_encrypted',
  'api_secret_encrypted',
  'password',
  'secret',
  'refreshToken',
]);

const SENSITIVE_SUFFIXES = ['_secret', '_key_enc', '_secret_enc', '_encrypted'];

function isSensitiveField(key: string): boolean {
  if (SENSITIVE_EXACT_FIELDS.has(key)) return true;
  const lower = key.toLowerCase();
  return SENSITIVE_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

/**
 * Recursively strips sensitive fields from an object.
 * Returns a deep clone with all sensitive fields removed.
 */
function stripSensitiveFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => stripSensitiveFields(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveField(key)) continue;
    result[key] = typeof value === 'object' && value !== null
      ? stripSensitiveFields(value)
      : value;
  }
  return result;
}

/**
 * Middleware that overrides res.json to strip sensitive fields from ALL responses.
 * This ensures that password_hash, totp_secret_enc, API keys, and similar
 * fields are never leaked through any endpoint.
 */
export function sanitizeResponse(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  res.json = function (body?: unknown) {
    if (body && typeof body === 'object') {
      body = stripSensitiveFields(body);
    }
    return originalJson(body);
  } as typeof res.json;
  next();
}

/**
 * For POST, PUT, and PATCH requests, require Content-Type: application/json.
 * Rejects multipart, XML, form-urlencoded, and other content types that
 * could be used for injection or unexpected parsing.
 */
export function validateContentType(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentType = req.headers['content-type'];
    // Allow requests with no body (content-length 0) or correct content type
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > 0 && (!contentType || !contentType.includes('application/json'))) {
      res.status(415).json({
        success: false,
        error: 'Unsupported Media Type. Content-Type must be application/json.',
      });
      return;
    }
  }
  next();
}

/**
 * Prevents HTTP Parameter Pollution (HPP) attacks.
 * When a query parameter appears multiple times, only the last value is kept.
 * This prevents attackers from exploiting ambiguity in how duplicate parameters
 * are handled by different parts of the application.
 */
export function preventParamPollution(req: Request, res: Response, next: NextFunction): void {
  if (req.query && typeof req.query === 'object') {
    for (const [key, value] of Object.entries(req.query)) {
      if (Array.isArray(value)) {
        // Take only the last value
        (req.query as Record<string, unknown>)[key] = value[value.length - 1];
      }
    }
  }
  next();
}
