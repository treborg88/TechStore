import { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import './components/auth/LoginPage.css';
import { getCurrentUser, logout, isSessionExpired } from './services/authService';

import { API_URL, DEFAULT_CATEGORY_FILTERS_CONFIG, DEFAULT_PRODUCT_CARD_CONFIG } from './config';
import { apiFetch, apiUrl, initializeCsrfToken } from './services/apiClient';
import { Toaster, toast } from 'react-hot-toast';

// Common components
import LoadingSpinner from './components/common/LoadingSpinner';
import Header from './components/common/Header';

// Lazy loading components - organized by feature
const Footer = lazy(() => import('./components/common/Footer'));

// Auth
const LoginPage = lazy(() => import('./components/auth/LoginPage'));
const UserProfile = lazy(() => import('./components/auth/UserProfile'));

// Products
const ProductDetail = lazy(() => import('./components/products/ProductDetail'));

// Cart
const Cart = lazy(() => import('./components/cart/Cart'));
const Checkout = lazy(() => import('./components/cart/Checkout'));

// Admin
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const SettingsManager = lazy(() => import('./components/admin/SettingsManager'));

// Pages
const OrderTracker = lazy(() => import('./pages/OrderTracker'));
const Home = lazy(() => import('./pages/Home'));
const Contact = lazy(() => import('./pages/Contact'));

// Settings cloning and merging helpers
const cloneCategoryConfig = (value) => {
  const base = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_FILTERS_CONFIG));
  if (!value || typeof value !== 'object') return base;
  return {
    ...base,
    ...value,
    categories: Array.isArray(value.categories) && value.categories.length > 0
      ? value.categories
      : base.categories,
    styles: {
      ...base.styles,
      ...(value.styles || {})
    }
  };
};

const cloneProductCardConfig = (value) => {
  const base = JSON.parse(JSON.stringify(DEFAULT_PRODUCT_CARD_CONFIG));
  if (!value || typeof value !== 'object') return base;
  const merged = {
    ...base,
    ...value,
    layout: {
      ...base.layout,
      ...(value.layout || {})
    },
    styles: {
      ...base.styles,
      ...(value.styles || {})
    }
  };
  merged.useDefault = value.useDefault === true || value.useDefault === 'true';
  if (merged.layout) {
    const toNumber = (val) => {
      if (val === '' || val === null || val === undefined) return val;
      const num = Number(val);
      return Number.isNaN(num) ? val : num;
    };
    merged.layout = {
      ...merged.layout,
      columnsMobile: toNumber(merged.layout.columnsMobile),
      columnsTablet: toNumber(merged.layout.columnsTablet),
      columnsDesktop: toNumber(merged.layout.columnsDesktop),
      columnsWide: toNumber(merged.layout.columnsWide)
    };
  }
  return merged;
};

// Helper to format backend cart to frontend format
const formatBackendCart = (backendCart) => {
  return backendCart.map(item => ({
    id: item.product_id,
    name: item.name,
    price: item.price,
    image: item.image,
    stock: item.stock,
    quantity: item.quantity
  }));
};

