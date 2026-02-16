// useCart.js - Hook para gestión completa del carrito (guest + autenticado)
import { useState, useCallback, useEffect } from 'react';
import { apiFetch, apiUrl, initializeCsrfToken } from '../services/apiClient';
import { formatBackendCart } from '../utils/cartHelpers';
import { toast } from 'react-hot-toast';

/**
 * Hook que encapsula toda la lógica del carrito:
 * - Estado local (guest) con persistencia en localStorage
 * - Sincronización con backend (usuario autenticado)
 * - Operaciones CRUD: add, remove, clear, clearAll
 * - Merge automático de carrito guest al iniciar sesión
 *
 * @param {Object} deps - Dependencias externas
 * @param {Object|null} deps.user - Usuario actual (null = guest)
 * @param {Function} deps.updateProductStock - Modifica stock local de productos
 * @param {Function} deps.syncProductsFromCartData - Sincroniza stock desde datos del carrito backend
 */
export function useCart({ user, updateProductStock, syncProductsFromCartData }) {
  // Estado del carrito, inicializado desde localStorage para resiliencia al refresh
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('cart_persistence');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isCartLoading, setIsCartLoading] = useState(false);

  // --- Operaciones de fetch internas ---

  // Obtiene el carrito del backend (requiere token de auth)
  const fetchCartWithToken = useCallback(async () => {
    try {
      const response = await apiFetch(apiUrl('/cart'));
      if (response.ok) {
        const data = await response.json();
        setCartItems(formatBackendCart(data));
        syncProductsFromCartData(data);
      }
    } catch (err) {
      console.error('Error fetching cart:', err);
    }
  }, [syncProductsFromCartData]);

  // Fetch condicional (solo si hay usuario autenticado)
  const fetchCart = useCallback(async () => {
    if (!user) return;
    await fetchCartWithToken();
  }, [user, fetchCartWithToken]);

  // Sincroniza carrito local (guest) al backend tras login
  const syncLocalCart = useCallback(async (localCart) => {
    if (!localCart || localCart.length === 0) return;
    
    const promises = localCart.map(item => 
      apiFetch(apiUrl('/cart'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: Number.parseInt(item.id, 10),
          quantity: Number.parseInt(item.quantity, 10)
        })
      })
    );

    try {
      await Promise.all(promises);
      await fetchCartWithToken();
    } catch (err) {
      console.error('Error syncing cart:', err);
    }
  }, [fetchCartWithToken]);

  // --- Operaciones CRUD del carrito ---

  // Agrega un producto (backend si autenticado, local si guest)
  const addToCart = async (product, options = {}) => {
    const { showLoading = false } = options;
    if (showLoading) setIsCartLoading(true);

    if (user) {
      try {
        const productId = Number.parseInt(product.id, 10);
        if (!Number.isFinite(productId)) {
          toast.error('Producto inválido');
          return false;
        }

        const response = await apiFetch(apiUrl('/cart'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, quantity: 1 })
        });
        
        if (response.ok) {
          const data = await response.json();
          setCartItems(formatBackendCart(data));
          syncProductsFromCartData(data);
          toast.success("Producto agregado al carrito");
          return true;
        } else {
          const errorData = await response.json();
          toast.error(errorData.message || "Error al agregar al carrito");
          return false;
        }
      } catch (err) {
        console.error(err);
        toast.error("Error de conexión");
        return false;
      } finally {
        if (showLoading) setIsCartLoading(false);
      }
    } else {
      // Modo guest: carrito local
      try {
        const exist = cartItems.find(item => item.id === product.id);
        if (exist) {
          if (exist.quantity < product.stock) {
            toast.success("Cantidad actualizada");
            setCartItems(prev => prev.map(item =>
              item.id === product.id
                ? { ...item, quantity: item.quantity + 1 }
                : item
            ));
            updateProductStock(product.id, -1);
            return true;
          } else {
            toast.error("No hay más stock disponible.");
            return false;
          }
        } else {
          const image = product.images && product.images.length > 0
            ? product.images[0].image_path
            : product.image;
          toast.success("Producto agregado al carrito");
          setCartItems(prev => [...prev, { ...product, image, quantity: 1 }]);
          updateProductStock(product.id, -1);
          return true;
        }
      } finally {
        if (showLoading) setIsCartLoading(false);
      }
    }
  };

  // Reduce cantidad en 1 (backend o local)
  const removeFromCart = async (product) => {
    if (user) {
      if (product.quantity > 1) {
        try {
          const response = await apiFetch(apiUrl(`/cart/${product.id}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quantity: product.quantity - 1 })
          });
          if (response.ok) {
            const data = await response.json();
            setCartItems(formatBackendCart(data));
            syncProductsFromCartData(data);
            toast.success("Cantidad actualizada");
          }
        } catch (e) { console.error(e); }
      }
    } else {
      if (product.quantity > 1) {
        toast.success("Cantidad actualizada");
        updateProductStock(product.id, 1);
      }
      setCartItems(prev =>
        prev.map(item =>
          item.id === product.id && item.quantity > 1
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
      );
    }
  };

  // Establece cantidad exacta (input directo): soporta guest y autenticado
  const setCartQuantity = async (product, nextQuantity) => {
    const parsedQuantity = Number.parseInt(nextQuantity, 10);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
      toast.error('Cantidad inválida. Debe ser mayor o igual a 1.');
      return false;
    }

    if (user) {
      try {
        const response = await apiFetch(apiUrl(`/cart/${product.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quantity: parsedQuantity })
        });

        if (response.ok) {
          const data = await response.json();
          setCartItems(formatBackendCart(data));
          syncProductsFromCartData(data);
          toast.success('Cantidad actualizada');
          return true;
        }

        const errorData = await response.json();
        toast.error(errorData.message || 'No se pudo actualizar la cantidad');
        return false;
      } catch (err) {
        console.error(err);
        toast.error('Error de conexión');
        return false;
      }
    }

    // Modo guest: ajustar stock por diferencia entre cantidad actual y nueva
    const currentItem = cartItems.find((item) => item.id === product.id);
    if (!currentItem) return false;

    const stockLimit = Number.isFinite(Number(currentItem.stock)) && Number(currentItem.stock) > 0
      ? Number(currentItem.stock)
      : parsedQuantity;

    const safeQuantity = Math.min(parsedQuantity, stockLimit);
    if (safeQuantity !== parsedQuantity) {
      toast.error(`Solo hay ${stockLimit} unidad(es) disponibles.`);
    }

    const delta = safeQuantity - currentItem.quantity;
    if (delta === 0) return true;

    if (delta > 0) {
      updateProductStock(product.id, -delta);
    } else {
      updateProductStock(product.id, Math.abs(delta));
    }

    setCartItems((prev) => prev.map((item) => (
      item.id === product.id ? { ...item, quantity: safeQuantity } : item
    )));

    toast.success('Cantidad actualizada');
    return true;
  };

  // Elimina un producto completo del carrito
  const clearFromCart = async (product) => {
    if (user) {
      try {
        const response = await apiFetch(apiUrl(`/cart/${product.id}`), {
          method: 'DELETE',
        });
        if (response.ok) {
          const data = await response.json();
          setCartItems(formatBackendCart(data));
          syncProductsFromCartData(data);
        }
      } catch (e) { console.error(e); }
    } else {
      updateProductStock(product.id, product.quantity);
      setCartItems(prev => prev.filter(item => item.id !== product.id));
    }
  };

  // Vacía todo el carrito
  const clearAllCart = async () => {
    if (user) {
      try {
        const response = await apiFetch(apiUrl('/cart'), {
          method: 'DELETE',
        });
        if (response.ok) {
          const data = await response.json();
          syncProductsFromCartData(data.cart || []);
          setCartItems([]);
        }
      } catch (e) { console.error(e); }
    } else {
      cartItems.forEach((item) => updateProductStock(item.id, item.quantity));
      setCartItems([]);
    }
  };

  // Limpia el carrito sin llamadas al backend (para logout/expiración de sesión)
  const clearCartItems = useCallback(() => {
    setCartItems([]);
  }, []);

  // --- Efectos ---

  // Sincroniza carrito con backend cuando cambia el usuario autenticado
  useEffect(() => {
    if (user) {
      initializeCsrfToken();
      // No fetch si hay pago pendiente (orden creada pero pago no confirmado)
      const hasPendingPayment = localStorage.getItem('pending_stripe_payment') || 
                                 localStorage.getItem('pending_paypal_payment');
      if (!hasPendingPayment) {
        fetchCart();
      }
    }
  }, [user, fetchCart]);

  // Persistencia del carrito en localStorage (resiliencia al refresh)
  useEffect(() => {
    const hasPendingPayment = localStorage.getItem('pending_stripe_payment') || 
                               localStorage.getItem('pending_paypal_payment');
    if (!hasPendingPayment || cartItems.length > 0) {
      localStorage.setItem('cart_persistence', JSON.stringify(cartItems));
    }
  }, [cartItems]);

  return {
    cartItems,
    setCartItems,
    isCartLoading,
    addToCart,
    removeFromCart,
    setCartQuantity,
    clearFromCart,
    clearAllCart,
    clearCartItems,
    syncLocalCart,
    fetchCart
  };
}
