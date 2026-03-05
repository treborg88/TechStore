// useProducts.js - Hook para gestión de productos, paginación y stock
import { useState, useCallback, useEffect, useRef } from 'react';
import { API_URL } from '../config';
import { apiFetch } from '../services/apiClient';
import { buildProductsCacheKey, getCacheItem, setCacheItem, removeCacheItem } from '../utils/cacheStorage';

const PRODUCTS_CACHE_FRESH_MS = 2 * 60 * 1000;
const PRODUCTS_CACHE_MAX_STALE_MS = 12 * 60 * 60 * 1000;
const PRODUCTS_REVALIDATE_COOLDOWN_MS = 30 * 1000;

/**
 * Hook que encapsula toda la lógica de productos:
 * - Estado de productos, paginación, carga y errores
 * - Fetch con caché en localStorage (10 min de frescura)
 * - Actualización local de stock (para sincronía con carrito)
 */
export function useProducts() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastRequestRef = useRef({ category: 'todos', page: 1 });

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

  // Fetch de productos con caché en localStorage
  const fetchProducts = useCallback(async (category = 'todos', page = 1, options = {}) => {
    const { force = false } = options;
    lastRequestRef.current = { category, page };
    const cacheKey = buildProductsCacheKey(category, page);

    try {
      const cachedData = getCacheItem(cacheKey);
      const now = new Date().getTime();
      const hasCached = !!cachedData?.data;
      const cacheAge = hasCached ? (now - (cachedData.timestamp || 0)) : Number.POSITIVE_INFINITY;
      const isCacheFresh = hasCached && cacheAge < PRODUCTS_CACHE_FRESH_MS;
      const isCacheTooOld = hasCached && cacheAge > PRODUCTS_CACHE_MAX_STALE_MS;
      const lastValidatedAt = Number(cachedData?.lastValidatedAt || 0);
      const shouldThrottleRevalidate = (now - lastValidatedAt) < PRODUCTS_REVALIDATE_COOLDOWN_MS;

      if (isCacheTooOld) {
        removeCacheItem(cacheKey);
      }

      // Cargar del caché si existe
      if (hasCached && !isCacheTooOld) {
        setProducts(cachedData.data);
        setPagination(cachedData.pagination);
        setLoading(false);
        setError(null);
      }

      // Política balanceada: revalidar en background, pero con throttle para evitar ruido
      if (!force && hasCached && isCacheFresh && shouldThrottleRevalidate) {
        return;
      }

      // Sin caché: mostrar loading
      if (!hasCached || isCacheTooOld) {
        setLoading(true);
        setError(null);
      }

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });

      if (category !== 'todos') {
        queryParams.append('category', category);
      }

      const url = `${API_URL}/products?${queryParams}`;
      const response = await apiFetch(url);

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const result = await response.json();

      if (result.data) {
        setProducts(result.data);
        setPagination({
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        });

        // Guardar en caché
        setCacheItem(cacheKey, {
          timestamp: new Date().getTime(),
          lastValidatedAt: new Date().getTime(),
          data: result.data,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages
          }
        });
      } else {
        setProducts(Array.isArray(result) ? result : []);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching products:', err);
      if (!getCacheItem(cacheKey)) {
        setError('No se pudieron cargar los productos. Por favor, inténtalo de nuevo más tarde.');
      }
      setLoading(false);
    }
  }, []);

  // Fetch inicial de productos
  useEffect(() => {
    fetchProducts('todos');
  }, [fetchProducts]);

  // Revalidación al volver al tab/app para evitar datos visualmente desactualizados
  useEffect(() => {
    const revalidateOnFocus = () => {
      const { category, page } = lastRequestRef.current;
      fetchProducts(category, page, { force: false });
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
    updateProductStock,
    syncProductsFromCartData,
    handleOrderCompleted
  };
}
