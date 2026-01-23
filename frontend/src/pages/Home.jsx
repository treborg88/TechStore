import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ProductImageGallery from '../components/products/ProductImageGallery';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Footer from '../components/common/Footer';
import { DEFAULT_CATEGORY_FILTERS_CONFIG, DEFAULT_PRODUCT_CARD_CONFIG } from '../config';
import { formatCurrency } from '../utils/formatCurrency';

function Home({ products, loading, error, addToCart, fetchProducts, pagination, heroSettings, categoryFilterSettings, productCardSettings }) {
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [imageLoaded, setImageLoaded] = useState(false);
  
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
  const navigate = useNavigate();

  // Efecto para pre-cargar la imagen del Hero
  useEffect(() => {
    if (heroSettings?.image) {
      setImageLoaded(false);
      const img = new Image();
      img.src = heroSettings.image;
      img.onload = () => {
        setImageLoaded(true);
      };
    } else {
      setImageLoaded(false);
    }
  }, [heroSettings?.image]);

  const toCssUnit = (value, unit = 'px') => {
    if (value === null || value === undefined || value === '') return undefined;
    if (typeof value === 'number') return `${value}${unit}`;
    const trimmed = String(value).trim();
    if (trimmed.length === 0) return undefined;
    return /^[0-9]+(\.[0-9]+)?$/.test(trimmed) ? `${trimmed}${unit}` : trimmed;
  };

  const categoryConfig = useMemo(() => {
    const base = DEFAULT_CATEGORY_FILTERS_CONFIG;
    const incoming = categoryFilterSettings && typeof categoryFilterSettings === 'object'
      ? categoryFilterSettings
      : base;
    if (incoming.useDefault) {
      return { ...base, useDefault: true };
    }
    return {
      ...base,
      ...incoming,
      categories: Array.isArray(incoming.categories) && incoming.categories.length > 0
        ? incoming.categories
        : base.categories,
      styles: {
        ...base.styles,
        ...(incoming.styles || {})
      }
    };
  }, [categoryFilterSettings]);

  const categories = useMemo(() => {
    const list = Array.isArray(categoryConfig.categories) ? categoryConfig.categories : [];
    const hasTodos = list.some((item) => item?.slug === 'todos');
    if (hasTodos) return list;
    return [DEFAULT_CATEGORY_FILTERS_CONFIG.categories[0], ...list];
  }, [categoryConfig.categories]);

  const categoryStyleVars = useMemo(() => {
    if (categoryConfig.useDefault) return {};
    const styles = categoryConfig.styles || {};
    return {
      '--category-card-width': toCssUnit(styles.cardWidth),
      '--category-card-height': toCssUnit(styles.cardHeight),
      '--category-card-padding': toCssUnit(styles.cardPadding),
      '--category-card-radius': toCssUnit(styles.cardRadius),
      '--category-card-bg': styles.cardBackground || undefined,
      '--category-card-border': styles.cardBorderColor || undefined,
      '--category-card-shadow': styles.cardShadow || undefined,
      '--category-card-hover-bg': styles.hoverBackground || undefined,
      '--category-card-hover-border': styles.hoverBorderColor || undefined,
      '--category-card-hover-shadow': styles.hoverShadow || undefined,
      '--category-title-hover-color': styles.hoverTitleColor || undefined,
      '--category-card-active-bg': styles.activeBackground || undefined,
      '--category-card-active-border': styles.activeBorderColor || undefined,
      '--category-card-active-shadow': styles.activeShadow || undefined,
      '--category-title-color': styles.titleColor || undefined,
      '--category-title-active-color': styles.activeTitleColor || undefined,
      '--category-title-size': toCssUnit(styles.titleSize, 'px'),
      '--category-title-weight': styles.titleWeight || undefined,
      '--category-title-transform': styles.titleTransform || undefined,
      '--category-title-letter-spacing': toCssUnit(styles.titleLetterSpacing, 'px'),
      '--category-icon-size': toCssUnit(styles.iconSize, 'px')
    };
  }, [categoryConfig, toCssUnit]);

  const productCardConfig = useMemo(() => {
    const base = DEFAULT_PRODUCT_CARD_CONFIG;
    const incoming = productCardSettings && typeof productCardSettings === 'object'
      ? productCardSettings
      : base;
    if (incoming.useDefault) {
      return { ...base, useDefault: true };
    }
    return {
      ...base,
      ...incoming,
      layout: {
        ...base.layout,
        ...(incoming.layout || {})
      },
      styles: {
        ...base.styles,
        ...(incoming.styles || {})
      }
    };
  }, [productCardSettings]);

  const productCardStyleVars = useMemo(() => {
    if (productCardConfig.useDefault) return {};
    const styles = productCardConfig.styles || {};
    const layout = productCardConfig.layout || {};
    return {
      '--product-grid-columns': layout.columnsMobile || undefined,
      '--product-grid-columns-md': layout.columnsTablet || undefined,
      '--product-grid-columns-lg': layout.columnsDesktop || undefined,
      '--product-grid-columns-xl': layout.columnsWide || undefined,
      '--product-card-width': toCssUnit(styles.cardWidth),
      '--product-card-height': toCssUnit(styles.cardHeight),
      '--product-card-padding': toCssUnit(styles.cardPadding),
      '--product-card-radius': toCssUnit(styles.cardRadius),
      '--product-card-border-width': toCssUnit(styles.borderWidth),
      '--product-card-border-style': styles.borderStyle || undefined,
      '--product-card-border-color': styles.borderColor || undefined,
      '--product-card-bg': styles.background || undefined,
      '--product-card-shadow': styles.shadow || undefined,
      '--product-title-color': styles.titleColor || undefined,
      '--product-title-size': toCssUnit(styles.titleSize, 'px'),
      '--product-title-weight': styles.titleWeight || undefined,
      '--product-price-color': styles.priceColor || undefined,
      '--product-price-size': toCssUnit(styles.priceSize, 'px'),
      '--product-price-weight': styles.priceWeight || undefined,
      '--product-desc-color': styles.descriptionColor || undefined,
      '--product-desc-size': toCssUnit(styles.descriptionSize, 'px'),
      '--product-category-color': styles.categoryColor || undefined,
      '--product-category-size': toCssUnit(styles.categorySize, 'px'),
      '--product-button-bg': styles.buttonBg || undefined,
      '--product-button-color': styles.buttonText || undefined,
      '--product-button-radius': toCssUnit(styles.buttonRadius),
      '--product-button-border': styles.buttonBorder || undefined,
      '--product-button-shadow': styles.buttonShadow || undefined
    };
  }, [productCardConfig, toCssUnit]);

  const productCardOrientationClass = productCardConfig.layout?.orientation === 'horizontal'
    ? 'product-card-horizontal'
    : 'product-card-vertical';

  useEffect(() => {
    const valid = categories.some((category) => category?.slug === selectedCategory);
    if (!valid) {
      setSelectedCategory('todos');
      fetchProducts('todos');
    }
  }, [categories, selectedCategory, fetchProducts]);

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
      <section 
        className={`hero-section ${heroSettings?.image && imageLoaded ? 'has-bg show-image' : 'has-bg'}`}
        style={heroSettings?.image && imageLoaded ? { 
          backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${heroSettings.image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        } : {}}
      >
        <div className="container hero-container">
          <div className="hero-content">
            <h2 className="hero-title">{heroSettings?.title || "La Mejor Tecnología a Tu Alcance"}</h2>
            <p className="hero-text">{heroSettings?.description || "Descubre nuestra selección de smartphones y accesorios con las mejores ofertas del mercado."}</p>
          </div>
        </div>
      </section>
      
      {/* Categories */}
      <section className="categories-section" style={categoryStyleVars}>
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
                  <div className="category-icon">
                    {category.image ? (
                      <img src={category.image} alt={category.name} className="category-icon-image" />
                    ) : (
                      category.icon
                    )}
                  </div>
                  <h3 className="category-title">{category.name}</h3>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
      
      {/* Featured Products */}
      <section className="products-section" style={productCardStyleVars}>
        <div className="container">
          <h2 className="section-title">Productos Destacados</h2>
          
          {loading && <LoadingSpinner size="large" />}
          
          {error && <div className="error-message">{error}</div>}
          
          {!loading && !error && (
            <>
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
                    <div key={product.id} className={`product-card ${productCardOrientationClass}`}>
                      <ProductImageGallery
                        images={product.images || product.image}
                        productName={product.name}
                        productDescription={product.description}
                        className="product-image"
                        onAddToCart={() => addToCart(product)}
                        onImageClick={() => navigate(`/product/${product.id}`)}
                      />
                      <div className="product-content">
                        <span className="product-category">{product.category}</span>
                        <Link to={`/product/${product.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          <h3 className="product-title">{product.name}</h3>
                        </Link>
                        <p className="product-description">{product.description}</p>
                        <div className="product-footer">
                          <span className="product-price">{formatCurrency(product.price, productCardConfig.currency)}</span>
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
            
            {pagination && (
                <div className="pagination-controls">
                    <button 
                        className="secondary-button"
                        disabled={pagination.page === 1}
                        onClick={() => fetchProducts(selectedCategory, pagination.page - 1)}
                    >
                        &laquo; Anterior
                    </button>
                    <span>Página {pagination.page} de {pagination.totalPages}</span>
                    <button 
                        className="secondary-button"
                        disabled={pagination.page === pagination.totalPages}
                        onClick={() => fetchProducts(selectedCategory, pagination.page + 1)}
                    >
                        Siguiente &raquo;
                    </button>
                </div>
            )}
            </>
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
    </>
  );
}

export default Home;
