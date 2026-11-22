// Shared Web Crypto Auth Helper for Cloudflare Pages Functions & Node.js
// Uses native Web Crypto API (crypto.subtle) - 100% Edge & Browser compatible

export function getSessionSecret(env) {
  if (env && env.SESSION_SECRET && env.SESSION_SECRET.trim()) {
    return env.SESSION_SECRET.trim();
  }
  // Strong default fallback for local dev & production safety
  return 'ali-garments-production-session-secret-2026-v2-secure';
}

/**
 * Strict VPN & Proxy Detection
 * Cloudflare Edge passes security parameters in request.cf
 * Checks Tor exit nodes, threat scores, datacenter ASNs, and proxy headers
 */
export function isVpnOrProxy(request) {
  if (!request) return false;
  
  // 1. Check Cloudflare CF Object
  const cf = request.cf || {};

  // Tor network detection
  if (cf.isTor || cf.country === 'T1' || cf.country === 'A1') {
    return true;
  }

  // Threat score (> 40 indicates open proxy, Tor, or malicious bot network)
  // Dynamic residential Pakistani IPs commonly have threat scores up to 25; > 40 catches actual threats
  if (typeof cf.threatScore === 'number' && cf.threatScore > 40) {
    return true;
  }

  // Corporate Proxy detection
  if (cf.corporateProxy) {
    return true;
  }

  // Datacenter / Cloud Provider ASNs where commercial VPNs operate
  const org = ((cf.asOrganization || '') + ' ' + (cf.asn || '')).toLowerCase();
  const vpnDatacenterKeywords = [
    'digitalocean', 'linode', 'ovh', 'm247', 'hetzner', 'vultr', 'datacamp',
    'choopa', 'packet', 'leaseweb', 'nordvpn', 'expressvpn', 'surfshark',
    'cyberghost', 'private internet access', 'proton', 'ipvanish', 'wireguard',
    'hostinger', 'contabo', 'kamatera', 'scaleway', 'cogent', 'serverius',
    'purevpn', 'mullvad', 'windscribe', 'hidemyass', 'tunnelbear'
  ];

  if (vpnDatacenterKeywords.some(keyword => org.includes(keyword))) {
    return true;
  }

  // 2. Check Explicit Proxy Identifiers
  // Note: We do NOT check generic 'via' headers because standard Pakistani mobile ISPs (Jazz, Zong, PTCL)
  // route through legitimate transparent proxy caches that set 'Via: 1.1 ...' headers.
  const xProxyId = request.headers.get('x-proxy-id') || '';
  if (xProxyId) {
    return true;
  }

  return false;
}

export function getCorsHeaders(request) {
  const origin = request?.headers?.get('Origin') || '';
  const isAllowed = !origin ||
    origin.endsWith('.pages.dev') ||
    origin === 'https://ali-garments.pages.dev' ||
    origin === 'capacitor://localhost' ||
    origin === 'ionic://localhost' ||
    origin === 'https://localhost' ||
    origin.startsWith('https://localhost') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.startsWith('https://127.0.0.1') ||
    origin.startsWith('capacitor://') ||
    origin.startsWith('ionic://');

  const corsOrigin = isAllowed && origin ? origin : (origin || 'https://ali-garments.pages.dev');

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Requested-With, x-requested-with',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export function getSessionTokenFromRequest(request) {
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(/session=([^;]+)/);
  return match ? match[1] : null;
}

export async function hashPassword(password, existingSaltHex = null) {
  const enc = new TextEncoder();
  let salt;
  if (existingSaltHex) {
    salt = new Uint8Array(existingSaltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  } else {
    salt = crypto.getRandomValues(new Uint8Array(16));
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [saltHex, originalHashHex] = storedHash.split(':');
  const computed = await hashPassword(password, saltHex);
  const [, computedHashHex] = computed.split(':');
  return computedHashHex === originalHashHex;
}

function base64UrlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export async function signSessionToken(payload, secret) {
  const enc = new TextEncoder();
  const secretKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payloadStr = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(payloadStr);

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    secretKey,
    enc.encode(payloadB64)
  );

  const sigBytes = new Uint8Array(signatureBuffer);
  let sigBinary = '';
  for (let i = 0; i < sigBytes.byteLength; i++) {
    sigBinary += String.fromCharCode(sigBytes[i]);
  }
  const sigB64 = btoa(sigBinary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${payloadB64}.${sigB64}`;
}

export async function verifySessionToken(token, secret) {
  try {
    if (!token || !token.includes('.')) return null;
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return null;

    const enc = new TextEncoder();
    const secretKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    let base64 = sigB64.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const sigBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      sigBytes[i] = binary.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify(
      'HMAC',
      secretKey,
      sigBytes,
      enc.encode(payloadB64)
    );

    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadB64));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch (e) {
    return null;
  }
}

/**
 * AES-GCM 256-bit Authenticated Encryption for sensitive credentials
 * Stored as IV_HEX:CIPHERTEXT_HEX (Never cleartext)
 */
export async function encryptPassword(plainText, secret) {
  try {
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const keyBytes = await crypto.subtle.digest('SHA-256', enc.encode(secret));
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plainText));
    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    const cipherHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `${ivHex}:${cipherHex}`;
  } catch (e) {
    return null;
  }
}

export async function decryptPassword(encryptedPayload, secret) {
  try {
    if (!encryptedPayload || !encryptedPayload.includes(':')) return encryptedPayload;
    const [ivHex, cipherHex] = encryptedPayload.split(':');
    if (!ivHex || !cipherHex || ivHex.length !== 24) return encryptedPayload;
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const ciphertext = new Uint8Array(cipherHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const enc = new TextEncoder();
    const keyBytes = await crypto.subtle.digest('SHA-256', enc.encode(secret));
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    return encryptedPayload;
  }
}