function App() {
  // Estados de configuración del sitio
  const [siteName, setSiteName] = useState(() => localStorage.getItem('siteName') || 'TechStore');
  const [siteIcon, setSiteIcon] = useState(() => localStorage.getItem('siteIcon') || '🛍️');
  const [siteLogo, setSiteLogo] = useState(() => localStorage.getItem('siteLogo') || '');
  const [siteLogoSize, setSiteLogoSize] = useState(() => parseInt(localStorage.getItem('siteLogoSize')) || 40);
  const [siteNameImage, setSiteNameImage] = useState(() => localStorage.getItem('siteNameImage') || '');
  const [siteNameImageSize, setSiteNameImageSize] = useState(() => parseInt(localStorage.getItem('siteNameImageSize')) || 32);
  const [heroSettings, setHeroSettings] = useState({
    title: 'La Mejor Tecnología a Tu Alcance',
    description: 'Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado.',
    primaryBtn: 'Ver Productos',
    secondaryBtn: 'Ofertas Especiales',
    image: '',
    titleSize: 2.1,
    descriptionSize: 1.05,
    positionY: 'center',
    positionX: 'left',
    imageWidth: 100,
    overlayOpacity: 0.5,
    height: 360,
    textColor: '#ffffff',
    bannerImage: '',
    bannerSize: 150,
    bannerPositionX: 'right',
    bannerPositionY: 'center',
    bannerOpacity: 100
  });
  const [headerSettings, setHeaderSettings] = useState({
    bgColor: '#2563eb',
    transparency: 100,
    textColor: '#ffffff',
    buttonColor: '#ffffff',
    buttonTextColor: '#2563eb'
  });
  const [themeSettings, setThemeSettings] = useState({
    primaryColor: '#2563eb',
    secondaryColor: '#7c3aed',
    accentColor: '#f59e0b',
    backgroundColor: '#f8fafc',
    textColor: '#1e293b'
  });
  const [productDetailHeroImage, setProductDetailHeroImage] = useState('');
  const [productDetailHeroSettings, setProductDetailHeroSettings] = useState({
    useHomeHero: true,
    height: 200,
    overlayOpacity: 0.5,
    bannerImage: '',
    bannerSize: 120,
    bannerPositionX: 'right',
    bannerPositionY: 'center',
    bannerOpacity: 100
  });
  const [categoryFilterSettings, setCategoryFilterSettings] = useState(() => (
    JSON.parse(JSON.stringify(DEFAULT_CATEGORY_FILTERS_CONFIG))
  ));
  const [productCardSettings, setProductCardSettings] = useState(() => (
    JSON.parse(JSON.stringify(DEFAULT_PRODUCT_CARD_CONFIG))
  ));

  // Otros estados
  const [cartItems, setCartItems] = useState(() => {
    try {
      const saved = localStorage.getItem('cart_persistence');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isCartLoading, setIsCartLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState(null);
  
  // Initialize user state with session expiry check
  const [user, setUser] = useState(() => {
    // Check if session is expired on initial load
    if (isSessionExpired()) {
      logout(); // Clear expired session data
      return null;
    }
    return getCurrentUser();
  });

  const navigate = useNavigate();

  // Sync session across tabs using storage event
  useEffect(() => {
    const handleStorageChange = (event) => {
      // User logged out in another tab
      if (event.key === 'authToken' && !event.newValue && user) {
        setUser(null);
        setCartItems([]);
        localStorage.removeItem('checkout_progress');
        toast.error("Sesión cerrada en otra pestaña");
        navigate('/');
      }
      // User logged in in another tab
      if (event.key === 'userData' && event.newValue && !user) {
        try {
          const newUser = JSON.parse(event.newValue);
          setUser(newUser);
          toast.success(`Sesión iniciada como ${newUser.name}`);
        } catch {
          // Invalid JSON, ignore
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user, navigate]);

  // Handle session expiry on page load/refresh - redirect to home if expired
  useEffect(() => {
    const checkSession = () => {
      if (user && isSessionExpired()) {
        logout();
        setUser(null);
        setCartItems([]);
        localStorage.removeItem('checkout_progress');
        toast.error("Tu sesión ha expirado. Por favor inicia sesión nuevamente.");
        navigate('/');
      }
    };
    checkSession();
  }, [navigate, user]);

  const updateProductStock = useCallback((productId, delta) => {
    setProducts((prev) => prev.map((product) => {
      if (product.id !== productId) return product;
      const currentStock = Number.isFinite(product.stock) ? product.stock : 0;
      return { ...product, stock: Math.max(0, currentStock + delta) };
    }));
  }, []);

  const handleOrderCompleted = useCallback((items) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (item && typeof item.id === 'number' && typeof item.quantity === 'number') {
        updateProductStock(item.id, -item.quantity);
      }
    });
  }, [updateProductStock]);

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

  // Funciones de manejo de autenticación (DECLARADAS ANTES DE SU USO)


  const handleLogout = async () => {
    setIsLoggingOut(true);
    // Simular un pequeño delay para que se vea el spinner
    await new Promise(resolve => setTimeout(resolve, 800));
    logout();
    setUser(null);
    setCartItems([]);
    localStorage.removeItem('checkout_progress');
    setIsLoggingOut(false);
    toast.success("Sesión cerrada correctamente");
    navigate('/');
    setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 0);
  };

  const handleAdminNav = (event) => {
    event.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    navigate('/admin');
  };

  const handleLoginSuccess = async (userData, options = {}) => {
    const { redirect = true } = options;

    // Sync guest cart if exists
    if (cartItems.length > 0) {
      await syncLocalCart(cartItems);
      localStorage.removeItem('cart_persistence');
    }
    
    setUser(userData);
    if (!redirect) return;

    // Solo ir al panel de admin si el usuario es admin
    if (userData.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  const handleCheckoutLoginSuccess = async (userData) => {
    await handleLoginSuccess(userData, { redirect: false });
  };

  // Funciones de carrito
  const addToCart = async (product, options = {}) => {
    const { showLoading = false } = options;
    if (showLoading) {
      setIsCartLoading(true);
    }
    if (user) {
      try {
        const response = await apiFetch(apiUrl('/cart'), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ productId: product.id, quantity: 1 })
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
        if (showLoading) {
          setIsCartLoading(false);
        }
      }
    } else {
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
        const image = product.images && product.images.length > 0 ? product.images[0].image_path : product.image;
        toast.success("Producto agregado al carrito");
        setCartItems(prev => [...prev, { ...product, image, quantity: 1 }]);
        updateProductStock(product.id, -1);
        return true;
      }
      } finally {
        if (showLoading) {
          setIsCartLoading(false);
        }
      }
    }
  };

  const removeFromCart = async (product) => {
    if (user) {
      if (product.quantity > 1) {
        try {
          const response = await apiFetch(apiUrl(`/cart/${product.id}`), {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json'
            },
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

  // Fetch cart from backend
  const fetchCart = useCallback(async () => {
    if (!user) return;
    await fetchCartWithToken();
  }, [user, fetchCartWithToken]);

  // Sync local cart to backend
  const syncLocalCart = async (localCart) => {
    if (!localCart || localCart.length === 0) return;
    
    const promises = localCart.map(item => 
      apiFetch(apiUrl('/cart'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ productId: item.id, quantity: item.quantity })
      })
    );

    try {
      await Promise.all(promises);
      await fetchCartWithToken();
    } catch (err) {
      console.error('Error syncing cart:', err);
    }
  };

  // Effects
  const fetchProducts = useCallback(async (category = 'todos', page = 1, options = {}) => {
    const { force = false } = options;
    const cacheKey = `products_cache_${category}_${page}`;

    try {
      const cachedData = localStorage.getItem(cacheKey);
      const now = new Date().getTime();
      const parsedCache = cachedData ? JSON.parse(cachedData) : null;
      const hasCached = !!parsedCache?.data;
      const isCacheFresh = hasCached && (now - parsedCache.timestamp < 10 * 60 * 1000);

      if (hasCached) {
        setProducts(parsedCache.data);
        setPagination(parsedCache.pagination);
        setLoading(false);
        setError(null);
      }

      if (!force && isCacheFresh) {
        return;
      }

      if (!hasCached) {
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

        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: new Date().getTime(),
          data: result.data,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages
          }
        }));
      } else {
        setProducts(Array.isArray(result) ? result : []);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching products:', err);
      if (!localStorage.getItem(cacheKey)) {
        setError('No se pudieron cargar los productos. Por favor, inténtalo de nuevo más tarde.');
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts('todos');
  }, [fetchProducts]);

  // Actualizar título de la página y favicon dinámicamente
  useEffect(() => {
    // Actualizar título de la página
    document.title = siteName || 'TechStore';
    
    // Actualizar favicon
    const favicon = document.getElementById('favicon');
    if (favicon) {
      if (siteLogo) {
        // Usar logo como favicon si existe
        favicon.href = siteLogo;
        favicon.type = 'image/png';
      } else if (siteIcon) {
        // Crear emoji favicon usando canvas
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.font = '56px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(siteIcon, 32, 36);
        favicon.href = canvas.toDataURL('image/png');
        favicon.type = 'image/png';
      }
    }
  }, [siteName, siteIcon, siteLogo]);

  // Cargar ajustes del sitio
  useEffect(() => {
    const applySettings = (data) => {
      if (data.siteName) {
        setSiteName(data.siteName);
        localStorage.setItem('siteName', data.siteName);
      }
      if (data.siteIcon) {
        setSiteIcon(data.siteIcon);
        localStorage.setItem('siteIcon', data.siteIcon);
      }
      // siteLogo can be empty string, so check for undefined
      if (data.siteLogo !== undefined) {
        setSiteLogo(data.siteLogo || '');
        localStorage.setItem('siteLogo', data.siteLogo || '');
      }
      // siteNameImage can be empty string, so check for undefined
      if (data.siteNameImage !== undefined) {
        setSiteNameImage(data.siteNameImage || '');
        localStorage.setItem('siteNameImage', data.siteNameImage || '');
      }
      // Logo and name image sizes
      if (data.siteLogoSize !== undefined) {
        const size = parseInt(data.siteLogoSize) || 40;
        setSiteLogoSize(size);
        localStorage.setItem('siteLogoSize', size.toString());
      }
      if (data.siteNameImageSize !== undefined) {
        const size = parseInt(data.siteNameImageSize) || 32;
        setSiteNameImageSize(size);
        localStorage.setItem('siteNameImageSize', size.toString());
      }
      if (data.heroTitle || data.heroDescription || data.heroPrimaryBtn || data.heroSecondaryBtn || data.heroImage || data.heroTitleSize || data.heroDescriptionSize || data.heroPositionY || data.heroPositionX || data.heroImageWidth !== undefined || data.heroOverlayOpacity !== undefined || data.heroHeight !== undefined || data.heroTextColor || data.heroBannerImage) {
        setHeroSettings({
          title: data.heroTitle || 'La Mejor Tecnología a Tu Alcance',
          description: data.heroDescription || 'Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado.',
          primaryBtn: data.heroPrimaryBtn || 'Ver Productos',
          secondaryBtn: data.heroSecondaryBtn || 'Ofertas Especiales',
          image: data.heroImage || '',
          titleSize: parseFloat(data.heroTitleSize) || 2.1,
          descriptionSize: parseFloat(data.heroDescriptionSize) || 1.05,
          positionY: data.heroPositionY || 'center',
          positionX: data.heroPositionX || 'left',
          imageWidth: parseFloat(data.heroImageWidth) || 100,
          overlayOpacity: parseFloat(data.heroOverlayOpacity) ?? 0.5,
          height: parseFloat(data.heroHeight) || 360,
          textColor: data.heroTextColor || '#ffffff',
          bannerImage: data.heroBannerImage || '',
          bannerSize: parseFloat(data.heroBannerSize) || 150,
          bannerPositionX: data.heroBannerPositionX || 'right',
          bannerPositionY: data.heroBannerPositionY || 'center',
          bannerOpacity: parseFloat(data.heroBannerOpacity) || 100
        });
      }
      if (data.headerBgColor || data.headerTransparency !== undefined || data.headerTextColor || data.headerButtonColor || data.headerButtonTextColor) {
        const transparencyValue = parseInt(data.headerTransparency);
        setHeaderSettings({
          bgColor: data.headerBgColor || '#2563eb',
          transparency: !isNaN(transparencyValue) ? transparencyValue : 100,
          textColor: data.headerTextColor || '#ffffff',
          buttonColor: data.headerButtonColor || '#ffffff',
          buttonTextColor: data.headerButtonTextColor || '#2563eb'
        });
      }
      if (data.primaryColor) {
        setThemeSettings({
          primaryColor: data.primaryColor || '#2563eb',
          secondaryColor: data.secondaryColor || '#7c3aed',
          accentColor: data.accentColor || '#f59e0b',
          backgroundColor: data.backgroundColor || '#f8fafc',
          textColor: data.textColor || '#1e293b'
        });
      }
      if (data.productDetailHeroImage || data.productDetailUseHomeHero !== undefined) {
        setProductDetailHeroImage(data.productDetailHeroImage || '');
        setProductDetailHeroSettings({
          useHomeHero: data.productDetailUseHomeHero !== 'false' && data.productDetailUseHomeHero !== false,
          height: parseFloat(data.productDetailHeroHeight) || 200,
          overlayOpacity: parseFloat(data.productDetailHeroOverlayOpacity) ?? 0.5,
          bannerImage: data.productDetailHeroBannerImage || '',
          bannerSize: parseFloat(data.productDetailHeroBannerSize) || 120,
          bannerPositionX: data.productDetailHeroBannerPositionX || 'right',
          bannerPositionY: data.productDetailHeroBannerPositionY || 'center',
          bannerOpacity: parseFloat(data.productDetailHeroBannerOpacity) || 100
        });
      }
      if (data.categoryFiltersConfig) {
        try {
          const parsed = typeof data.categoryFiltersConfig === 'string'
            ? JSON.parse(data.categoryFiltersConfig)
            : data.categoryFiltersConfig;
          setCategoryFilterSettings(cloneCategoryConfig(parsed));
        } catch (err) {
          console.error('Error parsing categoryFiltersConfig:', err);
          setCategoryFilterSettings(cloneCategoryConfig(null));
        }
      }
      if (data.productCardConfig) {
        try {
          const parsed = typeof data.productCardConfig === 'string'
            ? JSON.parse(data.productCardConfig)
            : data.productCardConfig;
          setProductCardSettings(cloneProductCardConfig(parsed));
        } catch (err) {
          console.error('Error parsing productCardConfig:', err);
          setProductCardSettings(cloneProductCardConfig(null));
        }
      }
    };

    const fetchSettings = async () => {
      const cacheKey = 'settings_cache_v1';
      const cached = localStorage.getItem(cacheKey);
      const now = new Date().getTime();
      const parsedCache = cached ? JSON.parse(cached) : null;
      const hasCached = !!parsedCache?.data;
      const isCacheFresh = hasCached && (now - parsedCache.timestamp < 10 * 60 * 1000);

      if (hasCached) {
        applySettings(parsedCache.data);
      }

      if (isCacheFresh) {
        return;
      }

      try {
        // Use public endpoint (no auth required) for frontend settings
        const response = await apiFetch(apiUrl('/settings/public'));
        if (response.ok) {
          const data = await response.json();
          applySettings(data);
          localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: new Date().getTime(),
            data
          }));
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };

    fetchSettings();
  }, []);

  // Efecto para aplicar tema de colores
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', themeSettings.primaryColor);
    root.style.setProperty('--secondary-color', themeSettings.secondaryColor);
    root.style.setProperty('--accent-color', themeSettings.accentColor);
    root.style.setProperty('--background-color', themeSettings.backgroundColor);
    root.style.setProperty('--text-color', themeSettings.textColor);
    
    // Generar hover automáticamente (un poco más oscuro)
    const darkenColor = (hex, div = 1.2) => {
        try {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgb(${Math.floor(r/div)}, ${Math.floor(g/div)}, ${Math.floor(b/div)})`;
        } catch { return hex; }
    };
    root.style.setProperty('--primary-hover', darkenColor(themeSettings.primaryColor));
  }, [themeSettings]);

  // Manage cart synchronization
  useEffect(() => {
    if (user) {
      // Initialize CSRF token on app load for mobile compatibility
      initializeCsrfToken();
      // Don't fetch cart from server if there's a pending payment in progress
      // (the order was created but payment not yet confirmed)
      const hasPendingPayment = localStorage.getItem('pending_stripe_payment') || 
                                 localStorage.getItem('pending_paypal_payment');
      if (!hasPendingPayment) {
        fetchCart();
      }
    }
  }, [user, fetchCart]);

  // Persistent cart storage (for refresh resilience)
  // Skip persistence if there's a pending payment to avoid overwriting saved cart items
  useEffect(() => {
    const hasPendingPayment = localStorage.getItem('pending_stripe_payment') || 
                               localStorage.getItem('pending_paypal_payment');
    // Only persist if no pending payment OR if cart has items
    if (!hasPendingPayment || cartItems.length > 0) {
      localStorage.setItem('cart_persistence', JSON.stringify(cartItems));
    }
  }, [cartItems]);

  return (
    <>
      <Toaster position="top-right" />
      {isLoggingOut && (
        <LoadingSpinner 
          fullPage={true} 
          size="large" 
          message="Cerrando sesión..." 
          color="#ef4444"
        />
      )}
      <div className={`app-container ${headerSettings.transparency < 100 ? 'has-transparent-header' : ''}`}>
        <Header
          siteName={siteName}
          siteIcon={siteIcon}
          siteLogo={siteLogo}
          siteLogoSize={siteLogoSize}
          siteNameImage={siteNameImage}
          siteNameImageSize={siteNameImageSize}
          headerSettings={headerSettings}
          cartItems={cartItems}
          user={user}
          onCartOpen={() => navigate('/cart')}
          onProfileOpen={() => navigate('/profile')}
          onOrdersOpen={() => navigate('/orders')}
          onLogout={handleLogout}
          onAdminNav={handleAdminNav}
        />

      <Suspense fallback={<div className="suspense-loading"><LoadingSpinner /></div>}>
        <Routes>
          <Route path="/" element={
            <Home 
              products={products} 
              loading={loading} 
              error={error} 
              addToCart={addToCart} 
              fetchProducts={fetchProducts}
              pagination={pagination}
              heroSettings={heroSettings}
              categoryFilterSettings={categoryFilterSettings}
              productCardSettings={productCardSettings}
            />
          } />
          <Route path="/cart" element={
            <Cart
              cartItems={cartItems}
              isLoading={isCartLoading}
              onAdd={addToCart}
              onRemove={removeFromCart}
              onClear={clearFromCart}
              onClose={() => navigate('/')}
              onClearAll={clearAllCart}
              currencyCode={productCardSettings.currency}
              user={user}
              onLogout={handleLogout}
              onOpenProfile={() => navigate('/profile')}
              onOpenOrders={() => navigate('/orders')}
              siteName={siteName}
              siteIcon={siteIcon}
              headerSettings={headerSettings}
            />
          } />
          <Route path="/checkout" element={
            <Checkout
              cartItems={cartItems}
              total={cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)}
              onClose={() => navigate('/cart')}
              onClearCart={clearAllCart}
              onOrderComplete={handleOrderCompleted}
              onLoginSuccess={handleCheckoutLoginSuccess}
              currencyCode={productCardSettings.currency}
              user={user}
              onLogout={handleLogout}
              onOpenProfile={() => navigate('/profile')}
              onOpenOrders={() => navigate('/orders')}
              siteName={siteName}
              siteIcon={siteIcon}
              headerSettings={headerSettings}
            />
          } />
          <Route path="/profile" element={
            <UserProfile 
              onClose={() => navigate(-1)} 
              onLogout={() => {
                handleLogout();
              }}
              onUpdate={(updatedUser) => setUser(updatedUser)}
              user={user}
              cartItems={cartItems}
              onOpenOrders={() => navigate('/orders')}
              onOpenCart={() => navigate('/cart')}
              siteName={siteName}
              siteIcon={siteIcon}
              headerSettings={headerSettings}
            />
          } />
          <Route path="/orders" element={
            <OrderTracker 
              user={user}
              currencyCode={productCardSettings.currency}
              siteName={siteName}
              siteIcon={siteIcon}
            />
          } />
          <Route path="/product/:id" element={
            <ProductDetail 
              products={products} 
              addToCart={addToCart} 
              user={user}
              onRefresh={fetchProducts}
              heroImage={productDetailHeroSettings.useHomeHero ? heroSettings.image : productDetailHeroImage}
              heroSettings={productDetailHeroSettings.useHomeHero ? heroSettings : {
                ...productDetailHeroSettings,
                image: productDetailHeroImage,
                height: productDetailHeroSettings.height,
                overlayOpacity: productDetailHeroSettings.overlayOpacity
              }}
              currencyCode={productCardSettings.currency}
              productCardSettings={productCardSettings}
              onCartOpen={() => navigate('/cart')}
            />
          } />
          <Route path="/contacto" element={
            <Contact user={user} />
          } />
          <Route path="/login" element={
            !user ? (
              <LoginPage 
                onLoginSuccess={handleLoginSuccess} 
                onBackToHome={() => navigate('/')}
              />
            ) : (
              <Navigate to="/" />
            )
          } />
          <Route path="/admin" element={
            user && user.role === 'admin' ? (
              <main className="admin-wrapper">
                <div className="container">
                  <AdminDashboard
                    products={products}
                    onRefresh={fetchProducts}
                    isLoading={loading}
                    pagination={pagination}
                    currencyCode={productCardSettings.currency}
                    siteName={siteName}
                    siteIcon={siteIcon}
                  />
                </div>
              </main>
            ) : (
              <Navigate to={user ? "/" : "/login"} />
            )
          } />
          <Route path="/settings" element={
            user && user.role === 'admin' ? (
              <main className="admin-wrapper">
                <div className="container">
                  <SettingsManager />
                </div>
              </main>
            ) : (
              <Navigate to={user ? "/" : "/login"} />
            )
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>

      <Footer />
    </div>
    </>
  );
}

export default App;
