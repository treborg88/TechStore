// AppRoutes.jsx - Definición centralizada de todas las rutas de la aplicación
import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import LoadingSpinner from '../components/common/LoadingSpinner';

// Lazy loading de componentes por feature
const Home = lazy(() => import('../pages/Home'));
const Cart = lazy(() => import('../components/cart/Cart'));
const Checkout = lazy(() => import('../components/cart/Checkout'));
const UserProfile = lazy(() => import('../components/auth/UserProfile'));
const OrderTracker = lazy(() => import('../pages/OrderTracker'));
const ProductDetail = lazy(() => import('../components/products/ProductDetail'));
const Contact = lazy(() => import('../pages/Contact'));
const LoginPage = lazy(() => import('../components/auth/LoginPage'));
const AdminDashboard = lazy(() => import('../components/admin/AdminDashboard'));
const SettingsManager = lazy(() => import('../components/admin/SettingsManager'));

/**
 * Componente de rutas de la aplicación.
 * Centraliza todas las definiciones de rutas con sus guards y props.
 */
function AppRoutes({
  // Productos
  products, loading, error, fetchProducts, pagination,
  // Carrito
  cartItems, isCartLoading, addToCart, removeFromCart, setCartQuantity, clearFromCart, clearAllCart, handleOrderCompleted,
  // Auth
  user, setUser, handleLogout, handleLoginSuccess, handleCheckoutLoginSuccess,
  // Settings visuales
  heroSettings, categoryFilterSettings, productCardSettings,
  productDetailHeroImage, productDetailHeroSettings,
  siteName, siteIcon, headerSettings,
  promoSettings,
  // Navegación
  navigate
}) {
  return (
    <Suspense fallback={<div className="suspense-loading"><LoadingSpinner /></div>}>
      <Routes>
        {/* Home */}
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
            promoSettings={promoSettings}
          />
        } />

        {/* Carrito */}
        <Route path="/cart" element={
          <Cart
            cartItems={cartItems}
            isLoading={isCartLoading}
            onAdd={addToCart}
            onRemove={removeFromCart}
            onSetQuantity={setCartQuantity}
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

        {/* Checkout */}
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

        {/* Perfil de usuario */}
        <Route path="/profile" element={
          <UserProfile 
            onClose={() => navigate(-1)} 
            onLogout={() => handleLogout()}
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

        {/* Seguimiento de pedidos */}
        <Route path="/orders" element={
          <OrderTracker 
            user={user}
            currencyCode={productCardSettings.currency}
            siteName={siteName}
            siteIcon={siteIcon}
          />
        } />

        {/* Detalle de producto */}
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

        {/* Contacto */}
        <Route path="/contacto" element={
          <Contact user={user} />
        } />

        {/* Login (redirige a home si ya está autenticado) */}
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

        {/* Admin dashboard (requiere rol admin) */}
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
                  categoryFilterSettings={categoryFilterSettings}
                />
              </div>
            </main>
          ) : (
            <Navigate to={user ? "/" : "/login"} />
          )
        } />

        {/* Settings (requiere rol admin) */}
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

        {/* Fallback: redirigir a home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
