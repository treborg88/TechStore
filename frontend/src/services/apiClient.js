import { API_URL } from '../config';

// In-memory CSRF token fallback for mobile browsers where cookies may not work
let csrfTokenCache = '';

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
    let csrfToken = getCsrfToken();
    
    // If no CSRF token and user is authenticated, try to refresh it
    if (!csrfToken && getAuthToken()) {
      csrfToken = await refreshCsrfToken();
    }
    
    if (csrfToken && !headers['x-csrf-token']) {
      headers['x-csrf-token'] = csrfToken;
    }
  }

  return fetch(url, {
    credentials: 'include',
    ...options,
    headers
  });
};

export const apiUrl = (path) => `${API_URL}${path}`;
