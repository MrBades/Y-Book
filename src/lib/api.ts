/**
 * Unified API Client Configuration
 * Allows developers to update base URLs in one place.
 */

export const SYSTEM_API_BASE_URL = '';

export const API_ENDPOINTS = {
    TOKEN: `${SYSTEM_API_BASE_URL}/api/token/`,
    AUTH_PIN_LOGIN: `${SYSTEM_API_BASE_URL}/api/auth/pin-login`,
    AUTH_REGISTER: `${SYSTEM_API_BASE_URL}/api/auth/register-onboarding`,
};

/**
 * Normalizes and resolves paths for System REST API Server
 */
export function getSystemApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = SYSTEM_API_BASE_URL.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  
  if (base) {
    return `${base}/${cleanPath}`;
  }
  
  // Reconstruct the real base URL even if window.location.origin is "null" (sandbox iframe)
  let origin = '';
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.origin && window.location.origin !== 'null') {
      origin = window.location.origin;
    } else if (window.location.href && window.location.href.startsWith('http')) {
      try {
        const urlObj = new URL(window.location.href);
        origin = urlObj.protocol + '//' + urlObj.host;
      } catch (e) {
        // Fallback
      }
    }
  }
  
  return origin ? `${origin}/${cleanPath}` : `/${cleanPath}`;
}

/**
 * Unified fetch wrapper that prepends the System API URL to requests.
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getSystemApiUrl(path);
  try {
    const res = await fetch(url, options);
    // Ignore 401 triggers on logins, backups, or verification status checks to prevent infinite reloads
    const isAuthPath = path.includes('/pin-login') || path.includes('/probe') || path.includes('/check-verification-status');
    const isBackupPath = path.includes('/backup') || path.includes('/api/backup');
    if (res.status === 401 && !isAuthPath && !isBackupPath) {
      console.warn("Unauthorized API call, clearing session and reloading:", path);
      localStorage.removeItem('session_id');
      localStorage.removeItem('active_screen');
      window.location.reload();
      return res;
    }
    return res;
  } catch (err) {
    if (url !== path && SYSTEM_API_BASE_URL) {
      console.warn("API fetch failed. Retrying with same-origin Local Express/Node server:", path, err);
      return fetch(path, options);
    }
    throw err;
  }
}

/**
 * Fetch wrapper for Node server endpoints.
 */
export async function nodeFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getSystemApiUrl(path);
  try {
    const res = await fetch(url, options);
    const isAuthPath = path.includes('/pin-login') || path.includes('/probe') || path.includes('/check-verification-status');
    const isBackupPath = path.includes('/backup') || path.includes('/api/backup');
    if (res.status === 401 && !isAuthPath && !isBackupPath) {
        console.warn("Unauthorized nodeFetch call, clearing session and reloading:", path);
        localStorage.removeItem('session_id');
        localStorage.removeItem('active_screen');
        window.location.reload();
        return res;
    }
    return res;
  } catch (err) {
    if (url !== path && SYSTEM_API_BASE_URL) {
      console.warn("API fetch via nodeFetch failed. Retrying with same-origin Local Express/Node server:", path, err);
      return fetch(path, options);
    }
    throw err;
  }
}

/**
 * Wrapper for direct communications with System REST API endpoints
 */
export async function systemFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getSystemApiUrl(path);
  try {
    const res = await fetch(url, options);
    const isAuthPath = path.includes('/pin-login') || path.includes('/probe') || path.includes('/check-verification-status');
    const isBackupPath = path.includes('/backup') || path.includes('/api/backup');
    if (res.status === 401 && !isAuthPath && !isBackupPath) {
        console.warn("Unauthorized systemFetch call, clearing session and reloading:", path);
        localStorage.removeItem('session_id');
        localStorage.removeItem('active_screen');
        window.location.reload();
        return res;
    }
    return res;
  } catch (err) {
    if (url !== path && SYSTEM_API_BASE_URL) {
      console.warn("API fetch failed. Retrying with same-origin Local Express/Node server:", path, err);
      return fetch(path, options);
    }
    throw err;
  }
}

