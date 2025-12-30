import { useState, useEffect, useCallback, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import './App.css';
import './styles/LoginPage.css';
import { getCurrentUser, isLoggedIn, logout } from './services/authService';

import { API_URL } from './config';
import { Toaster, toast } from 'react-hot-toast';
import LoadingSpinner from './components/LoadingSpinner';

// Lazy loading components
const Cart = lazy(() => import('./components/Cart'));
const LoginPage = lazy(() => import('./components/LoginPage'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const OrderTrackerModal = lazy(() => import('./components/OrderTrackerModal'));
const UserProfile = lazy(() => import('./components/UserProfile'));
const Home = lazy(() => import('./pages/Home'));

function App() {
  // Estados
  const [cartItems, setCartItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(getCurrentUser());

  const navigate = useNavigate();

  // Funciones de manejo de autenticación (DECLARADAS ANTES DE SU USO)


  const handleLogout = () => {
    logout();
    setUser(null);
    setCartItems([]);
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

  const closeMobileMenu = () => setMobileMenuOpen(false);

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
          if (now - parsedCache.timestamp < 5 * 60 * 1000) {
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
      <div className="app-container">
        {/* Header/Navbar */}
      <header className="header">
        <div className="container header-container">
          <button 
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            ☰
          </button>

          <Link to="/" className="logo-container" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="logo">🛍️</div>
            <h1 className="site-title">TechStore</h1>
          </Link>
          
          <nav className="main-nav">
            <Link to="/" className="nav-link">Productos</Link>
            <Link to="/" className="nav-link">Contacto</Link>
            <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); setOrdersOpen(true); }}>Ordenes</a>
            {user && user.role === 'admin' && (
              <a href="#" className="nav-link" onClick={handleAdminNav}>Administrar</a>
            )}
          </nav>

          <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'open' : ''}`} onClick={closeMobileMenu}></div>
          <nav className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`}>
            <button className="close-mobile-nav" onClick={closeMobileMenu}>×</button>
            <Link to="/" className="mobile-nav-link" onClick={closeMobileMenu}>Productos</Link>
            <Link to="/" className="mobile-nav-link" onClick={closeMobileMenu}>Contacto</Link>
            <a href="#" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); setOrdersOpen(true); closeMobileMenu(); }}>Ordenes</a>
            {user && user.role === 'admin' && (
              <a href="#" className="mobile-nav-link" onClick={(e) => { handleAdminNav(e); closeMobileMenu(); }}>Administrar</a>
            )}
          </nav>

          <div className="header-actions">
            <div className="cart-container">
              <button className="cart-button" onClick={() => setCartOpen(true)}>
                🛒
                <span 
                  className="cart-badge"
                  style={{ 
                    color: cartItems.reduce((sum, item) => sum + item.quantity, 0) > 0 ? 'red' : 'white',
                    backgroundColor: 'transparent',
                    fontSize: '1.3rem',
                    //fontWeight: 'bold'
                  }}
                >
                  {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </button>
            </div>

            {user ? (
              <>
                <button 
                  className="user-name-btn" 
                  onClick={() => setProfileOpen(true)}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', marginRight: '10px' }}
                >
                  Hola, {user?.name ? (user.name.includes('@') ? user.name.split('@')[0] : user.name.split(' ')[0]) : 'Usuario'}
                </button>
                <button className="login-button" onClick={handleLogout}>Cerrar</button>
              </>
            ) : (
              <button className="login-button" onClick={() => navigate('/login')}>Iniciar Sesión</button>
            )}
          </div>
        </div>
      </header>

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
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        {/* Cart Modal */}
        {cartOpen && (
          <Cart
            cartItems={cartItems}
            onAdd={addToCart}
            onRemove={removeFromCart}
            onClear={clearFromCart}
            onClose={() => setCartOpen(false)}
            onClearAll={clearAllCart}
          />
        )}

        {/* Order Tracker Modal */}
        {ordersOpen && (
          <OrderTrackerModal onClose={() => setOrdersOpen(false)} user={user} />
        )}

        {/* User Profile Modal */}
        {profileOpen && (
          <UserProfile 
            onClose={() => setProfileOpen(false)} 
            onLogout={() => {
              setProfileOpen(false);
              handleLogout();
            }}
            onUpdate={(updatedUser) => setUser(updatedUser)}
          />
        )}
      </Suspense>

      {loading && <LoadingSpinner />}
    </div>
    </>
  );
}

export default App;