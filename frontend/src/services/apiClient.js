import { API_URL } from '../config';

// In-memory CSRF token fallback for mobile browsers where cookies may not work
// Exported as object so authService can update it from login/register responses
export let csrfTokenCache = '';

// Setter for csrfTokenCache (used by authService after login/register)
export const setCsrfTokenCache = (token) => { csrfTokenCache = token; };

export const getCsrfToken = () => {
  if (typeof document === 'undefined') return csrfTokenCache || '';
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  const cookieToken = match ? decodeURIComponent(match[1]) : '';
  // Return cookie token if available, otherwise use cached token
  return cookieToken || csrfTokenCache || '';
};

// Fetch fresh CSRF token from server (useful for mobile)
export const refreshCsrfToken = async () => {
  try {
    const res = await fetch(`${API_URL}/auth/csrf`, {
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      if (data.csrfToken) {
        csrfTokenCache = data.csrfToken;
        console.log('[apiClient] CSRF token refreshed from server');
        return data.csrfToken;
      }
    }
  } catch (e) {
    console.error('[apiClient] Error refreshing CSRF token:', e);
  }
  return '';
};

// Initialize CSRF token on app load (for mobile compatibility)
export const initializeCsrfToken = async () => {
  const existingToken = getCsrfToken();
  if (!existingToken) {
    console.log('[apiClient] No CSRF token found, fetching from server...');
    await refreshCsrfToken();
  }
};

export const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

export const apiFetch = async (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };

  if (!headers.Authorization && !headers.authorization) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Always read fresh from cookie (shared across tabs)
    let csrfToken = getCsrfToken();
    
    // If no CSRF token and user is authenticated, try to refresh it
    if (!csrfToken && getAuthToken()) {
      csrfToken = await refreshCsrfToken();
    }
    
    if (csrfToken && !headers['x-csrf-token']) {
      headers['x-csrf-token'] = csrfToken;
    }
  }

  const response = await fetch(url, {
    credentials: 'include',
    ...options,
    headers
  });

  // Auto-retry once on CSRF failure: re-read cookie (may have been updated by another tab)
  if (response.status === 403 && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const body = await response.clone().json().catch(() => ({}));
    if (body.message && body.message.includes('CSRF')) {
      // Re-read cookie (another tab may have refreshed it)
      const freshToken = getCsrfToken();
      if (freshToken && freshToken !== headers['x-csrf-token']) {
        headers['x-csrf-token'] = freshToken;
        return fetch(url, { credentials: 'include', ...options, headers });
      }
      // Cookie also stale — fetch new token from server and retry
      const serverToken = await refreshCsrfToken();
      if (serverToken) {
        headers['x-csrf-token'] = serverToken;
        return fetch(url, { credentials: 'include', ...options, headers });
      }
    }
  }

  return response;
};

export const apiUrl = (path) => `${API_URL}${path}`;
