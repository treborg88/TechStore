import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Header({
  siteName = 'TechStore',
  siteIcon = '🛍️',
  headerSettings = { bgColor: '#2563eb', transparency: 100 },
  cartItems = [],
  user = null,
  onCartOpen,
  onProfileOpen,
  onOrdersOpen,
  onLogout,
  onAdminNav,
  onLogoClick,
  isSticky = false
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const handleLogoClick = (e) => {
    if (onLogoClick) {
      e.preventDefault();
      onLogoClick();
    }
  };

  const handleAdminNav = (event) => {
    event.preventDefault();
    if (onAdminNav) {
      onAdminNav(event);
    } else if (!user) {
      navigate('/login');
    } else {
      navigate('/admin');
    }
    closeMobileMenu();
  };

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <header 
      className={`header ${headerSettings.transparency < 100 ? 'is-transparent' : ''}`}
      style={{
        backgroundColor: headerSettings.transparency < 100 
          ? `${headerSettings.bgColor}${Math.round((headerSettings.transparency / 100) * 255).toString(16).padStart(2, '0')}`
          : headerSettings.bgColor,
        ...(isSticky && { position: 'sticky', top: 0, zIndex: 3200, width: '100%' })
      }}
    >
      <div className="container header-container">
        <button 
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Menu"
        >
          ☰
        </button>

        <Link to="/" className="logo-container" style={{ textDecoration: 'none', color: 'inherit' }} onClick={handleLogoClick}>
          <div className="logo">{siteIcon}</div>
          <h1 className="site-title">{siteName}</h1>
        </Link>
        
        <div className="header-nav-actions-group">
          <nav className="main-nav">
            <Link to="/" className="nav-link" onClick={handleLogoClick}>Productos</Link>
            <Link to="/" className="nav-link" onClick={handleLogoClick}>Contacto</Link>
            <a href="#" className="nav-link" onClick={(e) => { e.preventDefault(); onOrdersOpen && onOrdersOpen(); }}>Ordenes</a>
            {user && user.role === 'admin' && (
              <>
                <a href="#" className="nav-link" onClick={handleAdminNav}>Administrar</a>
                <Link to="/settings" className="nav-link">Ajustes</Link>
              </>
            )}
          </nav>

          <div className="header-actions">
            <div className="cart-container">
              <button className="cart-button" onClick={() => onCartOpen && onCartOpen()}>
                🛒
                <span 
                  className="cart-badge"
                  style={{ 
                    color: cartItemCount > 0 ? 'red' : 'white',
                    backgroundColor: 'transparent',
                    fontSize: '1.3rem'
                  }}
                >
                  {cartItemCount}
                </span>
              </button>
            </div>

            {user ? (
              <>
                <button 
                  className="user-name-btn" 
                  onClick={() => onProfileOpen && onProfileOpen()}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold', marginRight: '10px' }}
                >
                  Hola, {user?.name ? (user.name.includes('@') ? user.name.split('@')[0] : user.name.split(' ')[0]) : 'Usuario'}
                </button>
                <button className="login-button" onClick={onLogout}>Cerrar</button>
              </>
            ) : (
              <button className="login-button" onClick={() => navigate('/login')}>Iniciar Sesión</button>
            )}
          </div>
        </div>

        <div className="header-desktop-spacer"></div>

        <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'open' : ''}`} onClick={closeMobileMenu}></div>
      </div>
    </header>
  );
}
