import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Header({
  siteName = 'TechStore',
  siteIcon = '🛍️',
  siteLogo = '',
  siteLogoSize = 40,
  siteNameImage = '',
  siteNameImageSize = 32,
  headerSettings = { bgColor: '#2563eb', transparency: 100, textColor: '#ffffff', buttonColor: '#ffffff', buttonTextColor: '#2563eb' },
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

  // Convert hex color to rgba with transparency
  // transparency: 0 = fully transparent, 100 = fully opaque
  const getHeaderBgColor = () => {
    const hex = headerSettings.bgColor || '#2563eb';
    const transparency = headerSettings.transparency ?? 100;
    
    // Parse hex color
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // transparency 100 = alpha 1 (opaque), transparency 0 = alpha 0 (transparent)
    const alpha = transparency / 100;
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Header is considered transparent when transparency is less than 100
  const isTransparentHeader = (headerSettings.transparency ?? 100) < 100;

  // Header text color for nav links
  const headerTextColor = headerSettings.textColor || '#ffffff';

  return (
    <header 
      className={`header ${isTransparentHeader ? 'is-transparent' : ''}`}
      style={{
        backgroundColor: getHeaderBgColor(),
        '--header-text-color': headerTextColor,
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
          {siteLogo ? (
            <img src={siteLogo} alt={siteName} className="logo-image" style={{ height: `${siteLogoSize}px` }} />
          ) : (
            <div className="logo">{siteIcon}</div>
          )}
          {siteNameImage ? (
            <img src={siteNameImage} alt={siteName} className="site-name-image" style={{ height: `${siteNameImageSize}px` }} />
          ) : (
            <h1 className="site-title">{siteName}</h1>
          )}
        </Link>
        
        <div className="header-nav-actions-group">
          <nav className="main-nav">
            <Link to="/" className="nav-link" onClick={handleLogoClick}>Productos</Link>
            <Link to="/contacto" className="nav-link" onClick={closeMobileMenu}>Contacto</Link>
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
                  className="user-name-btn desktop-only" 
                  onClick={() => onProfileOpen && onProfileOpen()}
                >
                  Hola, {user?.name ? (user.name.includes('@') ? user.name.split('@')[0] : user.name.split(' ')[0]) : 'Usuario'}
                </button>
                <button 
                  className="user-name-btn mobile-only" 
                  onClick={() => onProfileOpen && onProfileOpen()}
                >
                  Hola, {user?.name ? (user.name.includes('@') ? user.name.split('@')[0] : user.name.split(' ')[0]) : 'Usuario'}
                </button>
                <button className="login-button desktop-only" onClick={onLogout} style={{ backgroundColor: headerSettings.buttonColor || '#ffffff', color: headerSettings.buttonTextColor || '#2563eb' }}>Cerrar</button>
              </>
            ) : (
              <>
                <button className="login-button desktop-only" onClick={() => navigate('/login')} style={{ backgroundColor: headerSettings.buttonColor || '#ffffff', color: headerSettings.buttonTextColor || '#2563eb' }}>Iniciar Sesión</button>
                <button className="login-button mobile-only" onClick={() => navigate('/login')} style={{ backgroundColor: headerSettings.buttonColor || '#ffffff', color: headerSettings.buttonTextColor || '#2563eb' }}>Iniciar Sesión</button>
              </>
            )}
          </div>
        </div>

        <div className="header-desktop-spacer"></div>

        <nav className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`}>
          <button className="close-mobile-nav" onClick={closeMobileMenu}>✕</button>
          
          <Link to="/" className="mobile-nav-link" onClick={(e) => { handleLogoClick(e); closeMobileMenu(); }}>Productos</Link>
          <Link to="/contacto" className="mobile-nav-link" onClick={closeMobileMenu}>Contacto</Link>
          <a href="#" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); onOrdersOpen && onOrdersOpen(); closeMobileMenu(); }}>Ordenes</a>
          
          {user && user.role === 'admin' && (
            <>
              <a href="#" className="mobile-nav-link" onClick={handleAdminNav}>Administrar</a>
              <Link to="/settings" className="mobile-nav-link" onClick={closeMobileMenu}>Ajustes</Link>
            </>
          )}

          {user ? (
            <>
              <a href="#" className="mobile-nav-link" onClick={(e) => { e.preventDefault(); onProfileOpen && onProfileOpen(); closeMobileMenu(); }}>Mi Perfil</a>
              <button className="mobile-nav-link" onClick={() => { onLogout(); closeMobileMenu(); }} style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer', color: 'var(--white)' }}>
                Cerrar Sesión
              </button>
            </>
          ) : null}
        </nav>

        <div className={`mobile-nav-overlay ${mobileMenuOpen ? 'open' : ''}`} onClick={closeMobileMenu}></div>
      </div>
    </header>
  );
}
