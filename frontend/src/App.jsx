import { Suspense, lazy, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import './components/auth/LoginPage.css';
import { getCurrentUser, logout, isSessionExpired } from './services/authService';
import { Toaster } from 'react-hot-toast';
import { API_URL } from './config';

// Common components
import LoadingSpinner from './components/common/LoadingSpinner';
import Header from './components/common/Header';

// Custom hooks - cada uno encapsula un dominio de lógica
import { useProducts } from './hooks/useProducts';
import { useCart } from './hooks/useCart';
import { useAuth } from './hooks/useAuth';
import { useSiteSettings } from './hooks/useSiteSettings';

// Rutas centralizadas
import AppRoutes from './routes/AppRoutes';

// Lazy loading - componentes globales
const Footer = lazy(() => import('./components/common/Footer'));
const ChatBot = lazy(() => import('./components/chatbot/ChatBot'));
const SetupWizard = lazy(() => import('./components/setup/SetupWizard'));

function App() {
  const navigate = useNavigate();

  // Setup mode: null = checking, true = needs setup, false = ready
  const [setupMode, setSetupMode] = useState(null);

  // Check backend health on mount to detect setup mode
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(r => r.json())
      .then(data => setSetupMode(data.status === 'setup'))
      .catch(() => setSetupMode(false)); // if backend unreachable, show normal app
  }, []);

  // Estado de usuario en App para romper dependencia circular entre useAuth y useCart
  const [user, setUser] = useState(() => {
    if (isSessionExpired()) {
      logout();
      return null;
    }
    return getCurrentUser();
  });

  // Hook de productos: estado, fetch con caché, stock
  const {
    products, pagination, loading, error,
    fetchProducts, updateProductStock, syncProductsFromCartData, handleOrderCompleted
  } = useProducts();

  // Hook de settings visuales: sitio, hero, header, tema, product detail, filtros, cards
  const {
    siteName, siteIcon, siteLogo, siteLogoSize,
    siteNameImage, siteNameImageSize,
    heroSettings, headerSettings,
    productDetailHeroImage, productDetailHeroSettings,
    categoryFilterSettings, productCardSettings,
    promoSettings
  } = useSiteSettings();

  // Hook de carrito: estado, CRUD, sync con backend, persistencia
  const {
    cartItems, isCartLoading,
    addToCart, removeFromCart, setCartQuantity, clearFromCart, clearAllCart,
    clearCartItems, syncLocalCart
  } = useCart({ user, updateProductStock, syncProductsFromCartData });

  // Hook de auth: login/logout handlers, sync cross-tab, expiración
  const {
    isLoggingOut,
    handleLogout, handleLoginSuccess, handleCheckoutLoginSuccess, handleAdminNav
  } = useAuth({ user, setUser, cartItems, syncLocalCart, clearCartItems });

  // ── Early returns AFTER all hooks (React Rules of Hooks) ──

  // Show spinner while checking backend health
  if (setupMode === null) {
    return <LoadingSpinner fullPage message="Verificando estado del servidor..." />;
  }

  // Show setup wizard when backend has no DB configured
  if (setupMode) {
    return (
      <Suspense fallback={<LoadingSpinner fullPage message="Cargando configuración..." />}>
        <SetupWizard onSetupComplete={() => window.location.reload()} />
      </Suspense>
    );
  }

  return (
    <>
      <Toaster position="top-right" />

      {/* Overlay de logout con spinner */}
      {isLoggingOut && (
        <LoadingSpinner 
          fullPage={true} 
          size="large" 
          message="Cerrando sesión..." 
          color="#ef4444"
        />
      )}

      <div className={`app-container ${headerSettings.transparency < 100 ? 'has-transparent-header' : ''}`}>
        {/* Header global */}
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

        {/* Rutas de la aplicación */}
        <AppRoutes
          products={products}
          loading={loading}
          error={error}
          fetchProducts={fetchProducts}
          pagination={pagination}
          cartItems={cartItems}
          isCartLoading={isCartLoading}
          addToCart={addToCart}
          removeFromCart={removeFromCart}
          setCartQuantity={setCartQuantity}
          clearFromCart={clearFromCart}
          clearAllCart={clearAllCart}
          handleOrderCompleted={handleOrderCompleted}
          user={user}
          setUser={setUser}
          handleLogout={handleLogout}
          handleLoginSuccess={handleLoginSuccess}
          handleCheckoutLoginSuccess={handleCheckoutLoginSuccess}
          heroSettings={heroSettings}
          categoryFilterSettings={categoryFilterSettings}
          productCardSettings={productCardSettings}
          promoSettings={promoSettings}
          productDetailHeroImage={productDetailHeroImage}
          productDetailHeroSettings={productDetailHeroSettings}
          siteName={siteName}
          siteIcon={siteIcon}
          headerSettings={headerSettings}
          navigate={navigate}
        />

        {/* Footer global */}
        <Footer />

        {/* Chatbot widget - se renderiza globalmente, gestiona su propia visibilidad */}
        <Suspense fallback={null}>
          <ChatBot />
        </Suspense>
      </div>
    </>
  );
}

export default App;
