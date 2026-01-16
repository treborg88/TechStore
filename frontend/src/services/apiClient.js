import { API_URL } from '../config';

export const getCsrfToken = () => {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
};

export const getAuthToken = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('authToken') || '';
};

export const apiFetch = (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };

  if (!headers.Authorization && !headers.authorization) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = getCsrfToken();
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
