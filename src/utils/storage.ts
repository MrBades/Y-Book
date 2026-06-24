/**
 * Safe LocalStorage Wrapper
 * Prevents DOMException SecurityError in browsers with blocked cookies, incognito mode,
 * or strict privacy settings.
 */
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    } catch (e) {
      console.warn(`[SafeStorage] getItem failed for key "${key}":`, e);
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`[SafeStorage] setItem failed for key "${key}":`, e);
    }
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[SafeStorage] removeItem failed for key "${key}":`, e);
    }
  },

  clear(): void {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
      }
    } catch (e) {
      console.warn('[SafeStorage] clear failed:', e);
    }
  }
};
