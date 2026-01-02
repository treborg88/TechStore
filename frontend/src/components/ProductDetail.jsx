import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ProductImageGallery from './ProductImageGallery';
import LoadingSpinner from './LoadingSpinner';
import { API_URL } from '../config';
import '../styles/ProductDetail.css';

function ProductDetail({ products, addToCart }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [similarProducts, setSimilarProducts] = useState([]);

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

        // 3. Buscar productos similares (misma categoría)
        if (foundProduct) {
          // Si tenemos la lista completa en props, filtramos de ahí
          let related = [];
          if (products.length > 0) {
            related = products
              .filter(p => p.category === foundProduct.category && p.id !== foundProduct.id)
              .slice(0, 4);
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
    <div className="product-detail-container">
      <button className="back-btn" onClick={() => navigate(-1)} style={{ marginBottom: '1rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', color: '#666' }}>
        ← Volver
      </button>

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

          <p className="product-description">{product.description}</p>

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
  );
}

export default ProductDetail;
