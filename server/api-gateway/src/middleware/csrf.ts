import { Request, Response, NextFunction } from 'express';

/**
 * CSRF protection middleware.
 *
 * Since this is a JSON API with CORS configured, the browser's same-origin
 * policy already blocks most CSRF vectors. This middleware adds an additional
 * layer by verifying that state-changing requests include a custom header
 * that browsers won't send cross-origin without a CORS preflight.
 *
 * Combined with SameSite=Strict cookies and CORS origin whitelist,
 * this provides strong CSRF protection without tokens.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Only check state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  // Verify Content-Type is application/json (browsers won't send this cross-origin
  // without a CORS preflight, which our CORS config will block)
  const contentType = req.headers['content-type'];
  if (contentType && contentType.includes('application/json')) {
    next();
    return;
  }

  // For empty-body requests (e.g., POST /logout), require either
  // Authorization header (Bearer token) or X-Requested-With header.
  // Both are custom headers that trigger a CORS preflight, preventing
  // cross-origin form submissions from succeeding.
  const hasAuthHeader = !!req.headers['authorization'];
  const hasXRequestedWith = !!req.headers['x-requested-with'];
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);

  if (contentLength === 0 && (hasAuthHeader || hasXRequestedWith)) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    error: 'CSRF validation failed: state-changing requests require Content-Type: application/json or Authorization header',
  });
}
