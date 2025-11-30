import React, { useState, useRef } from 'react';
import ProductImageGallery from '../components/ProductImageGallery';
import LoadingSpinner from '../components/LoadingSpinner';

function Home({ products, loading, error, addToCart, fetchProducts }) {
  const [selectedCategory, setSelectedCategory] = useState('todos');
  
  // Ref para el scroll de categorías
  const categoriesScrollRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  // Ref para el scroll de productos
  const productsScrollRef = useRef(null);
  const isDraggingProducts = useRef(false);
  const startXProducts = useRef(0);
  const scrollLeftProducts = useRef(0);

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

  // Funciones para drag con mouse en productos
  const handleProductsMouseDown = (e) => {
    isDraggingProducts.current = true;
    startXProducts.current = e.pageX - productsScrollRef.current.offsetLeft;
    scrollLeftProducts.current = productsScrollRef.current.scrollLeft;
    productsScrollRef.current.style.cursor = 'grabbing';
  };

  const handleProductsMouseLeave = () => {
    isDraggingProducts.current = false;
    if (productsScrollRef.current) {
      productsScrollRef.current.style.cursor = 'grab';
    }
  };

  const handleProductsMouseUp = () => {
    isDraggingProducts.current = false;
    if (productsScrollRef.current) {
      productsScrollRef.current.style.cursor = 'grab';
    }
  };

  const handleProductsMouseMove = (e) => {
    if (!isDraggingProducts.current) return;
    e.preventDefault();
    const x = e.pageX - productsScrollRef.current.offsetLeft;
    const walk = (x - startXProducts.current) * 2;
    productsScrollRef.current.scrollLeft = scrollLeftProducts.current - walk;
  };

  return (
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
          
          {loading && <LoadingSpinner size="large" />}
          
          {error && <div className="error-message">{error}</div>}
          
          {!loading && !error && (
            <div className="products-scroll-container">
              <div 
                className="products-grid"
                ref={productsScrollRef}
                onMouseDown={handleProductsMouseDown}
                onMouseLeave={handleProductsMouseLeave}
                onMouseUp={handleProductsMouseUp}
                onMouseMove={handleProductsMouseMove}
              >
                {products.length > 0 ? (
                  products.map(product => (
                    <div key={product.id} className="product-card">
                      <ProductImageGallery
                        images={product.images || product.image}
                        productName={product.name}
                        productDescription={product.description}
                        className="product-image"
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
  );
}

export default Home;
