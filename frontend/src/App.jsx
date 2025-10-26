import { useState, useEffect, useCallback, useRef } from 'react'
import Cart from './components/Cart';
import './App.css';
import './styles/LoginPage.css';
import LoginPage from './components/LoginPage';
import { getCurrentUser, isLoggedIn, logout } from './services/authService';
import AdminDashboard from './components/AdminDashboard';
import OrderTrackerModal from './components/OrderTrackerModal';

import { API_URL, BASE_URL } from './config';

function App() {
  // Estados
  const [cartItems, setCartItems] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(getCurrentUser());
  const [showLogin, setShowLogin] = useState(false);
  const [activePage, setActivePage] = useState('home');
  const [selectedCategory, setSelectedCategory] = useState('todos');

  // Ref para el scroll de categorías
  const categoriesScrollRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  // Categorías
  const categories = [
    { id: 0, name: 'Todos', icon: '🏪', slug: 'todos' },
    { id: 1, name: 'Smartphones', icon: '📱', slug: 'Smartphones' },
    { id: 2, name: 'Luces LED', icon: '🔅', slug: 'Luces LED' },
    { id: 3, name: 'Casa Inteligente', icon: '🏠', slug: 'Casa Inteligente' },
    { id: 4, name: 'Auriculares', icon: '🎧', slug: 'Auriculares' },
    { id: 5, name: 'Accesorios', icon: '🔌', slug: 'Accesorios' },
    { id: 6, name: 'Estilo de Vida', icon: '✨', slug: 'Estilo de Vida' },
  ];

  // Funciones de manejo de autenticación (DECLARADAS ANTES DE SU USO)
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setShowLogin(false);
    // Solo ir al panel de admin si el usuario es admin
    if (userData.role === 'admin') {
      setActivePage('admin');
    } else {
      setActivePage('home');
    }
  };


  
  const handleLogout = () => {
    logout();
    setUser(null);
    setCartItems([]);
    setActivePage('home');
  };

  const handleNavigate = (event, pageKey) => {
    event.preventDefault();
    setActivePage(pageKey);
  };

  const handleAdminNav = (event) => {
    event.preventDefault();
    if (!user) {
      setShowLogin(true);
      return;
    }
    setActivePage('admin');
  };

  const handleBackToHome = () => {
    setShowLogin(false);
  };

  // Funciones de carrito
  const addToCart = (product) => {
    setCartItems(prev => {
      const exist = prev.find(item => item.id === product.id);
      if (exist) {
        if (exist.quantity < product.stock) {
          return prev.map(item =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        } else {
          alert("No hay más stock disponible.");
          return prev;
        }
      } else {
        return [...prev, { ...product, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (product) => {
    setCartItems(prev =>
      prev.map(item =>
        item.id === product.id && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
    );
  };

  const clearFromCart = (product) => {
    setCartItems(prev => prev.filter(item => item.id !== product.id));
  };

  const clearAllCart = () => {
    setCartItems([]);
  };

  // Función para cambiar de categoría
  const handleCategoryChange = (categorySlug) => {
    console.log('Cambiando a categoría:', categorySlug);
    setSelectedCategory(categorySlug);
    fetchProducts(categorySlug);
  };

  // Funciones para drag con mouse en categorías
  const handleMouseDown = (e) => {
    isDragging.current = true;
    startX.current = e.pageX - categoriesScrollRef.current.offsetLeft;
    scrollLeft.current = categoriesScrollRef.current.scrollLeft;
    categoriesScrollRef.current.style.cursor = 'grabbing';
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    if (categoriesScrollRef.current) {
      categoriesScrollRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (categoriesScrollRef.current) {
      categoriesScrollRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const x = e.pageX - categoriesScrollRef.current.offsetLeft;
    const walk = (x - startX.current) * 2; // Multiplicador para velocidad de scroll
    categoriesScrollRef.current.scrollLeft = scrollLeft.current - walk;
  };

  // Effects
  const fetchProducts = useCallback(async (category = 'todos') => {
    try {
      setLoading(true);
      setError(null);
      const url = category === 'todos' 
        ? `${API_URL}/products`
        : `${API_URL}/products?category=${category}`;
      
      console.log('Fetching products from:', url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Productos recibidos:', data);
      setProducts(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('No se pudieron cargar los productos. Por favor, inténtalo de nuevo más tarde.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts('todos');
  }, [fetchProducts]);

  // Cargar carrito guardado si el usuario está logueado
  useEffect(() => {
    if (isLoggedIn()) {
      const savedCart = JSON.parse(localStorage.getItem(`cart_${user?.id}`)) || [];
      setCartItems(savedCart);
    }
  }, [user]);

  // Guardar carrito en localStorage solo si está logueado
  useEffect(() => {
    if (user) {
      localStorage.setItem(`cart_${user.id}`, JSON.stringify(cartItems));
    }
  }, [cartItems, user]);

  // Si está en la página de login
  if (showLogin) {
    return (
      <LoginPage 
        onLoginSuccess={handleLoginSuccess} 
        onBackToHome={handleBackToHome}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Header/Navbar */}
      <header className="header">
        <div className="container header-container">
          <div className="logo-container">
            <div className="logo">🛍️</div>
            <h1 className="site-title">TechStore</h1>
          </div>
          
          <nav className="main-nav">
            <a href="#" className="nav-link" onClick={(event) => handleNavigate(event, 'home')}>Inicio</a>
            <a href="#" className="nav-link" onClick={(event) => handleNavigate(event, 'home')}>Productos</a>
            <a href="#" className="nav-link" onClick={(event) => handleNavigate(event, 'home')}>Ofertas</a>
            <a href="#" className="nav-link" onClick={(event) => handleNavigate(event, 'home')}>Soporte</a>
            <a href="#" className="nav-link" onClick={(event) => handleNavigate(event, 'home')}>Contacto</a>
            <a href="#" className="nav-link" onClick={() => setOrdersOpen(true)}>Ordenes</a>
            {user && user.role === 'admin' && (
              <a href="#" className="nav-link" onClick={handleAdminNav}>Administrar</a>
            )}
          </nav>

          <div className="header-actions">
            <div className="cart-container">
              <button className="cart-button" onClick={() => setCartOpen(true)}>
                🛒
                <span className="cart-badge">
                  {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </button>
            </div>

            {user ? (
              <>
                <span className="user-name">Hola, {user.name}</span>
                <button className="login-button" onClick={handleLogout}>Cerrar Sesión</button>
              </>
            ) : (
              <button className="login-button" onClick={() => setShowLogin(true)}>Iniciar Sesión</button>
            )}
          </div>
        </div>
      </header>

      {activePage === 'admin' && user && user.role === 'admin' ? (
        <main className="admin-wrapper">
          <div className="container">
            <AdminDashboard products={products} onRefresh={fetchProducts} isLoading={loading} />
          </div>
        </main>
      ) : (
        <>
          {/* Hero Section */}
          <section className="hero-section">
            <div className="container hero-container">
              <div className="hero-content">
                <h2 className="hero-title">La Mejor Tecnología a Tu Alcance</h2>
                <p className="hero-text">Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado.</p>
                <div className="hero-buttons">
                  <button className="primary-button">Ver Productos</button>
                  <button className="secondary-button">Ofertas Especiales</button>
                </div>
              </div>
              <div className="hero-image">
                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRXi8CxRsxpFK4ixXoVOJJQXZSo0jgKFmvayA&s" alt="Smartphones y accesorios" />
              </div>
            </div>
          </section>
          
          {/* Categories */}
          <section className="categories-section">
            <div className="container">
              <h2 className="section-title">Explora Nuestras Categorías</h2>
              <div className="categories-scroll-container">
                <div 
                  className="categories-grid-scroll"
                  ref={categoriesScrollRef}
                  onMouseDown={handleMouseDown}
                  onMouseLeave={handleMouseLeave}
                  onMouseUp={handleMouseUp}
                  onMouseMove={handleMouseMove}
                >
                  {categories.map(category => (
                    <button
                      key={category.id}
                      className={`category-card ${selectedCategory === category.slug ? 'active' : ''}`}
                      onClick={() => handleCategoryChange(category.slug)}
                    >
                      <div className="category-icon">{category.icon}</div>
                      <h3 className="category-title">{category.name}</h3>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
          
          {/* Featured Products */}
          <section className="products-section">
            <div className="container">
              <h2 className="section-title">Productos Destacados</h2>
              
              {loading && <div className="loading-message">Cargando productos...</div>}
              
              {error && <div className="error-message">{error}</div>}
              
              {!loading && !error && (
                <div className="products-grid">
                  {products.length > 0 ? (
                    products.map(product => (
                      <div key={product.id} className="product-card">
                        <img
                          src={product.image ? `${BASE_URL}${product.image}`: '/images/sin imagen.jpeg'}
                          alt={product.name}
                          className="product-image"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRXi8CxRsxpFK4ixXoVOJJQXZSo0jgKFmvayA&s';
                          }}
                        />
                        <div className="product-content">
                          <span className="product-category">{product.category}</span>
                          <h3 className="product-title">{product.name}</h3>
                          <p className="product-description">{product.description}</p>
                          <div className="product-footer">
                            <span className="product-price">${product.price}</span>
                            <button
                              onClick={() => addToCart(product)}
                              className="add-to-cart-button"
                            >
                              Agregar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-products-message">No hay productos disponibles.</div>
                  )}
                </div>
              )}
            </div>
          </section>
          
          {/* Promo Section */}
          <section className="promo-section">
            <div className="container promo-container">
              <div className="promo-content">
                <h2 className="promo-title">¡Oferta Especial del Mes!</h2>
                <p className="promo-text">
                  Obtén un 20% de descuento en todos nuestros smartphones cuando compras cualquier accesorio.
                </p>
                <button className="promo-button">Ver Oferta</button>
              </div>
              <div className="promo-image">
                <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRXi8CxRsxpFK4ixXoVOJJQXZSo0jgKFmvayA&s" alt="Promoción especial" />
              </div>
            </div>
          </section>
          
          {/* Features */}
          <section className="features-section">
            <div className="container">
              <h2 className="section-title">¿Por Qué Elegirnos?</h2>
              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon">🚚</div>
                  <h3 className="feature-title">Envío Gratis</h3>
                  <p className="feature-text">En todos tus pedidos superiores a $50</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">⚡</div>
                  <h3 className="feature-title">Garantía Extendida</h3>
                  <p className="feature-text">12 meses adicionales en todos nuestros productos</p>
                </div>
                <div className="feature-card">
                  <div className="feature-icon">🔒</div>
                  <h3 className="feature-title">Pago Seguro</h3>
                  <p className="feature-text">Todas las transacciones son 100% seguras</p>
                </div>
              </div>
            </div>
          </section>
          
          {/* Newsletter */}
          <section className="newsletter-section">
            <div className="container">
              <h2 className="newsletter-title">Únete a Nuestra Newsletter</h2>
              <p className="newsletter-text">
                Recibe las últimas noticias sobre tecnología y ofertas exclusivas directamente en tu correo.
              </p>
              <div className="newsletter-form">
                <input
                  type="email"
                  placeholder="Tu correo electrónico"
                  className="newsletter-input"
                />
                <button className="newsletter-button">Suscribirse</button>
              </div>
            </div>
          </section>
          
          {/* Footer */}
          <footer className="footer">
            <div className="container">
              <div className="footer-grid">
                <div className="footer-column">
                  <h3 className="footer-title">TechStore</h3>
                  <p className="footer-text">
                    Tu tienda de confianza para todos los dispositivos electrónicos y accesorios.
                  </p>
                </div>
                <div className="footer-column">
                  <h4 className="footer-subtitle">Enlaces Rápidos</h4>
                  <ul className="footer-links">
                    <li><a href="#" className="footer-link">Inicio</a></li>
                    <li><a href="#" className="footer-link">Productos</a></li>
                    <li><a href="#" className="footer-link">Ofertas</a></li>
                    <li><a href="#" className="footer-link">Sobre Nosotros</a></li>
                  </ul>
                </div>
                <div className="footer-column">
                  <h4 className="footer-subtitle">Atención al Cliente</h4>
                  <ul className="footer-links">
                    <li><a href="#" className="footer-link">Contáctanos</a></li>
                    <li><a href="#" className="footer-link">Devoluciones</a></li>
                    <li><a href="#" className="footer-link">Preguntas Frecuentes</a></li>
                    <li><a href="#" className="footer-link">Estado del Pedido</a></li>
                  </ul>
                </div>
                <div className="footer-column">
                  <h4 className="footer-subtitle">Síguenos</h4>
                  <div className="social-links">
                    <a href="#" className="social-link">📘</a>
                    <a href="#" className="social-link">📱</a>
                    <a href="#" className="social-link">📷</a>
                    <a href="#" className="social-link">🐦</a>
                  </div>
                </div>
              </div>
              <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} TechStore. Todos los derechos reservados.</p>
              </div>
            </div>
          </footer>
        </>
      )}

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
    </div>
  );
}

export default App;