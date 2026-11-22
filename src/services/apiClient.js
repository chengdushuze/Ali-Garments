/**
 * API Client for ALI Garments
 * Automatically handles routing between Cloudflare Pages (Web) and Capacitor (Android APK)
 * 
 * Security Hardening:
 * 1. Web Browsers: Uses HttpOnly Secure SameSite=Strict cookies. Avoids storing raw tokens in plain localStorage.
 * 2. Capacitor APK: Securely holds runtime token in-memory with obfuscated native storage for cross-origin Bearer headers.
 * 3. Global Interceptor: Reacts instantly to suspension, deletion, session invalidation, VPN blocks, and geo blocks.
 */

export function getApiBaseUrl() {
  if (typeof window === 'undefined') return 'https://ali-garments.pages.dev';
  const host = window.location.hostname || '';
  // Only when running on Cloudflare Pages web production do we use relative URLs
  if (host === 'ali-garments.pages.dev' || host.endsWith('.pages.dev')) {
    return '';
  }
  // Android APK (Capacitor, localhost, 127.0.0.1, file:) MUST connect to live Cloudflare backend
  return 'https://ali-garments.pages.dev';
}

export const IS_NATIVE_OR_LOCALHOST = typeof window !== 'undefined' && (
  window.location.hostname !== 'ali-garments.pages.dev' &&
  !window.location.hostname.endsWith('.pages.dev')
);

export const API_BASE_URL = getApiBaseUrl();

// In-memory token cache (Zero plain text in web localStorage)
let inMemoryToken = '';

// Obfuscation helper for native app persistence
const STORAGE_PREFIX = '_ag_sec_t_';
function obfuscate(str) {
  try {
    return btoa(encodeURIComponent(str).split('').map((c, i) => 
      String.fromCharCode(c.charCodeAt(0) ^ ((i % 5) + 3))
    ).join(''));
  } catch (e) {
    return str;
  }
}

function deobfuscate(str) {
  try {
    const raw = atob(str);
    return decodeURIComponent(raw.split('').map((c, i) => 
      String.fromCharCode(c.charCodeAt(0) ^ ((i % 5) + 3))
    ).join(''));
  } catch (e) {
    return str;
  }
}

export function getStoredToken() {
  if (inMemoryToken) return inMemoryToken;
  
  // Web mode uses HttpOnly cookies; native APK checks obfuscated storage
  if (IS_NATIVE_OR_LOCALHOST && typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(STORAGE_PREFIX) || localStorage.getItem(STORAGE_PREFIX);
      if (stored) {
        inMemoryToken = deobfuscate(stored);
        return inMemoryToken;
      }
    } catch (e) {}
  }
  return '';
}

export function setStoredToken(token) {
  inMemoryToken = token || '';
  if (typeof window === 'undefined') return;

  try {
    // Clean up any legacy plain localStorage key
    localStorage.removeItem('khata_session_token');

    if (token && IS_NATIVE_OR_LOCALHOST) {
      const encoded = obfuscate(token);
      sessionStorage.setItem(STORAGE_PREFIX, encoded);
      localStorage.setItem(STORAGE_PREFIX, encoded);
    } else {
      sessionStorage.removeItem(STORAGE_PREFIX);
      localStorage.removeItem(STORAGE_PREFIX);
    }
  } catch (e) {}
}

export function clearStoredToken() {
  inMemoryToken = '';
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('khata_session_token');
      sessionStorage.removeItem(STORAGE_PREFIX);
      localStorage.removeItem(STORAGE_PREFIX);
    } catch (e) {}
  }
}

export async function apiFetch(endpoint, options = {}) {
  const base = getApiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
  const headers = { ...(options.headers || {}) };

  const token = getStoredToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  // Global Interceptor for Account Status Changes (Suspension, Deletion, Revocation, VPN Block, Geo Block)
  if (res.status === 401 || res.status === 403) {
    try {
      const cloned = res.clone();
      cloned.json().then(data => {
        if (data && (data.isSuspended || data.isDeleted || data.isLoggedOut || data.isVpnBlocked || data.isGeoBlocked || data.code === 'GEO_BLOCKED')) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ag_account_revocation', {
              detail: {
                status: res.status,
                ...data,
                endpoint,
              }
            }));
          }
        }
      }).catch(() => {});
    } catch (e) {}
  }

  return res;
}
