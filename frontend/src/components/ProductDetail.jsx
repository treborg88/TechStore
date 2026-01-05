import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ProductImageGallery from './ProductImageGallery';
import LoadingSpinner from './LoadingSpinner';
import Footer from './Footer';
import { API_URL } from '../config';
import '../styles/ProductDetail.css';

function ProductDetail({ products, addToCart, user, onRefresh }) {
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
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/products/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
    } catch (error) {
      toast.error('No se pudo guardar la descripción');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: product.name,
      text: `¡Mira este producto en TechStore! ${product.name} - $${product.price}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.log('Error al compartir:', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('¡Enlace copiado al portapapeles!');
    }
  };

  if (loading) return <LoadingSpinner fullPage={true} />;
  if (!product) return null;

  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock < 5;

  return (
    <div className="product-detail-page">
      <section className="hero-section">
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
                onClick={() => {
                  addToCart(product);
                  toast.success('Agregado al carrito');
                }}
              >
                🛒 Comprar Ahora
              </button>
              <button className="secondary-button" onClick={handleShare}>
                🔗 Compartir
              </button>
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
            <div className="product-price">${Number(product.price).toLocaleString()}</div>
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
                onClick={() => {
                  addToCart(product);
                  toast.success('Agregado al carrito');
                }}
                disabled={isOutOfStock}
              >
                {isOutOfStock ? 'Agotado' : '🛒 Agregar al Carrito'}
              </button>
              
              <button className="share-btn" onClick={handleShare} title="Compartir">
                🔗 Compartir
              </button>
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
                  <div className="similar-product-price">${Number(similar.price).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    <Footer />
  </div>
);
}

export default ProductDetail;
