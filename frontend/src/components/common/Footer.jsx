import React from 'react';

function Footer() {
  const [siteName, setSiteName] = React.useState(localStorage.getItem('siteName') || 'TechStore');

  React.useEffect(() => {
    // Escuchar cambios en localStorage (disparados por App.jsx)
    const handleStorage = () => {
      setSiteName(localStorage.getItem('siteName') || 'TechStore');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-column">
            <h3 className="footer-title">{siteName}</h3>
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
  );
}

export default Footer;
