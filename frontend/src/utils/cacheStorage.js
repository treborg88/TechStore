// cacheStorage.js - Utilidades centralizadas para localStorage cache (v2)

export const CACHE_KEYS = {
  settings: 'settings_cache_v2'
};

export const getCacheItem = (key) => {
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

export const setCacheItem = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const removeCacheItem = (key) => {
  localStorage.removeItem(key);
};

export const buildProductsCacheKey = (category, page, search = '', sort = '') =>
  `products_cache_v3_${category}_${page}_${search}_${sort}`;
