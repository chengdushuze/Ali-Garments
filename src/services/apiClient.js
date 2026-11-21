/**
 * API Client for ALI Garments
 * Automatically handles routing between Cloudflare Pages (Web) and Capacitor (Android APK)
 * Manages Bearer tokens for seamless cross-origin mobile WebView authentication
 */

export const IS_NATIVE_OR_LOCALHOST = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.protocol === 'capacitor:' ||
  window.location.protocol === 'file:' ||
  Boolean(window.Capacitor?.isNativePlatform?.())
);

export const API_BASE_URL = IS_NATIVE_OR_LOCALHOST ? 'https://ali-garments.pages.dev' : '';

const TOKEN_KEY = 'khata_session_token';

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch (e) {
    return '';
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {}
}

export function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {}
}

export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers = { ...(options.headers || {}) };

  const token = getStoredToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });
}
