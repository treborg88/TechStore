import { Suspense, lazy, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';
import './components/auth/LoginPage.css';
import { getCurrentUser, logout, isSessionExpired } from './services/authService';
import { Toaster } from 'react-hot-toast';

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

function App() {
  const navigate = useNavigate();

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
    categoryFilterSettings, productCardSettings
  } = useSiteSettings();

  // Hook de carrito: estado, CRUD, sync con backend, persistencia
  const {
    cartItems, isCartLoading,
    addToCart, removeFromCart, clearFromCart, clearAllCart,
    clearCartItems, syncLocalCart
  } = useCart({ user, updateProductStock, syncProductsFromCartData });

  // Hook de auth: login/logout handlers, sync cross-tab, expiración
  const {
    isLoggingOut,
    handleLogout, handleLoginSuccess, handleCheckoutLoginSuccess, handleAdminNav
  } = useAuth({ user, setUser, cartItems, syncLocalCart, clearCartItems });

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
