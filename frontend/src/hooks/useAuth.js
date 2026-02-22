// useAuth.js - Hook para gestión de autenticación, sesión y sincronización cross-tab
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, isSessionExpired } from '../services/authService';
import { toast } from 'react-hot-toast';

/**
 * Hook que encapsula toda la lógica de autenticación:
 * - Login/logout handlers con integración de carrito
 * - Sincronización de sesión entre pestañas (storage event)
 * - Verificación de expiración de sesión al cargar
 *
 * NOTA: user/setUser se reciben desde App.jsx para romper la dependencia
 * circular con useCart (ambos necesitan al otro).
 *
 * @param {Object} deps - Dependencias externas
 * @param {Object|null} deps.user - Usuario actual
 * @param {Function} deps.setUser - Setter del estado de usuario
 * @param {Array} deps.cartItems - Items actuales del carrito (para sync en login)
 * @param {Function} deps.syncLocalCart - Envía carrito local al backend tras login
 * @param {Function} deps.clearCartItems - Limpia carrito localmente (para logout)
 */
export function useAuth({ user, setUser, cartItems, syncLocalCart, clearCartItems }) {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Sincronización de sesión entre pestañas via storage event
  useEffect(() => {
    const handleStorageChange = (event) => {
      // Logout en otra pestaña
      if (event.key === 'authToken' && !event.newValue && user) {
        setUser(null);
        clearCartItems();
        localStorage.removeItem('checkout_progress');
        toast.error("Sesión cerrada en otra pestaña");
        navigate('/');
      }
      // Login en otra pestaña
      if (event.key === 'userData' && event.newValue && !user) {
        try {
          const newUser = JSON.parse(event.newValue);
          setUser(newUser);
          toast.success(`Sesión iniciada como ${newUser.name}`);
        } catch {
          // JSON inválido, ignorar
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user, navigate, clearCartItems]);

  // Verificar expiración de sesión al cargar/refresh
  useEffect(() => {
    if (user && isSessionExpired()) {
      logout(); // Fire-and-forget OK for expired sessions
      setUser(null);
      clearCartItems();
      localStorage.removeItem('checkout_progress');
      toast.error("Tu sesión ha expirado. Por favor inicia sesión nuevamente.");
      navigate('/');
    }
  }, [navigate, user, clearCartItems]);

  // Cerrar sesión con feedback visual
  const handleLogout = async () => {
    setIsLoggingOut(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    await logout();
    setUser(null);
    clearCartItems();
    localStorage.removeItem('checkout_progress');
    setIsLoggingOut(false);
    toast.success("Sesión cerrada correctamente");
    navigate('/');
    setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 0);
  };

  // Navegación al panel de admin
  const handleAdminNav = (event) => {
    event.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    navigate('/admin');
  };

  // Handler de login exitoso con merge de carrito guest
  const handleLoginSuccess = async (userData, options = {}) => {
    const { redirect = true } = options;

    // Sincronizar carrito guest al backend si existe
    if (cartItems.length > 0) {
      await syncLocalCart(cartItems);
      localStorage.removeItem('cart_persistence');
    }
    
    setUser(userData);
    if (!redirect) return;

    // Redirigir según rol
    if (userData.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  // Login desde checkout (sin redirección)
  const handleCheckoutLoginSuccess = async (userData) => {
    await handleLoginSuccess(userData, { redirect: false });
  };

  return {
    user,
    setUser,
    isLoggingOut,
    handleLogout,
    handleLoginSuccess,
    handleCheckoutLoginSuccess,
    handleAdminNav
  };
}
