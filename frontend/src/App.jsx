import { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import './App.css';
import './styles/LoginPage.css';
import { getCurrentUser, isLoggedIn, logout } from './services/authService';

import { API_URL } from './config';
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

  // Otros estados
  const [cartItems, setCartItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(getCurrentUser());

  const navigate = useNavigate();

  // Funciones de manejo de autenticación (DECLARADAS ANTES DE SU USO)


  const handleLogout = async () => {
    setIsLoggingOut(true);
    // Simular un pequeño delay para que se vea el spinner
    await new Promise(resolve => setTimeout(resolve, 800));
    logout();
    setUser(null);
    setCartItems([]);
    setIsLoggingOut(false);
    toast.success("Sesión cerrada correctamente");
    navigate('/');
  };

  const handleAdminNav = (event) => {
    event.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    navigate('/admin');
  };

  const handleLoginSuccess = async (userData) => {
    // Sync guest cart if exists
    if (cartItems.length > 0) {
      await syncLocalCart(cartItems);
      localStorage.removeItem('guest_cart');
    }
    
    setUser(userData);
    // Solo ir al panel de admin si el usuario es admin
    if (userData.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/');
    }
  };

  // Funciones de carrito
  const addToCart = async (product) => {
    if (user) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/cart`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ productId: product.id, quantity: 1 })
        });
        
        if (response.ok) {
          const data = await response.json();
          setCartItems(formatBackendCart(data));
          toast.success("Producto agregado al carrito");
        } else {
          const errorData = await response.json();
          toast.error(errorData.message || "Error al agregar al carrito");
        }
      } catch (err) {
        console.error(err);
        toast.error("Error de conexión");
      }
    } else {
      const exist = cartItems.find(item => item.id === product.id);
      if (exist) {
        if (exist.quantity < product.stock) {
          toast.success("Cantidad actualizada");
          setCartItems(prev => prev.map(item =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ));
        } else {
          toast.error("No hay más stock disponible.");
        }
      } else {
        const image = product.images && product.images.length > 0 ? product.images[0].image_path : product.image;
        toast.success("Producto agregado al carrito");
        setCartItems(prev => [...prev, { ...product, image, quantity: 1 }]);
      }
    }
  };

  const removeFromCart = async (product) => {
    if (user) {
      if (product.quantity > 1) {
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch(`${API_URL}/cart/${product.id}`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ quantity: product.quantity - 1 })
          });
          if (response.ok) {
            const data = await response.json();
            setCartItems(formatBackendCart(data));
          }
        } catch (e) { console.error(e); }
      }
    } else {
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
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/cart/${product.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setCartItems(formatBackendCart(data));
        }
      } catch (e) { console.error(e); }
    } else {
      setCartItems(prev => prev.filter(item => item.id !== product.id));
    }
  };

  const clearAllCart = async () => {
    if (user) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${API_URL}/cart`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          setCartItems([]);
        }
      } catch (e) { console.error(e); }
    } else {
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

  // Fetch cart from backend
  const fetchCart = useCallback(async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/cart`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCartItems(formatBackendCart(data));
      }
    } catch (err) {
      console.error('Error fetching cart:', err);
    }
  }, [user]);

  // Sync local cart to backend
  const syncLocalCart = async (localCart) => {
    if (!user || localCart.length === 0) return;
    const token = localStorage.getItem('authToken');
    
    const promises = localCart.map(item => 
      fetch(`${API_URL}/cart`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ productId: item.id, quantity: item.quantity })
      })
    );

    try {
      await Promise.all(promises);
    } catch (err) {
      console.error('Error syncing cart:', err);
    }
  };

  // Effects
  const fetchProducts = useCallback(async (category = 'todos', page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams({
          page: page.toString(),
          limit: '20'
      });
      
      if (category !== 'todos') {
          queryParams.append('category', category);
      }

      const cacheKey = `products_cache_${category}_${page}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
          const parsedCache = JSON.parse(cachedData);
          // Check if cache is valid (e.g., less than 5 minutes old)
          const now = new Date().getTime();
          if (now - parsedCache.timestamp < 10 * 60 * 1000) {
              console.log('Using cached products');
              setProducts(parsedCache.data);
              setPagination(parsedCache.pagination);
              setLoading(false);
              // Optional: Continue to fetch in background to revalidate
          }
      }

      const url = `${API_URL}/products?${queryParams}`;
      
      console.log('Fetching products from:', url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const result = await response.json();
      console.log('Productos recibidos:', result.data ? result.data.length : 0);
      
      if (result.data) {
          setProducts(result.data);
          setPagination({
              page: result.page,
              limit: result.limit,
              total: result.total,
              totalPages: result.totalPages
          });
          
          // Update cache
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
          // Fallback for legacy response or error
          setProducts(Array.isArray(result) ? result : []);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching products:', err);
      // If fetch fails but we have cache, we might want to keep showing it
      // But here we just show error if no cache was loaded
      if (!localStorage.getItem(`products_cache_${category}_${page}`)) {
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
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${API_URL}/settings`);
        if (response.ok) {
          const data = await response.json();
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
    } else {
      const savedCart = JSON.parse(localStorage.getItem('guest_cart')) || [];
      setCartItems(savedCart);
    }
  }, [user, fetchCart]);

  // Save guest cart to localStorage
  useEffect(() => {
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
            />
          } />
          <Route path="/cart" element={
            <Cart
              cartItems={cartItems}
              onAdd={addToCart}
              onRemove={removeFromCart}
              onClear={clearFromCart}
              onClose={() => navigate(-1)}
              onClearAll={clearAllCart}
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
              onCartOpen={() => navigate('/cart')}
            />
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
                  <AdminDashboard products={products} onRefresh={fetchProducts} isLoading={loading} pagination={pagination} />
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