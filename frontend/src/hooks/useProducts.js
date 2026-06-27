// useProducts.js - Hook para gestión de productos, paginación y stock
// Siempre obtiene TODOS los productos sin filtros — cada página aplica su propio
// filtrado (categoría, búsqueda, orden) del lado del cliente para evitar que
// los filtros de una página contaminen el estado global compartido.
import { useState, useCallback, useEffect, useRef } from 'react';
import { API_URL } from '../config';
import { apiFetch } from '../services/apiClient';
import { getCacheItem, setCacheItem, removeCacheItem } from '../utils/cacheStorage';

const PRODUCTS_CACHE_KEY_ALL = 'products_cache_v3_all';
const PRODUCTS_CACHE_FRESH_MS = 2 * 60 * 1000;
const PRODUCTS_CACHE_MAX_STALE_MS = 12 * 60 * 60 * 1000;
const PRODUCTS_REVALIDATE_COOLDOWN_MS = 30 * 1000;
const PRODUCTS_PAGE_LIMIT = 200; // fetch up to 200 products for client-side filtering

/**
 * Hook que encapsula toda la lógica de productos:
 * - Estado de todos los productos (sin filtrar), paginación, carga y errores
 * - Fetch con caché en localStorage
 * - Actualización local de stock (para sincronía con carrito)
 * - Cada página aplica sus propios filtros (categoría, búsqueda, orden) localmente
 */
export function useProducts() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: PRODUCTS_PAGE_LIMIT, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modifica el stock local de un producto por delta (+/-)
  const updateProductStock = useCallback((productId, delta) => {
    setProducts((prev) => prev.map((product) => {
      if (product.id !== productId) return product;
      const currentStock = Number.isFinite(product.stock) ? product.stock : 0;
      return { ...product, stock: Math.max(0, currentStock + delta) };
    }));
  }, []);

  // Descuenta stock local cuando se completa una orden
  const handleOrderCompleted = useCallback((items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (item && typeof item.id === 'number' && typeof item.quantity === 'number') {
        updateProductStock(item.id, -item.quantity);
      }
    });
  }, [updateProductStock]);

  // Sincroniza stock local desde datos del carrito del backend
  const syncProductsFromCartData = useCallback((cartData) => {
    if (!Array.isArray(cartData)) return;
    const stockByProductId = new Map();
    cartData.forEach((item) => {
      if (item && typeof item.product_id === 'number') {
        stockByProductId.set(item.product_id, item.stock);
      }
    });
    if (stockByProductId.size === 0) return;
    setProducts((prev) => prev.map((product) => (
      stockByProductId.has(product.id)
        ? { ...product, stock: stockByProductId.get(product.id) }
        : product
    )));
  }, []);

  // Fetch de TODOS los productos (sin filtros) con caché en localStorage
  const fetchProducts = useCallback(async (force = false) => {
    try {
      const cachedData = getCacheItem(PRODUCTS_CACHE_KEY_ALL);
      const now = new Date().getTime();
      const hasCached = !!cachedData?.data;
      const cacheAge = hasCached ? (now - (cachedData.timestamp || 0)) : Number.POSITIVE_INFINITY;
      const isCacheFresh = hasCached && cacheAge < PRODUCTS_CACHE_FRESH_MS;
      const isCacheTooOld = hasCached && cacheAge > PRODUCTS_CACHE_MAX_STALE_MS;
      const lastValidatedAt = Number(cachedData?.lastValidatedAt || 0);
      const shouldThrottleRevalidate = (now - lastValidatedAt) < PRODUCTS_REVALIDATE_COOLDOWN_MS;

      if (isCacheTooOld) {
        removeCacheItem(PRODUCTS_CACHE_KEY_ALL);
      }

      // Mostrar datos cacheados inmediatamente
      if (hasCached && !isCacheTooOld) {
        setProducts(cachedData.data);
        setPagination({
          page: 1,
          limit: PRODUCTS_PAGE_LIMIT,
          total: cachedData.data.length,
          totalPages: 1
        });
        setLoading(false);
        setError(null);
      }

      // Revalidación en background con throttle
      if (!force && hasCached && isCacheFresh && shouldThrottleRevalidate) {
        return;
      }

      // Sin caché: mostrar loading
      if (!hasCached || isCacheTooOld) {
        setLoading(true);
        setError(null);
      }

      const queryParams = new URLSearchParams({
        page: '1',
        limit: String(PRODUCTS_PAGE_LIMIT)
      });

      const url = `${API_URL}/products?${queryParams}`;
      const response = await apiFetch(url);

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const result = await response.json();

      if (result.data) {
        setProducts(result.data);
        setPagination({
          page: 1,
          limit: PRODUCTS_PAGE_LIMIT,
          total: result.data.length,
          totalPages: 1
        });

        // Guardar en caché
        setCacheItem(PRODUCTS_CACHE_KEY_ALL, {
          timestamp: new Date().getTime(),
          lastValidatedAt: new Date().getTime(),
          data: result.data
        });
      } else {
        setProducts(Array.isArray(result) ? result : []);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching products:', err);
      if (!getCacheItem(PRODUCTS_CACHE_KEY_ALL)) {
        setError('No se pudieron cargar los productos. Por favor, inténtalo de nuevo más tarde.');
      }
      setLoading(false);
    }
  }, []);

  // Fuerza recarga completa: limpia caché y vuelve a buscar
  const forceRefreshProducts = useCallback(async () => {
    removeCacheItem(PRODUCTS_CACHE_KEY_ALL);
    await fetchProducts(true);
  }, [fetchProducts]);

  // Fetch inicial de productos
  useEffect(() => {
    fetchProducts(false);
  }, [fetchProducts]);

  // Revalidación al volver al tab/app
  useEffect(() => {
    const revalidateOnFocus = () => {
      fetchProducts(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidateOnFocus();
      }
    };

    window.addEventListener('focus', revalidateOnFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', revalidateOnFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchProducts]);

  return {
    products,
    pagination,
    loading,
    error,
    fetchProducts,
    forceRefreshProducts,
    updateProductStock,
    syncProductsFromCartData,
    handleOrderCompleted
  };
}
