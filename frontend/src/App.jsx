import { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import './App.css';
import './styles/LoginPage.css';
import { getCurrentUser, isLoggedIn, logout } from './services/authService';

import { API_URL, DEFAULT_CATEGORY_FILTERS_CONFIG, DEFAULT_PRODUCT_CARD_CONFIG } from './config';
import { apiFetch, apiUrl } from './services/apiClient';
import { Toaster, toast } from 'react-hot-toast';
import LoadingSpinner from './components/LoadingSpinner';
import Header from './components/Header';

// Lazy loading components
const Cart = lazy(() => import('./components/Cart'));
const Checkout = lazy(() => import('./components/Checkout'));
const LoginPage = lazy(() => import('./components/LoginPage'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const OrderTrackerModal = lazy(() => import('./components/OrderTrackerModal'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const ProductDetail = lazy(() => import('./components/ProductDetail'));
const Home = lazy(() => import('./pages/Home'));
const Contact = lazy(() => import('./pages/Contact'));
const SettingsManager = lazy(() => import('./components/SettingsManager'));
const Footer = lazy(() => import('./components/Footer'));

function App() {
  // Estados de configuración del sitio
  const [siteName, setSiteName] = useState('TechStore');
  const [siteIcon, setSiteIcon] = useState('🛍️');
  const [heroSettings, setHeroSettings] = useState({
    title: 'La Mejor Tecnología a Tu Alcance',
    description: 'Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado.',
    primaryBtn: 'Ver Productos',
    secondaryBtn: 'Ofertas Especiales',
    image: ''
  });
  const [headerSettings, setHeaderSettings] = useState({
    bgColor: '#2563eb',
    transparency: 100
  });
  const [themeSettings, setThemeSettings] = useState({
    primaryColor: '#2563eb',
    secondaryColor: '#7c3aed',
    accentColor: '#f59e0b',
    backgroundColor: '#f8fafc',
    textColor: '#1e293b'
  });
  const [productDetailHeroImage, setProductDetailHeroImage] = useState('');
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
      if (saved) return JSON.parse(saved);
      // Fallback a guest_cart por compatibilidad
      const legacy = localStorage.getItem('guest_cart');
      return legacy ? JSON.parse(legacy) : [];
    } catch (e) {
      return [];
    }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [isCartLoading, setIsCartLoading] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(getCurrentUser());

  const navigate = useNavigate();

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
      localStorage.removeItem('guest_cart');
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

  // Cargar ajustes del sitio
  useEffect(() => {
    const applySettings = (data) => {
      const cloneCategoryConfig = (value) => {
        const base = JSON.parse(JSON.stringify(DEFAULT_CATEGORY_FILTERS_CONFIG));
        if (!value || typeof value !== 'object') return base;
        const merged = {
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
        return merged;
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

      if (data.siteName) {
        setSiteName(data.siteName);
        localStorage.setItem('siteName', data.siteName);
      }
      if (data.siteIcon) {
        setSiteIcon(data.siteIcon);
        localStorage.setItem('siteIcon', data.siteIcon);
      }
      if (data.heroTitle || data.heroDescription || data.heroPrimaryBtn || data.heroSecondaryBtn || data.heroImage) {
        setHeroSettings({
          title: data.heroTitle || 'La Mejor Tecnología a Tu Alcance',
          description: data.heroDescription || 'Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado.',
          primaryBtn: data.heroPrimaryBtn || 'Ver Productos',
          secondaryBtn: data.heroSecondaryBtn || 'Ofertas Especiales',
          image: data.heroImage || ''
        });
      }
      if (data.headerBgColor || data.headerTransparency) {
        setHeaderSettings({
          bgColor: data.headerBgColor || '#2563eb',
          transparency: parseInt(data.headerTransparency) || 100
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
      if (data.productDetailHeroImage) {
        setProductDetailHeroImage(data.productDetailHeroImage);
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
        const response = await apiFetch(apiUrl('/settings'));
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
        } catch(e) { return hex; }
    };
    root.style.setProperty('--primary-hover', darkenColor(themeSettings.primaryColor));
  }, [themeSettings]);

  // Manage cart synchronization
  useEffect(() => {
    if (user) {
      fetchCart();
    }
  }, [user, fetchCart]);

  // Persistent cart storage (for refresh resilience)
  useEffect(() => {
    localStorage.setItem('cart_persistence', JSON.stringify(cartItems));
    // Mantener sincronizado guest_cart para compatibilidad
    if (!user) {
      localStorage.setItem('guest_cart', JSON.stringify(cartItems));
    }
  }, [cartItems, user]);

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
        {/* Header/Navbar */}
        <Header
          siteName={siteName}
          siteIcon={siteIcon}
          headerSettings={headerSettings}
          cartItems={cartItems}
          user={user}
          onCartOpen={() => navigate('/cart')}
          onProfileOpen={() => navigate('/profile')}
          onOrdersOpen={() => navigate('/orders')}
          onLogout={handleLogout}
          onAdminNav={handleAdminNav}
        />

      <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}><LoadingSpinner /></div>}>
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
            <OrderTrackerModal 
              onClose={() => navigate(-1)} 
              user={user}
              currencyCode={productCardSettings.currency}
              cartItems={cartItems}
              onLogout={handleLogout}
              onOpenProfile={() => navigate('/profile')}
              onOpenCart={() => navigate('/cart')}
              siteName={siteName}
              siteIcon={siteIcon}
              headerSettings={headerSettings}
            />
          } />
          <Route path="/product/:id" element={
            <ProductDetail 
              products={products} 
              addToCart={addToCart} 
              user={user}
              onRefresh={fetchProducts}
              heroImage={productDetailHeroImage}
              currencyCode={productCardSettings.currency}
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

      {loading && <LoadingSpinner />}
    </div>
    </>
  );
}

export default App;