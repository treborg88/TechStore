import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ProductImageGallery from './ProductImageGallery';
import LoadingSpinner from '../common/LoadingSpinner';
import Footer from '../common/Footer';
import { API_URL, BASE_URL } from '../../config';
import { apiFetch, apiUrl } from '../../services/apiClient';
import './ProductDetail.css';
import { formatCurrency } from '../../utils/formatCurrency';

function ProductDetail({ products, addToCart, user, onRefresh, heroImage, onCartOpen, currencyCode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadProduct = async () => {
      setLoading(true);
      window.scrollTo(0, 0);

      try {
        // 1. Intentar encontrar el producto en la lista pasada por props
        let foundProduct = products.find(p => p.id === parseInt(id));

        // 2. Si no está (ej. carga directa), buscar en la API
        if (!foundProduct) {
          const response = await fetch(`${API_URL}/products/${id}`);
          if (!response.ok) {
            throw new Error('Producto no encontrado');
          }
          foundProduct = await response.json();
        }

        setProduct(foundProduct);
        setEditedDescription(foundProduct.description || '');

        // 3. Buscar productos similares (misma categoría)
        if (foundProduct) {
          // Si tenemos la lista completa en props, filtramos de ahí
          let related = [];
          if (products.length > 0) {
            related = products
              .filter(p => p.category === foundProduct.category && p.id !== foundProduct.id)
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiFetch(apiUrl(`/products/${id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...product,
          description: editedDescription
        })
      });

      if (response.ok) {
        setProduct({ ...product, description: editedDescription });
        setIsEditing(false);
        toast.success('Descripción actualizada');
        if (onRefresh) onRefresh();
      } else {
        throw new Error('Error al actualizar');
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

  // Backend URL for share page (serves OG meta tags)
  const backendBaseUrl = (API_URL?.replace(/\/api\/?$/, '') || '').replace(/\/$/, '');
  // Frontend URL for direct product link
  const frontendBaseUrl = (BASE_URL || window.location.origin).replace(/\/$/, '');
  
  const productId = product?.id || id;
  const shareSlug = createProductShareSlug(product?.name, productId);
  
  // Share URL points to backend /p/ route (for OG meta tags)
  const shareUrl = backendBaseUrl ? `${backendBaseUrl}/p/${shareSlug}` : `${frontendBaseUrl}/product/${productId}`;
  const shareText = `¡Mira este producto! ${product?.name || ''}`.trim();

  const handleShare = async () => {
    // Use share URL with OG meta tags for better previews
    const shareData = {
      title: product.name,
      text: `${shareText} - ${formatCurrency(product.price, currencyCode)}`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or error - fallback to copy
        if (err.name !== 'AbortError') {
          console.log('Error al compartir:', err);
          await handleCopyLink();
        }
      }
    } else {
      await handleCopyLink();
    }
  };

  const ShareMenu = ({ buttonClassName = '', label = 'Compartir' }) => {
    const [open, setOpen] = useState(false);
    const [dropDirection, setDropDirection] = useState('up');
    const menuRef = useRef(null);
    const buttonRef = useRef(null);

    useEffect(() => {
      if (!open) return;
      const buttonRect = buttonRef.current?.getBoundingClientRect();
      if (buttonRect) {
        const spaceAbove = buttonRect.top;
        const spaceBelow = window.innerHeight - buttonRect.bottom;
        const preferredHeight = 240;
        if (spaceAbove < preferredHeight && spaceBelow > spaceAbove) {
          setDropDirection('down');
        } else {
          setDropDirection('up');
        }
      }
      const handleClickOutside = (event) => {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const handleCopy = async () => {
      await handleCopyLink();
      setOpen(false);
    };

    const closeMenu = () => setOpen(false);

    return (
      <div className="share-menu" ref={menuRef}>
        <button
          type="button"
          className={`share-toggle-btn ${buttonClassName}`}
          onClick={() => setOpen((prev) => !prev)}
          ref={buttonRef}
        >
          🔗 {label}
        </button>
        {open && (
          <div className={`share-dropdown ${dropDirection === 'down' ? 'drop-down' : 'drop-up'}`}>
            <button type="button" className="share-option" onClick={handleShare}>
              📲 Compartir
            </button>
            <button type="button" className="share-option" onClick={handleCopy}>
              🔗 Copiar enlace
            </button>
            <a
              className="share-option"
              href={`mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`}
              onClick={closeMenu}
            >
              ✉️ Email
            </a>
            <a
              className="share-option"
              href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
              target="_blank"
              rel="noreferrer"
              onClick={closeMenu}
            >
              💬 WhatsApp
            </a>
            <a
              className="share-option"
              href={`https://www.messenger.com/t/?link=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
              onClick={closeMenu}
            >
              💙 Messenger
            </a>
            <a
              className="share-option"
              href={`https://www.instagram.com/?url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
              onClick={closeMenu}
            >
              📸 Instagram
            </a>
          </div>
        )}
      </div>
    );
  };

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

  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock < 5;

  return (
    <div className="product-detail-page">
      <section 
        className={`hero-section ${heroImage ? 'has-bg' : ''}`}
        style={heroImage ? { 
          backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        } : {}}
      >
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
                  if (onCartOpen) {
                    onCartOpen();
                  }
                  await addToCart(product, { showLoading: true });
                }}
              >
                🛒 Comprar Ahora
              </button>
              <ShareMenu buttonClassName="secondary-button" label="Compartir" />
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
          />
        </div>

        <div className="product-info">
          <div className="product-header">
            <span className="product-category">{product.category}</span>
            <h1 className="product-title">{product.name}</h1>
          </div>

          <div className="product-price-stock">
            <div className="product-price">{formatCurrency(product.price, currencyCode)}</div>
            <div className={`stock-badge ${isOutOfStock ? 'out-of-stock' : isLowStock ? 'low-stock' : 'in-stock'}`}>
              {isOutOfStock ? '🔴 Agotado' : isLowStock ? `🟠 ¡Solo quedan ${product.stock}!` : '🟢 Disponible'}
            </div>
          </div>

          <div className="product-description-container">
            <div className="description-header">
              <h3 className="description-subtitle">Descripción</h3>
              {user && user.role === 'admin' && !isEditing && (
                <button 
                  className="edit-desc-btn" 
                  onClick={() => setIsEditing(true)}
                  title="Editar descripción"
                >
                  ✏️
                </button>
              )}
            </div>
            
            {isEditing ? (
              <div className="edit-description-area">
                <p className="edit-help-text">Puedes usar etiquetas HTML simples como &lt;b&gt;negrita&lt;/b&gt; o &lt;br/&gt;.</p>
                <textarea
                  className="edit-desc-input"
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  placeholder="Escribe la descripción del producto..."
                  rows={8}
                />
                <div className="edit-actions">
                  <button className="save-desc-btn" onClick={handleSave} disabled={saving}>
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button className="cancel-desc-btn" onClick={() => {
                    setIsEditing(false);
                    setEditedDescription(product.description || '');
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
                  __html: product.description || 'Sin descripción'
                }}
              />
            )}
          </div>

          <div className="product-actions">
            <div className="action-buttons">
              <button 
                className="add-to-cart-btn"
                onClick={() => addToCart(product)}
                disabled={isOutOfStock}
              >
                {isOutOfStock ? 'Agotado' : '🛒 Agregar'}
              </button>
              <ShareMenu label="Compartir" />
            </div>
          </div>
        </div>
      </div>

      {similarProducts.length > 0 && (
        <div className="similar-products-section">
          <h2 className="section-title">Productos Similares</h2>
          <div className="similar-products-grid">
            {similarProducts.map(similar => (
              <div 
                key={similar.id} 
                className="similar-product-card"
                onClick={() => navigate(`/product/${similar.id}`)}
              >
                <img 
                  src={
                    (Array.isArray(similar.images) && similar.images.length > 0) 
                      ? similar.images[0].image_path 
                      : (similar.image || '/images/sin imagen.jpeg')
                  } 
                  alt={similar.name} 
                  className="similar-product-image"
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
