import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ProductImageGallery from './ProductImageGallery';
import VariantSelector from './VariantSelector';
import LoadingSpinner from '../common/LoadingSpinner';
import Footer from '../common/Footer';
import RichTextEditor from '../common/RichTextEditor';
import { API_URL, BASE_URL, DEFAULT_PRODUCT_CARD_CONFIG } from '../../config';
import { apiFetch, apiUrl } from '../../services/apiClient';
import './ProductDetail.css';
import { formatCurrency } from '../../utils/formatCurrency';
import { resolveImageUrl } from '../../utils/resolveImageUrl';
import { useSeo } from '../../hooks/useSeo';

const PRODUCT_UNIT_LABELS = {
  unidad: 'ud',
  paquete: 'paq',
  caja: 'caja',
  docena: 'doc',
  lb: 'lb',
  kg: 'kg',
  g: 'g',
  l: 'L',
  ml: 'ml',
  m: 'm'
};

const normalizeUnitType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return PRODUCT_UNIT_LABELS[normalized] ? normalized : 'unidad';
};

function ProductDetail({ products, addToCart, user, onRefresh, heroImage, heroSettings, onCartOpen, currencyCode, productCardSettings }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  // Refs para mouse drag scroll en productos similares
  const similarScrollRef = useRef(null);
  const isDraggingSimilar = useRef(false);
  const startXSimilar = useRef(0);
  const scrollLeftSimilar = useRef(0);
  const hasDraggedSimilar = useRef(false);
  const dragPauseRef = useRef(0); // timestamp when user last dragged — pause auto-scroll briefly
  const [editedDescription, setEditedDescription] = useState('');
  const [saving, setSaving] = useState(false);
  // Variant state (only used when product.has_variants === true)
  const [selectedVariant, setSelectedVariant] = useState(null);
  const onVariantChange = useCallback((v) => setSelectedVariant(v), []);

  // SEO dinámico: se actualiza cuando el producto carga
  useSeo('product', {
    productName: product?.name,
    productDescription: product?.description,
    productImage: product?.images?.[0]?.image_url || product?.image,
    productPrice: product?.price,
    productStock: product?.stock,
    currency: currencyCode
  });

  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true);
      setSelectedVariant(null);
      window.scrollTo(0, 0);

      try {
        // 1. Show cached product immediately for fast render (stale-while-revalidate)
        let foundProduct = products.find(p => p.id === parseInt(id));

        // 2. Always fetch from API for full data (variants, attributeTypes, fresh has_variants)
        const response = await fetch(`${API_URL}/products/${id}`);
        if (response.ok) {
          foundProduct = await response.json();
        } else if (!foundProduct) {
          throw new Error('Producto no encontrado');
        }

        setProduct(foundProduct);
        setEditedDescription(foundProduct.description || '');

        // 3. Buscar productos similares (misma categoría)
        if (foundProduct) {
          // Si tenemos la lista completa en props, filtramos de ahí
          let related = [];
          if (products.length > 0) {
            related = products
              .filter(p => p.category === foundProduct.category && p.id !== foundProduct.id && !p.is_hidden)
              .slice(0, 10);
          } else {
            // Si no, hacemos fetch por categoría (opcional, por ahora usamos lo que hay o nada)
            // Podríamos implementar un fetch específico si fuera necesario
          }
          setSimilarProducts(related);
        }

      } catch (error) {
        console.error('Error loading product:', error);
        toast.error('No se pudo cargar el producto');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [id, products, navigate]);

  // ── Smooth infinite circular carousel for similar products ──
  // Only activates when items overflow the container.
  // Renders 2 copies and silently rewinds scrollLeft past the breakpoint
  // so the user never sees a visible jump.
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = similarScrollRef.current;
    if (!el || similarProducts.length === 0) return;
    setHasOverflow(el.scrollWidth > el.clientWidth);
  }, [similarProducts]);

  // Build duplicated items only when overflow — seamless infinite wrapping
  const duplicatedSimilar = hasOverflow && similarProducts.length > 0
    ? similarProducts.map((item, idx) => ({ ...item, _dupKey: `dup-0-${idx}` }))
        .concat(similarProducts.map((item, idx) => ({ ...item, _dupKey: `dup-1-${idx}` })))
    : [];

  // Auto-scroll (gentle rotation) — scrolls for 3s, pauses for 6s, repeats.
  // Pauses briefly after user drag, then resumes the cycle.
  useEffect(() => {
    if (!hasOverflow || similarProducts.length === 0) return;
    const speed = 0.6;
    const SCROLL_DURATION = 5000;
    const PAUSE_DURATION = 10000;
    let rafId;
    let phaseStart = performance.now();
    let scrolling = true; // start in scroll phase

    const tick = (now) => {
      const el = similarScrollRef.current;
      if (!el) { rafId = requestAnimationFrame(tick); return; }

      // User drag pause (3s) — resets the cycle after it expires
      if (Date.now() - dragPauseRef.current < 3000) {
        phaseStart = performance.now();
        scrolling = true;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const elapsed = now - phaseStart;

      // Switch phases
      if (scrolling && elapsed >= SCROLL_DURATION) {
        scrolling = false;
        phaseStart = now;
        rafId = requestAnimationFrame(tick);
        return;
      }
      if (!scrolling && elapsed >= PAUSE_DURATION) {
        scrolling = true;
        phaseStart = now;
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (scrolling) {
        const setWidth = el.scrollWidth / 2;
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll <= 0) { rafId = requestAnimationFrame(tick); return; }
        if (el.scrollLeft >= setWidth) {
          el.scrollLeft = el.scrollLeft - setWidth;
        }
        el.scrollLeft += speed;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [hasOverflow, similarProducts]);

  // Scroll-based wrap for manual drag interactions
  const handleInfiniteScroll = useCallback(() => {
    const el = similarScrollRef.current;
    if (!el || !hasOverflow) return;
    const setWidth = el.scrollWidth / 2;
    if (el.scrollLeft >= setWidth) {
      el.scrollLeft = el.scrollLeft - setWidth;
    }
  }, [hasOverflow]);

  const handleSimilarMouseDown = useCallback((e) => {
    const el = similarScrollRef.current;
    if (!el) return;
    dragPauseRef.current = Date.now();
    isDraggingSimilar.current = true;
    hasDraggedSimilar.current = false;
    startXSimilar.current = e.pageX - el.offsetLeft;
    scrollLeftSimilar.current = el.scrollLeft;
    el.style.cursor = 'grabbing';
  }, []);

  const handleSimilarMouseLeave = useCallback(() => {
    isDraggingSimilar.current = false;
    if (similarScrollRef.current) similarScrollRef.current.style.cursor = 'grab';
  }, []);

  const handleSimilarMouseUp = useCallback(() => {
    isDraggingSimilar.current = false;
    if (similarScrollRef.current) similarScrollRef.current.style.cursor = 'grab';
  }, []);

  const handleSimilarMouseMove = useCallback((e) => {
    if (!isDraggingSimilar.current) return;
    e.preventDefault();
    const el = similarScrollRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXSimilar.current) * 2;
    if (Math.abs(walk) > 5) hasDraggedSimilar.current = true;
    let newLeft = scrollLeftSimilar.current - walk;
    // Keep scroll within bounds: if past halfway, rewind by one set width
    if (hasOverflow) {
      const setWidth = el.scrollWidth / 2;
      while (newLeft >= setWidth) newLeft -= setWidth;
      while (newLeft < 0) newLeft += setWidth;
    }
    el.scrollLeft = newLeft;
  }, [hasOverflow]);

  const handleSave = async () => {
    const descriptionHtml = editedDescription;
    setSaving(true);
    try {
      let response;
      if (selectedVariant) {
        // Save to variant endpoint
        response = await apiFetch(apiUrl(`/products/${id}/variants/${selectedVariant.id}`), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: descriptionHtml })
        });
        if (response.ok) {
          // Update the variant in the product's variants array
          const updatedVariants = (product.variants || []).map(v =>
            v.id === selectedVariant.id ? { ...v, description: descriptionHtml } : v
          );
          setProduct({ ...product, variants: updatedVariants });
          // Also update selectedVariant so the display updates immediately
          setSelectedVariant({ ...selectedVariant, description: descriptionHtml });
          setEditedDescription(descriptionHtml);
          setIsEditing(false);
          toast.success('Descripción de variante actualizada');
          if (onRefresh) onRefresh();
        } else {
          throw new Error('Error al actualizar');
        }
      } else {
        response = await apiFetch(apiUrl(`/products/${id}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...product,
            description: descriptionHtml
          })
        });
        if (response.ok) {
          setProduct({ ...product, description: descriptionHtml });
          setEditedDescription(descriptionHtml);
          setIsEditing(false);
          toast.success('Descripción actualizada');
          if (onRefresh) onRefresh();
        } else {
          throw new Error('Error al actualizar');
        }
      }
    } catch {
      toast.error('No se pudo guardar la descripción');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Create URL-friendly slug from product name and ID
   */
  const createProductShareSlug = (name = '', productId) => {
    const normalized = String(name)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const idPart = productId ? String(productId) : '';
    if (!normalized) return idPart;
    return idPart ? `${normalized}-${idPart}` : normalized;
  };

  // Backend URL for share page (in dev: backend port, in prod: same origin via Nginx)
  const backendBaseUrl = (API_URL?.replace(/\/api\/?$/, '') || '').replace(/\/$/, '');
  // Share base: backend URL in dev, or current origin in prod (Nginx proxies /p/ to backend)
  const shareBaseUrl = backendBaseUrl || (BASE_URL || window.location.origin).replace(/\/$/, '');
  
  const productId = product?.id || id;
  const shareSlug = createProductShareSlug(product?.name, productId);
  
  // Share URL always uses /p/ route for OG meta tags (social preview)
  const shareUrl = `${shareBaseUrl}/p/${shareSlug}`;
  const shareText = `¡Mira este producto! ${product?.name || ''}`.trim();

  const handleShare = async () => {
    // Use share URL with OG meta tags for better previews
    const shareData = {
      title: product.name,
      text: `${shareText} - ${formatCurrency(product.price, currencyCode)}`,
      url: shareUrl,
    };

    // Try native share API (works on Android, iOS, and some desktop browsers)
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return; // Success - exit early
      } catch (err) {
        // User cancelled sharing - don't show error
        if (err.name === 'AbortError') return;
        // Other errors - fallback to copy
        console.warn('Native share failed:', err.message);
      }
    }
    // Fallback for desktop browsers without native share
    await handleCopyLink();
  };

  // Simple share button - triggers native share or copies link
  const ShareButton = ({ buttonClassName = '', label = 'Compartir' }) => (
    <button
      type="button"
      className={`share-toggle-btn ${buttonClassName}`}
      onClick={handleShare}
    >
      🔗 {label}
    </button>
  );

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      toast.success('¡Enlace copiado al portapapeles!');
    } catch (error) {
      console.error('Error copiando enlace:', error);
      toast.error('No se pudo copiar el enlace');
    }
  };

  if (loading) return <LoadingSpinner fullPage={true} />;
  if (!product) return null;

  // Resolve effective price/stock from selected variant (or product defaults)
  const effectivePrice = selectedVariant?.price_override ?? product.price;
  const effectiveStock = selectedVariant ? selectedVariant.stock : product.stock;
  const isOutOfStock = effectiveStock <= 0;
  const isLowStock = effectiveStock > 0 && effectiveStock <= 10;
  // Variant products require a variant selection before adding to cart
  const needsVariantSelection = product.has_variants && !selectedVariant;
  const unitType = normalizeUnitType(product.unit_type || product.unitType);
  const unitLabel = PRODUCT_UNIT_LABELS[unitType];

  // Hero styles from settings
  const heroHeight = heroSettings?.height || 200;
  const heroOverlay = heroSettings?.overlayOpacity ?? 0.5;
  const hasBannerImage = heroSettings?.bannerImage;
  
  // Banner overlay positioning
  const getBannerStyles = () => {
    if (!hasBannerImage) return null;
    const posX = heroSettings?.bannerPositionX || 'right';
    const posY = heroSettings?.bannerPositionY || 'center';
    const styles = {
      position: 'absolute',
      width: `${heroSettings?.bannerSize || 120}px`,
      height: 'auto',
      maxHeight: '90%',
      objectFit: 'contain',
      opacity: (heroSettings?.bannerOpacity || 100) / 100,
      zIndex: 1,
      pointerEvents: 'none'
    };
    // Horizontal
    if (posX === 'left') { styles.left = '5%'; styles.right = 'auto'; }
    else if (posX === 'center') { styles.left = '50%'; styles.transform = 'translateX(-50%)'; }
    else { styles.right = '5%'; styles.left = 'auto'; }
    // Vertical
    if (posY === 'top') { styles.top = '10%'; styles.bottom = 'auto'; }
    else if (posY === 'center') { styles.top = '50%'; styles.transform = (styles.transform || '') + ' translateY(-50%)'; }
    else { styles.bottom = '10%'; styles.top = 'auto'; }
    return styles;
  };

  // Build CSS variables from product card settings (same source as Home page)
  const cardStyleVars = (() => {
    const cfg = productCardSettings && typeof productCardSettings === 'object' ? productCardSettings : DEFAULT_PRODUCT_CARD_CONFIG;
    if (cfg.useDefault) return {};
    const s = { ...DEFAULT_PRODUCT_CARD_CONFIG.styles, ...(cfg.styles || {}) };
    return {
      '--product-price-color': s.priceColor || undefined,
      '--product-price-size': s.priceSize ? `${s.priceSize}px` : undefined,
      '--product-price-weight': s.priceWeight || undefined,
      '--product-button-bg': s.buttonBg || undefined,
      '--product-button-color': s.buttonText || undefined,
      '--product-button-radius': s.buttonRadius ? `${s.buttonRadius}px` : undefined,
      '--product-button-border': s.buttonBorder || undefined,
      '--product-button-shadow': s.buttonShadow || undefined,
    };
  })();

  return (
    <div className="product-detail-page" style={cardStyleVars}>
      <section 
        className={`hero-section ${heroImage ? 'has-bg' : ''}`}
        style={{
          ...(heroImage ? { 
            backgroundImage: `linear-gradient(rgba(0,0,0,${heroOverlay}), rgba(0,0,0,${heroOverlay})), url(${heroImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          } : {}),
          minHeight: `${heroHeight}px`,
          position: 'relative'
        }}
      >
        {/* Banner overlay image */}
        {hasBannerImage && (
          <img 
            src={heroSettings.bannerImage} 
            alt="" 
            style={getBannerStyles()}
            className="hero-banner-overlay"
          />
        )}
        <div className="container hero-container">
          <div className="hero-content">
            <button 
              className="back-btn-new hero-back-btn" 
              onClick={() => navigate(-1)}
            >
              ← Volver
            </button>
            <h2 className="hero-title">{product.name}</h2>
            <p className="hero-text">
              <span className="hero-category-badge">{product.category}</span>
              Explora los detalles técnicos y características de este producto excepcional.
            </p>
            <div className="hero-buttons">
              <button 
                className="primary-button"
                onClick={async () => {
                  if (needsVariantSelection) {
                    toast.error('Selecciona una variante antes de comprar.');
                    return;
                  }
                  if (onCartOpen) {
                    onCartOpen();
                  }
                  await addToCart(product, { showLoading: true, variant: selectedVariant });
                }}
              >
                🛒 Comprar Ahora
              </button>
              <ShareButton buttonClassName="secondary-button" label="Compartir" />
            </div>
          </div>
        </div>
      </section>

      <div className="product-detail-container">
        <div className="product-detail-main">
        <div className="product-gallery-wrapper">
          <ProductImageGallery 
            images={product.images || product.image} 
            productName={product.name}
            productDescription={product.description}
            activeVariantImageUrl={selectedVariant?.variant_images?.[0]?.image_path ? resolveImageUrl(selectedVariant.variant_images[0].image_path) : selectedVariant?.image_url ? resolveImageUrl(selectedVariant.image_url) : null}
          />
        </div>

        <div className="product-info">
          <div className="product-header">
            <span className="product-category">{product.category}</span>
            {/* Badge indicating product has selectable variants */}
            {product.has_variants && product.variants?.length > 0 && (
              <span className="product-variant-badge">🎨 Variantes disponibles</span>
            )}
            <h1 className="product-title">{product.name}</h1>
          </div>

          <div className="product-price-stock">
            {needsVariantSelection ? (
              <div className="variant-placeholder-text">Selecciona una variante para ver precio y disponibilidad</div>
            ) : (
              <>
                <div className="product-price">{formatCurrency(effectivePrice, currencyCode)}</div>
                <div className={`stock-badge ${isOutOfStock ? 'out-of-stock' : isLowStock ? 'low-stock' : 'in-stock'}`}>
                  {isOutOfStock ? '🔴 Agotado' : isLowStock ? `🟠 ¡Solo quedan ${effectiveStock} ${unitLabel}!` : '🟢 Disponible'}
                </div>
              </>
            )}
          </div>

          {/* Variant selector (only when product has variants) */}
          {product.has_variants && product.variants && product.variants.length > 0 && (
            <VariantSelector
              variants={product.variants}
              attributeTypes={product.attributeTypes || []}
              currencyCode={currencyCode}
              onVariantChange={onVariantChange}
            />
          )}

          <div className="product-description-container">
            <div className="description-header">
              <h3 className="description-subtitle">
                {selectedVariant?.description ? 'Descripción (variante)' : 'Descripción'}
              </h3>
              {user && user.role === 'admin' && !isEditing && (
                <button
                  className="edit-desc-btn"
                  onClick={() => {
                    if (selectedVariant?.description) {
                      setEditedDescription(selectedVariant.description);
                    } else {
                      setEditedDescription(product.description || '');
                    }
                    setIsEditing(true);
                  }}
                  title={selectedVariant ? 'Editar descripción de la variante' : 'Editar descripción'}
                >
                  ✏️
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="edit-description-area">
                <RichTextEditor
                  value={editedDescription}
                  onChange={setEditedDescription}
                  placeholder={selectedVariant ? "Escribe la descripción de la variante..." : "Escribe la descripción del producto..."}
                  helpText={selectedVariant ? "Editando descripción de la variante seleccionada. Se guarda como HTML simple." : "Selecciona texto y usa la barra de formato. Se guarda como HTML simple."}
                />
                <div className="edit-actions">
                  <button className="save-desc-btn" onClick={handleSave} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button className="cancel-desc-btn" onClick={() => {
                    setIsEditing(false);
                    if (selectedVariant?.description) {
                      setEditedDescription(selectedVariant.description);
                    } else {
                      setEditedDescription(product.description || '');
                    }
                  }}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="product-full-description"
                style={{ whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{
                  __html: (selectedVariant?.description || product.description) || 'Sin descripción'
                }}
              />
            )}
          </div>

          <div className="product-actions">
            <div className="action-buttons">
              <button 
                className="add-to-cart-btn"
                onClick={() => {
                  if (needsVariantSelection) {
                    toast.error('Selecciona una variante antes de agregar.');
                    return;
                  }
                  addToCart(product, { variant: selectedVariant });
                }}
                disabled={isOutOfStock || needsVariantSelection}
              >
                {isOutOfStock ? 'Agotado' : needsVariantSelection ? 'Selecciona variante' : '🛒 Agregar'}
              </button>
              <ShareButton label="Compartir" />
            </div>
          </div>
        </div>
      </div>

      {similarProducts.length > 0 && (
        <div className="similar-products-section">
          <h2 className="section-title">Productos Similares</h2>
          <div
            className="similar-products-grid infinite-carousel"
            ref={similarScrollRef}
            onScroll={handleInfiniteScroll}
            onMouseDown={handleSimilarMouseDown}
            onMouseLeave={handleSimilarMouseLeave}
            onMouseUp={handleSimilarMouseUp}
            onMouseMove={handleSimilarMouseMove}
          >
            {(hasOverflow ? duplicatedSimilar : similarProducts).map((similar) => (
              <div
                key={hasOverflow ? similar._dupKey : similar.id}
                className="similar-product-card"
                draggable={false}
                onClick={() => { if (!hasDraggedSimilar.current) navigate(`/product/${similar.id}`); }}
              >
                <img
                  src={resolveImageUrl(
                    (Array.isArray(similar.images) && similar.images.length > 0)
                      ? similar.images[0].image_path
                      : similar.image
                  )}
                  alt={similar.name}
                  className="similar-product-image"
                  draggable={false}
                  onError={(e) => { e.target.onerror = null; e.target.src = '/images/placeholder.svg'; }}
                />
                <div className="similar-product-info">
                  <div className="similar-product-name">{similar.name}</div>
                  <div className="similar-product-price">{formatCurrency(similar.price, currencyCode)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);
}

export default ProductDetail;
