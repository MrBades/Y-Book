/**
 * Utility to resolve the actual base URL of the application,
 * robustly handling sandbox iframe environments where `window.location.origin` might be "null".
 */
export function getAppBaseUrl(): string {
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
  return origin ? origin.replace(/\/+$/, '') : '';
}
