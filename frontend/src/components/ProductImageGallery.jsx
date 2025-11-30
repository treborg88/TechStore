import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BASE_URL } from '../config';
import '../styles/ProductImageGallery.css';

function ProductImageGallery({ images, productName, productDescription, className = '' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [internalIndex, setInternalIndex] = useState(1); // Start at 1 (after the prepended image)
  const [isWrapping, setIsWrapping] = useState(false); // Track if we're in wrap mode (no transition)
  
  // Drag tracking refs
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const containerRef = useRef(null);
  const modalContainerRef = useRef(null);
  const carouselSliderRef = useRef(null);
  const modalSliderRef = useRef(null);
  const didDrag = useRef(false);

  // Preparar imágenes - manejar tanto el formato nuevo (array) como el legacy (string)
  const imageList = Array.isArray(images) && images.length > 0
    ? images
    : images && typeof images === 'string'
    ? [{ id: 'legacy', image_path: images }]
    : [];

  // Si no hay imágenes, mostrar imagen por defecto
  const displayImages = imageList.length > 0 ? imageList : [{ id: 'default', image_path: '/images/sin imagen.jpeg' }];

  // Create infinite carousel by duplicating images
  const infiniteImages = [
    displayImages[displayImages.length - 1], // Last image at start
    ...displayImages,
    displayImages[0], // First image at end
  ];

  // Funciones de navegación del carousel
  const nextImage = () => {
    setIsTransitioning(true);
    setZoom(1);
    setInternalIndex((prev) => prev + 1);
    setCurrentIndex((prev) => (prev + 1) % displayImages.length);
  };

  const prevImage = () => {
    setIsTransitioning(true);
    setZoom(1);
    setInternalIndex((prev) => prev - 1);
    setCurrentIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };

  const goToImage = (index) => {
    if (index === currentIndex) return;
    setIsTransitioning(true);
    setZoom(1);
    setCurrentIndex(index);
    setInternalIndex(index + 1); // +1 because of the duplicate at start
  };

  // Handle infinite loop wrapping when transition ends
  useEffect(() => {
    if (!isTransitioning) return;
    
    const timer = setTimeout(() => {
      setIsTransitioning(false);
      
      // Check if we need to wrap around
      if (internalIndex > displayImages.length) {
        // Jumped to the end duplicate, wrap to beginning
        setIsWrapping(true);
        setInternalIndex(1);
      } else if (internalIndex < 1) {
        // Jumped before start, wrap to end
        setIsWrapping(true);
        setInternalIndex(displayImages.length);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [isTransitioning, internalIndex, displayImages.length]);

  // Remove wrapping flag after wrap is applied
  useEffect(() => {
    if (isWrapping) {
      setTimeout(() => setIsWrapping(false), 50);
    }
  }, [isWrapping]);

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

  // Carousel drag handlers for smooth sliding
  const handleCarouselMouseDown = (e) => {
    if (e.button !== 0) return; // Only left mouse button
    e.preventDefault();
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
    touchStartTime.current = Date.now();
    setIsDragging(true);
    didDrag.current = false;
  };

  const handleCarouselMouseMove = (e) => {
    if (!isDragging) return;
    
    const currentX = e.clientX;
    const offset = currentX - touchStartX.current;
    
    // Only drag horizontally if the horizontal movement is greater than vertical
    if (Math.abs(offset) > Math.abs(e.clientY - touchStartY.current)) {
      e.preventDefault();
      setDragOffset(offset);
      if (Math.abs(offset) > 5) didDrag.current = true;
    }
  };

  const handleCarouselMouseUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const endX = e.clientX;
    const dragDistance = endX - touchStartX.current;
    const dragDuration = Date.now() - touchStartTime.current;
    const minDragDistance = 30;
    const maxDragDuration = 1000;
    
    if (Math.abs(dragDistance) > minDragDistance && dragDuration < maxDragDuration) {
      if (dragDistance < 0) {
        nextImage();
      } else {
        prevImage();
      }
    }
    
    setDragOffset(0);
  };

  const handleCarouselMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragOffset(0);
    }
  };

  // Touch handlers for mobile
  const handleCarouselTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
    setIsDragging(true);
    didDrag.current = false;
  };

  const handleCarouselTouchMove = (e) => {
    if (!isDragging) return;
    
    const currentX = e.touches[0].clientX;
    const offset = currentX - touchStartX.current;
    if (Math.abs(offset) > Math.abs(e.touches[0].clientY - touchStartY.current)) {
      e.preventDefault();
      setDragOffset(offset);
      if (Math.abs(offset) > 5) didDrag.current = true;
    }
  };

  const handleCarouselTouchEnd = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const endX = e.changedTouches[0].clientX;
    const dragDistance = endX - touchStartX.current;
    const dragDuration = Date.now() - touchStartTime.current;
    const minDragDistance = 30;
    const maxDragDuration = 1000;
    
    if (Math.abs(dragDistance) > minDragDistance && dragDuration < maxDragDuration) {
      if (dragDistance < 0) {
        nextImage();
      } else {
        prevImage();
      }
    }
    
    setDragOffset(0);
  };
  // Solo mostrar carousel si hay más de una imagen
  const showCarousel = displayImages.length > 1;

  const handleImageClick = () => {
    if (!didDrag.current) {
      toggleModal();
    }
  };

  return (
    <>
      <div className={`product-image-gallery ${className}`}>
        {/* Imagen principal - Carousel Slider */}
        <div 
          className="main-image-container" 
          ref={containerRef}
          onClick={handleImageClick}
          onMouseDown={showCarousel ? handleCarouselMouseDown : undefined}
          onMouseMove={showCarousel ? handleCarouselMouseMove : undefined}
          onMouseUp={showCarousel ? handleCarouselMouseUp : undefined}
          onMouseLeave={showCarousel ? handleCarouselMouseLeave : undefined}
          onTouchStart={showCarousel ? handleCarouselTouchStart : undefined}
          onTouchMove={showCarousel ? handleCarouselTouchMove : undefined}
          onTouchEnd={showCarousel ? handleCarouselTouchEnd : undefined}
          style={{
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          <div 
            className={`carousel-slider ${isTransitioning && !isDragging ? 'transitioning' : ''}`}
            ref={carouselSliderRef}
            style={{
              transform: `translateX(calc(-${(internalIndex) * 100}% + ${dragOffset}px))`,
              transition: (isTransitioning && !isDragging && !isWrapping) ? 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
            }}
          >
            {infiniteImages.map((image, index) => (
              <div key={`${image.id}-${index}`} className="carousel-slide">
                <img
                  src={`${BASE_URL}${image.image_path}`}
                  alt={`${productName} - Imagen`}
                  className="main-product-image"
                  draggable={false}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/images/sin imagen.jpeg';
                  }}
                />
              </div>
            ))}
          </div>
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
            
            <div 
              className="modal-image-container" 
              ref={modalContainerRef}
              onWheel={handleWheel}
              onMouseDown={showCarousel ? handleCarouselMouseDown : undefined}
              onMouseMove={showCarousel ? handleCarouselMouseMove : undefined}
              onMouseUp={showCarousel ? handleCarouselMouseUp : undefined}
              onMouseLeave={showCarousel ? handleCarouselMouseLeave : undefined}
              onTouchStart={showCarousel ? handleCarouselTouchStart : undefined}
              onTouchMove={showCarousel ? handleCarouselTouchMove : undefined}
              onTouchEnd={showCarousel ? handleCarouselTouchEnd : undefined}
              style={{
                cursor: isDragging ? 'grabbing' : 'zoom-in'
              }}
            >
              <div 
                className={`modal-carousel-slider ${isTransitioning && !isDragging ? 'transitioning' : ''}`}
                ref={modalSliderRef}
                style={{
                  transform: `translateX(calc(-${(internalIndex) * 100}% + ${dragOffset}px))`,
                  transition: (isTransitioning && !isDragging && !isWrapping) ? 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
                }}
              >
                {infiniteImages.map((image, index) => (
                  <div key={`modal-${image.id}-${index}`} className="modal-carousel-slide">
                    <img
                      src={`${BASE_URL}${image.image_path}`}
                      alt={`${productName} - Imagen`}
                      className="modal-image"
                      style={{ transform: `scale(${zoom})` }}
                      draggable={false}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/images/sin imagen.jpeg';
                      }}
                    />
                  </div>
                ))}
              </div>
              
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
              {productDescription && (
                <p style={{ fontSize: '0.9rem', marginTop: '10px', lineHeight: '1.4' }}>
                  {productDescription}
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default ProductImageGallery;