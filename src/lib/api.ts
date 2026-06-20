/**
 * Unified API Client Configuration
 * Allows developers to update base URLs in one place.
 */

// DJANGO_API_BASE_URL is disabled as we are purely using the Vite Express backend on AlwaysData
export const DJANGO_API_BASE_URL = '';

export const API_ENDPOINTS = {
    TOKEN: `${DJANGO_API_BASE_URL}/api/token/`,
    AUTH_PIN_LOGIN: `${DJANGO_API_BASE_URL}/api/auth/pin-login`,
    AUTH_REGISTER: `${DJANGO_API_BASE_URL}/api/auth/register-onboarding`,
};

/**
 * Normalizes and resolves paths for Django REST API Server
 */
export function getDjangoApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = DJANGO_API_BASE_URL.replace(/\/+$/, '');
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
 * Unified fetch wrapper that prepends the Django API URL to requests.
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getDjangoApiUrl(path);
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
    if (url !== path && DJANGO_API_BASE_URL) {
      console.warn("Django API fetch failed. Retrying with same-origin Local Express/Node server:", path, err);
      return fetch(path, options);
    }
    throw err;
  }
}

/**
 * Fetch wrapper for Node server endpoints.
 */
export async function nodeFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getDjangoApiUrl(path);
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
    if (url !== path && DJANGO_API_BASE_URL) {
      console.warn("Django API fetch via nodeFetch failed. Retrying with same-origin Local Express/Node server:", path, err);
      return fetch(path, options);
    }
    throw err;
  }
}

/**
 * Wrapper for direct communications with Django Rest API endpoints
 */
export async function djangoFetch(path: string, options?: RequestInit): Promise<Response> {
  const url = getDjangoApiUrl(path);
  try {
    const res = await fetch(url, options);
    const isAuthPath = path.includes('/pin-login') || path.includes('/probe') || path.includes('/check-verification-status');
    const isBackupPath = path.includes('/backup') || path.includes('/api/backup');
    if (res.status === 401 && !isAuthPath && !isBackupPath) {
        console.warn("Unauthorized djangoFetch call, clearing session and reloading:", path);
        localStorage.removeItem('session_id');
        localStorage.removeItem('active_screen');
        window.location.reload();
        return res;
    }
    return res;
  } catch (err) {
    if (url !== path && DJANGO_API_BASE_URL) {
      console.warn("Django API fetch failed. Retrying with same-origin Local Express/Node server:", path, err);
      return fetch(path, options);
    }
    throw err;
  }
}

