import { Suspense, lazy, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import './App.css';
import './components/auth/LoginPage.css';
import { getCurrentUser, logout, isSessionExpired } from './services/authService';
import { Toaster } from 'react-hot-toast';
import { API_URL, IS_LANDING, IS_ONBOARDING, IS_SUPER_ADMIN, IS_TENANT, TENANT_SLUG, PLATFORM_DOMAIN, PLATFORM_PROTOCOL } from './config';

// SaaS system subdomains (landing, onboarding, admin) use their own layout — skip store shell
const IS_SAAS_PLATFORM_PAGE = (IS_LANDING && !IS_TENANT) || IS_ONBOARDING || IS_SUPER_ADMIN;

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
const ImpersonationBanner = lazy(() => import('./components/common/ImpersonationBanner'));

function App() {
  const navigate = useNavigate();

  // Setup mode: null = checking, true = needs setup, false = ready
  const [setupMode, setSetupMode] = useState(null);

  // Tenant validation for subdomain stores
  const [tenantValid, setTenantValid] = useState(null); // null=checking, true|false

  // Handle impersonation token from URL (?token=xxx)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token && !localStorage.getItem('authToken')) {
      localStorage.setItem('authToken', token);
      // Clean URL: remove ?token=xxx without full page reload
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, '', clean);
      // Mark as impersonating so useAuth can detect it
      sessionStorage.setItem('isImpersonating', 'true');
      // Log CSRF from cookie for the new token session
      import('./services/apiClient').then(m => m.refreshCsrfToken());
      // Reload to pick up the new auth state
      window.location.reload();
      return; // stop — we're reloading
    }
    // Clean up stale impersonation flag if token expired
    const storedToken = localStorage.getItem('authToken');
    if (storedToken && sessionStorage.getItem('isImpersonating')) {
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
          localStorage.removeItem('authToken');
          sessionStorage.removeItem('isImpersonating');
        }
      } catch { /* invalid token, ignore */ }
    }
  }, []);

  // Check backend health + tenant validity on mount
  useEffect(() => {
    fetch(`${API_URL}/health`)
      .then(r => r.json())
      .then(data => setSetupMode(data.status === 'setup'))
      .catch(() => setSetupMode(false));

    // If we're on a tenant subdomain, verify the tenant actually exists
    if (IS_TENANT && TENANT_SLUG) {
      fetch('/api/saas/tenant-exists')
        .then(r => r.json())
        .then(data => {
          if (!data.exists) {
            // Invalid tenant — redirect to landing page with toast
            const landingUrl = `${PLATFORM_PROTOCOL}//${PLATFORM_DOMAIN}/?toast=store-not-found&slug=${encodeURIComponent(TENANT_SLUG)}`;
            window.location.replace(landingUrl);
          } else {
            setTenantValid(true);
          }
        })
        .catch(() => setTenantValid(true)); // allow on network error
    } else {
      setTenantValid(true); // not a tenant subdomain, no check needed
    }
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
    fetchProducts, forceRefreshProducts, updateProductStock, syncProductsFromCartData, handleOrderCompleted
  } = useProducts();

  // Hook de settings visuales: sitio, hero, header, tema, product detail, filtros, cards
  const {
    siteName, siteIcon, siteLogo, siteLogoSize,
    siteNameImage, siteNameImageSize,
    heroSettings, headerSettings,
    productDetailHeroImage, productDetailHeroSettings,
    categoryFilterSettings, productCardSettings,
    promoSettings,
    landingPageConfig,
    navigationConfig,
    storeModuleConfig,
    searchBarConfig,
    whyChooseUsConfig,
    newsletterConfig,
    footerConfig
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

  // Show spinner while checking backend health OR tenant validity
  if (setupMode === null || tenantValid === null) {
    return <LoadingSpinner fullPage message="Verificando..." />;
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
      
      {/* Impersonation banner — appears when admin impersonates a tenant */}
      {!IS_SAAS_PLATFORM_PAGE && (
        <Suspense fallback={null}>
          <ImpersonationBanner />
        </Suspense>
      )}

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
        {/* Header global — oculto en páginas SaaS de plataforma (landing, onboarding, admin) */}
        {!IS_SAAS_PLATFORM_PAGE && (
          <Header
            siteName={siteName}
            siteIcon={siteIcon}
            siteLogo={siteLogo}
            siteLogoSize={siteLogoSize}
            siteNameImage={siteNameImage}
            siteNameImageSize={siteNameImageSize}
            headerSettings={headerSettings}
            navigationConfig={navigationConfig}
            storeModuleConfig={storeModuleConfig}
            cartItems={cartItems}
            user={user}
            onCartOpen={() => navigate('/cart')}
            onProfileOpen={() => navigate('/profile')}
            onOrdersOpen={() => navigate('/orders')}
            onLogout={handleLogout}
            onAdminNav={handleAdminNav}
          />
        )}

        {/* Rutas de la aplicación */}
        <AppRoutes
          products={products}
          loading={loading}
          error={error}
          fetchProducts={fetchProducts}
          forceRefreshProducts={forceRefreshProducts}
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
          landingPageConfig={landingPageConfig}
          navigationConfig={navigationConfig}
          storeModuleConfig={storeModuleConfig}
          searchBarConfig={searchBarConfig}
          whyChooseUsConfig={whyChooseUsConfig}
          newsletterConfig={newsletterConfig}
          navigate={navigate}
        />

        {/* Footer y ChatBot — solo en tienda, no en páginas SaaS de plataforma */}
        {!IS_SAAS_PLATFORM_PAGE && (
          <>
            <Footer siteName={siteName} footerConfig={footerConfig} />
            <Suspense fallback={null}>
              <ChatBot />
            </Suspense>
          </>
        )}
      </div>
    </>
  );
}

export default App;
