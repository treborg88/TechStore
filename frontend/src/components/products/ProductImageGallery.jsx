import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BASE_URL } from '../../config';
import './ProductImageGallery.css';

function ProductImageGallery({ images, productName, className = '', onImageClick }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [internalIndex, setInternalIndex] = useState(1); // Start at 1 (after the prepended image)
  const [isWrapping, setIsWrapping] = useState(false); // Track if we're in wrap mode (no transition)
  
  // Drag tracking refs
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const containerRef = useRef(null);
  const modalContainerRef = useRef(null);
  const carouselSliderRef = useRef(null);
  const panStart = useRef({ x: 0, y: 0 });
  const pointerStart = useRef({ x: 0, y: 0 });
  const modalSwipeStart = useRef({ x: 0, y: 0, time: 0 });
  const modalIsSwiping = useRef(false);
  const pinchStartDistance = useRef(0);
  const pinchStartZoom = useRef(1);
  const isPinching = useRef(false);
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
    setPan({ x: 0, y: 0 });
    setInternalIndex((prev) => prev + 1);
    setCurrentIndex((prev) => (prev + 1) % displayImages.length);
  };

  const prevImage = () => {
    setIsTransitioning(true);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setInternalIndex((prev) => prev - 1);
    setCurrentIndex((prev) => (prev - 1 + displayImages.length) % displayImages.length);
  };

  const _goToImage = (index) => {
    if (index === currentIndex) return;
    setIsTransitioning(true);
    setZoom(1);
    setPan({ x: 0, y: 0 });
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
    if (!isModalOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setDragOffset(0);
      setIsDragging(false);
    }
    setIsModalOpen(!isModalOpen);
  };

  const handleWheel = (e) => {
    e.stopPropagation();
    const delta = -Math.sign(e.deltaY);
    const newZoom = zoom + delta * 0.2;
    const nextZoom = Math.min(Math.max(1, newZoom), 5);
    setZoom(nextZoom);
    if (nextZoom === 1) {
      setPan({ x: 0, y: 0 });
    }
  };

  const getTouchDistance = (touches) => {
    if (touches.length < 2) return 0;
    const [a, b] = touches;
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  };

  useEffect(() => {
    if (!isModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isModalOpen]);

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

  const handleImageClick = (e) => {
    if (!didDrag.current) {
      if (onImageClick) {
        onImageClick(e);
      } else {
        toggleModal();
      }
    }
  };

  const handleModalPointerDown = (e) => {
    if (zoom > 1) {
      e.preventDefault();
      setIsPanning(true);
      pointerStart.current = { x: e.clientX, y: e.clientY };
      panStart.current = { ...pan };
    } else {
      modalSwipeStart.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      modalIsSwiping.current = true;
      setIsDragging(true);
      setDragOffset(0);
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handleModalPointerMove = (e) => {
    if (zoom > 1) {
      if (!isPanning) return;
      const deltaX = e.clientX - pointerStart.current.x;
      const deltaY = e.clientY - pointerStart.current.y;
      setPan({ x: panStart.current.x + deltaX, y: panStart.current.y + deltaY });
      return;
    }
    if (!modalIsSwiping.current) return;
    const deltaX = e.clientX - modalSwipeStart.current.x;
    const deltaY = e.clientY - modalSwipeStart.current.y;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      setDragOffset(deltaX);
    }
  };

  const stopModalPanning = (e) => {
    if (zoom > 1) {
      if (isPanning) {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
        setIsPanning(false);
      }
      return;
    }
    if (!modalIsSwiping.current) return;
    const endX = e.clientX;
    const deltaX = endX - modalSwipeStart.current.x;
    const duration = Date.now() - modalSwipeStart.current.time;
    const minDragDistance = 40;
    const maxDragDuration = 1000;
    if (Math.abs(deltaX) > minDragDistance && duration < maxDragDuration) {
      if (deltaX < 0) {
        nextImage();
      } else {
        prevImage();
      }
    }
    setDragOffset(0);
    setIsDragging(false);
    modalIsSwiping.current = false;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const handleModalTouchStart = (e) => {
    if (e.touches.length === 2) {
      isPinching.current = true;
      pinchStartDistance.current = getTouchDistance(e.touches);
      pinchStartZoom.current = zoom;
    }
  };

  const handleModalTouchMove = (e) => {
    if (e.touches.length === 2 && isPinching.current) {
      const distance = getTouchDistance(e.touches);
      if (!distance || !pinchStartDistance.current) return;
      const scale = distance / pinchStartDistance.current;
      const nextZoom = Math.min(Math.max(1, pinchStartZoom.current * scale), 5);
      setZoom(nextZoom);
      if (nextZoom === 1) {
        setPan({ x: 0, y: 0 });
      }
    }
  };

  const handleModalTouchEnd = (e) => {
    if (e.touches.length < 2) {
      isPinching.current = false;
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
                  src={image.image_path ? (
                    image.image_path.startsWith('http') 
                      ? image.image_path 
                      : (image.image_path.startsWith('/images/') 
                          ? `${BASE_URL}${image.image_path}` 
                          : `${BASE_URL}/images/${image.image_path}`)
                  ) : '/images/sin imagen.jpeg'}
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
              onPointerDown={handleModalPointerDown}
              onPointerMove={handleModalPointerMove}
              onPointerUp={stopModalPanning}
              onPointerCancel={stopModalPanning}
              onPointerLeave={stopModalPanning}
              onTouchStart={handleModalTouchStart}
              onTouchMove={handleModalTouchMove}
              onTouchEnd={handleModalTouchEnd}
              onTouchCancel={handleModalTouchEnd}
              style={{
                cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in'
              }}
            >
              <div 
                className={`modal-carousel-slider ${isTransitioning && !isDragging ? 'transitioning' : ''}`}
                style={{
                  transform: `translateX(calc(-${(internalIndex) * 100}% + ${dragOffset}px))`,
                  transition: (isTransitioning && !isDragging && !isWrapping) ? 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
                }}
              >
                {infiniteImages.map((image, index) => (
                  <div key={`modal-${image.id}-${index}`} className="modal-carousel-slide">
                    <img
                      src={image.image_path ? (
                        image.image_path.startsWith('http')
                          ? image.image_path
                          : (image.image_path.startsWith('/images/')
                              ? `${BASE_URL}${image.image_path}`
                              : `${BASE_URL}/images/${image.image_path}`)
                      ) : '/images/sin imagen.jpeg'}
                      alt={`${productName} - Imagen`}
                      className="modal-image"
                      style={index === internalIndex ? { transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` } : undefined}
                      draggable={false}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/images/sin imagen.jpeg';
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default ProductImageGallery;