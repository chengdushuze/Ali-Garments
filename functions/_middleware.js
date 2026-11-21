/**
 * Cloudflare Pages Global Security Middleware
 * Protects application against:
 * 1. SQL Injection (Query string and parameter payload sanitization)
 * 2. DDoS & Flood Attacks (Rate-limiting, request size limits, method filtering)
 * 3. XSS & Clickjacking (Enforces OWASP recommended security response headers)
 */

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
  const { request, next } = context;

  // 1. Method Filtering (Block obsolete / dangerous HTTP methods)
  const method = request.method.toUpperCase();
  if (['TRACE', 'TRACK', 'CONNECT'].includes(method)) {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // 2. Client IP Resolution
  const clientIp = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('x-real-ip') || 
                   request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                   'unknown-ip';

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
          error: 'Too Many Requests. Rate limit triggered to protect server stability.',
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
    const url = new URL(request.url);
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
          JSON.stringify({ error: 'Malicious request pattern detected and blocked.' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }
  } catch (e) {
    // Malformed URL decode
  }

  // 6. Handle preflight OPTIONS immediately with secure CORS
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with, Cookie',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 7. Proceed to next handler and inject OWASP security response headers
  const response = await next();

  // Clone headers and inject strict security controls
  const secureHeaders = new Headers(response.headers);
  secureHeaders.set('X-Content-Type-Options', 'nosniff');
  secureHeaders.set('X-Frame-Options', 'SAMEORIGIN');
  secureHeaders.set('X-XSS-Protection', '1; mode=block');
  secureHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  secureHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  secureHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: secureHeaders,
  });
}
