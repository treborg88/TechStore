import { useState } from 'react';
import { createPortal } from 'react-dom';
import { BASE_URL } from '../config';
import '../styles/ProductImageGallery.css';

function ProductImageGallery({ images, productName, className = '' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Preparar imágenes - manejar tanto el formato nuevo (array) como el legacy (string)
  const imageList = Array.isArray(images) && images.length > 0
    ? images
    : images && typeof images === 'string'
    ? [{ id: 'legacy', image_path: images }]
    : [];

  // Si no hay imágenes, mostrar imagen por defecto
  const displayImages = imageList.length > 0 ? imageList : [{ id: 'default', image_path: '/images/sin imagen.jpeg' }];

  // Funciones de navegación del carousel
  const nextImage = () => {
    setIsTransitioning(true);
    setZoom(1);
    setCurrentIndex((prev) => (prev + 1) % displayImages.length);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const prevImage = () => {
    setIsTransitioning(true);
    setZoom(1);
    setCurrentIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const goToImage = (index) => {
    if (index === currentIndex) return;
    setIsTransitioning(true);
    setZoom(1);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const toggleModal = () => {
    if (!isModalOpen) setZoom(1);
    setIsModalOpen(!isModalOpen);
  };

  const handleWheel = (e) => {
    e.stopPropagation();
    const delta = -Math.sign(e.deltaY);
    const newZoom = zoom + delta * 0.2;
    setZoom(Math.min(Math.max(1, newZoom), 5));
  };

  // Solo mostrar carousel si hay más de una imagen
  const showCarousel = displayImages.length > 1;

  return (
    <>
      <div className={`product-image-gallery ${className}`}>
        {/* Imagen principal */}
        <div className="main-image-container" onClick={toggleModal}>
          <img
            src={`${BASE_URL}${displayImages[currentIndex].image_path}`}
            alt={productName}
            className="main-product-image"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/images/sin imagen.jpeg';
            }}
          />
          {showCarousel && (
            <>
              {/* Botones de navegación */}
              <button
                className="nav-button prev-button"
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                aria-label="Imagen anterior"
              >
                ❮
              </button>
              <button
                className="nav-button next-button"
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                aria-label="Imagen siguiente"
              >
                ❯
              </button>
            </>
          )}
        </div>

      </div>

      {/* Modal para expandir imágenes */}
      {isModalOpen && createPortal(
        <div className="image-modal-overlay" onClick={toggleModal}>
          <div className="image-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close-button" onClick={toggleModal}>×</button>
            
            <div className="modal-image-container" onWheel={handleWheel}>
              <img
                src={`${BASE_URL}${displayImages[currentIndex].image_path}`}
                alt={productName}
                className="modal-image"
                style={{ transform: `scale(${zoom})` }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/images/sin imagen.jpeg';
                }}
              />
              
              {showCarousel && (
                <>
                  <button
                    className="modal-nav-button modal-prev-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      prevImage();
                    }}
                  >
                    ❮
                  </button>
                  <button
                    className="modal-nav-button modal-next-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      nextImage();
                    }}
                  >
                    ❯
                  </button>
                </>
              )}
            </div>
            
            <div className="modal-info">
              <h3>{productName}</h3>
              {showCarousel && <p>Imagen {currentIndex + 1} de {displayImages.length}</p>}
              <p style={{ fontSize: '0.8rem', marginTop: '5px', opacity: 0.7 }}>
                Usa la rueda del ratón para hacer zoom
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default ProductImageGallery;