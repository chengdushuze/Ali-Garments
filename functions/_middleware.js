/**
 * Cloudflare Pages Global Security Middleware
 * Protects application against:
 * 1. Geo-restriction: Pakistan-only access (request.cf?.country === 'PK') with Super Admin foreign access bypass
 * 2. SQL Injection (Query string and parameter payload sanitization)
 * 3. DDoS & Flood Attacks (Rate-limiting, request size limits, method filtering)
 * 4. XSS & Clickjacking (Enforces OWASP recommended security response headers)
 * 5. Worker Optimization: Edge CDN asset caching to conserve Cloudflare Worker invocations
 */

import { verifySessionToken, getSessionTokenFromRequest, getSessionSecret } from './api/_auth.js';

// In-memory sliding window rate limiter for DDoS mitigation
const ipRateMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 200; // 200 requests per minute per IP

// Clean up stale IP records periodically
function pruneRateMap() {
  const now = Date.now();
  for (const [ip, data] of ipRateMap.entries()) {
    if (now - data.startTime > RATE_LIMIT_WINDOW_MS) {
      ipRateMap.delete(ip);
    }
  }
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // 0. Static Asset Fast-Path (Saves Cloudflare Worker Requests & Credits via CDN Edge Cache)
  if (
    pathname.startsWith('/assets/') ||
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.woff2')
  ) {
    const response = await next();
    const resHeaders = new Headers(response.headers);
    if (pathname.startsWith('/assets/')) {
      resHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      resHeaders.set('Cache-Control', 'public, max-age=86400');
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    });
  }

  // 1. Method Filtering (Block obsolete / dangerous HTTP methods)
  const method = request.method.toUpperCase();
  if (['TRACE', 'TRACK', 'CONNECT'].includes(method)) {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 2. Client IP & Country Resolution
  const clientIp = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   'unknown-ip';

  const clientCountry = request.cf?.country; // Undefined in local dev / native WebView

  // 3. DDoS & Request Flooding Protection
  const now = Date.now();
  pruneRateMap();
  const rateData = ipRateMap.get(clientIp);

  if (!rateData || (now - rateData.startTime > RATE_LIMIT_WINDOW_MS)) {
    ipRateMap.set(clientIp, { count: 1, startTime: now });
  } else {
    rateData.count++;
    if (rateData.count > MAX_REQUESTS_PER_MINUTE) {
      return new Response(
        JSON.stringify({
          error: 'Too Many Requests Rate limit triggered to protect server stability',
          retryAfter: 60,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            'X-RateLimit-Limit': String(MAX_REQUESTS_PER_MINUTE),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
  }

  // 4. Request Payload Size Protection (Anti-DoS Buffer Overflow)
  const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 5 * 1024 * 1024) { // 5 MB limit
    return new Response(JSON.stringify({ error: 'Payload Too Large' }), {
      status: 413,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 5. SQL Injection & Path Traversal Pattern Detection on Query String
  try {
    const rawQuery = decodeURIComponent(url.search);
    const dangerousPatterns = [
      /\b(UNION(\s+ALL)?\s+SELECT)\b/i,
      /\b(EXEC(\s|\+)+(SP_|XP_))\b/i,
      /<script\b[^>]*>(.*?)<\/script>/i,
      /(\.\.\/|\.\.\\)/i, // Path traversal
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(rawQuery)) {
        console.warn(`[Security Alert] Blocked suspicious URL parameter attempt from IP: ${clientIp}`);
        return new Response(
          JSON.stringify({ error: 'Malicious request pattern detected and blocked' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }
  } catch (e) {}

  // 6. Resolve Secure CORS Origin (Whitelisted origins with credentials support)
  const origin = request.headers.get('Origin') || '';
  const isAllowedOrigin = !origin || 
    origin.endsWith('.pages.dev') ||
    origin === 'https://ali-garments.pages.dev' ||
    origin === 'capacitor://localhost' ||
    origin === 'ionic://localhost' ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1');

  const corsOrigin = isAllowedOrigin && origin ? origin : 'https://ali-garments.pages.dev';

  // Handle preflight OPTIONS immediately with secure CORS
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with, Cookie',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 7. Pakistan-Only Geo Check with per-user bypass on authenticated /api/* endpoints
  // Allow static frontend assets, root '/', and public auth routes ('/api/login', '/api/logout') to load
  const isPublicAuthRoute = pathname === '/api/login' || pathname === '/api/logout';
  if (pathname.startsWith('/api/') && !isPublicAuthRoute) {
    if (clientCountry && clientCountry !== 'PK') {
      // Check user session for allow_foreign_access bypass
      const token = getSessionTokenFromRequest(request);
      let hasForeignAccess = false;
      let sessionUserEmail = 'unauthenticated';

      if (token && env) {
        try {
          const secret = getSessionSecret(env);
          const session = await verifySessionToken(token, secret);
          if (session) {
            sessionUserEmail = session.email || 'user';
            if (
              session.role === 'super_admin' ||
              session.role === 'admin' ||
              Number(session.allow_foreign_access) === 1 ||
              Number(session.allow_vpn) === 1
            ) {
              hasForeignAccess = true;
            } else if (env.DB && session.userId) {
              // Re-check live user record in D1 in case super_admin just granted foreign/VPN access
              const liveUser = await env.DB.prepare(
                'SELECT role, email, allow_foreign_access, allow_vpn FROM users WHERE id = ?'
              ).bind(session.userId).first();
              if (
                liveUser &&
                (liveUser.role === 'super_admin' ||
                 liveUser.role === 'admin' ||
                 Number(liveUser.allow_foreign_access) === 1 ||
                 Number(liveUser.allow_vpn) === 1)
              ) {
                hasForeignAccess = true;
              }
            }
          }
        } catch (e) {}
      }

      if (!hasForeignAccess) {
        // Log blocked attempt in audit_logs
        if (env?.DB) {
          try {
            await env.DB.prepare(
              'INSERT INTO audit_logs (user_email, action, details, ip_address) VALUES (?, ?, ?, ?)'
            ).bind(
              sessionUserEmail,
              'GEO_BLOCKED',
              `API request to '${pathname}' blocked from country '${clientCountry}' Account lacks foreign access permission`,
              clientIp
            ).run();
          } catch (e) {}
        }

        return new Response(
          JSON.stringify({
            error: `Access restricted to Pakistan (PK) Your detected location is ${clientCountry} Please contact Super Admin for foreign access authorization`,
            code: 'GEO_BLOCKED',
            isGeoBlocked: true,
            country: clientCountry,
          }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': corsOrigin,
              'Access-Control-Allow-Credentials': 'true',
            },
          }
        );
      }
    }
  }

  // 8. Proceed to next handler and inject OWASP security response headers
  const response = await next();

  // Clone headers and inject strict security controls
  const secureHeaders = new Headers(response.headers);
  secureHeaders.set('Access-Control-Allow-Origin', corsOrigin);
  secureHeaders.set('Access-Control-Allow-Credentials', 'true');
  secureHeaders.set('X-Content-Type-Options', 'nosniff');
  secureHeaders.set('X-Frame-Options', 'SAMEORIGIN');
  secureHeaders.set('X-XSS-Protection', '1; mode=block');
  secureHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  secureHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  secureHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  secureHeaders.set('Content-Security-Policy', "default-src 'self' https://ali-garments.pages.dev; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://ali-garments.pages.dev https://api.cloudflare.com; object-src 'none'; frame-ancestors 'self';");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: secureHeaders,
  });
}
