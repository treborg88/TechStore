import React from "react";
import { useNavigate } from 'react-router-dom';
import { BASE_URL } from '../config';
import '../styles/ProductDetail.css';

function Cart({ cartItems, onAdd, onRemove, onClear, onClose, onClearAll, navigateToCheckout }) {
    const navigate = useNavigate();
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const handleCheckout = () => {
        navigate('/checkout');
    };

    const handleCheckoutClose = () => {
        setShowCheckout(false);
    };

    // Función para aumentar cantidad
    const handleIncreaseQuantity = (item) => {
        if (onAdd) {
            onAdd({ ...item, id: item.id }, 1);
        }
    };

    // Función para disminuir cantidad
    const handleDecreaseQuantity = (item) => {
        if (item.quantity > 1 && onRemove) {
            onRemove(item, item.quantity - 1);
        }
    };

    // Función para eliminar completamente un item
    const handleRemoveItem = (item) => {
        if (onClear) {
            onClear(item);
        }
    };

    return (
        <div className="cart-page product-detail-page">
            <section className="hero-section" style={{ padding: '40px 0 30px' }}>
                <div className="container hero-container">
                    <div className="hero-content">
                        <button 
                            className="back-btn-new hero-back-btn" 
                            onClick={onClose}
                        >
                            ← Volver
                        </button>
                        <h2 className="hero-title">Tu Carrito</h2>
                        <p className="hero-text">
                            <span className="hero-category-badge">RESUMEN DE COMPRA</span>
                            Gestiona tus productos seleccionados y completa tu pedido.
                        </p>
                    </div>
                </div>
            </section>

            <div className="cart-modal-content" style={{ padding: '160px 20px 80px' }}>
                <div style={{ display: 'none' }}>
                    <button 
                        onClick={onClose} 
                        className="back-btn-cart"
                        style={{ 
                            marginBottom: '15px'
                        }}
                    >
                        ← Volver
                    </button>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 30px 0', color: 'var(--gray-800)', textAlign: 'left' }}>Tu Carrito</h1>
                </div>
                
                <h2 className="cart-title" style={{ display: 'none' }}>Tu Selección</h2>
                
                {cartItems.length === 0 ? (
                    <div className="empty-cart card-style">
                        <div className="empty-cart-icon">🛍️</div>
                        <h3>Tu carrito está vacío</h3>
                        <p>Aún no has añadido productos. ¡Explora nuestra tienda para encontrar las mejores ofertas!</p>
                        <button className="continue-shopping-btn" onClick={() => {
                            window.scrollTo(0, 0);
                            onClose();
                            navigate('/');
                        }}>
                            Ir a la Tienda
                        </button>
                    </div>
                ) : (
                    <div className="cart-layout">
                        <div className="cart-items-section">
                            <div className="section-header-mini">
                                <span>{cartItems.length} {cartItems.length === 1 ? 'Producto' : 'Productos'}</span>
                            </div>
                            <ul className="cart-list">
                                {cartItems.map(item => (
                                    <li key={`cart-${item.id}`} className="cart-item">
                                        <div className="cart-item-image-container">
                                            <img 
                                                src={item.image ? (
                                                    item.image.startsWith('http') 
                                                        ? item.image 
                                                        : (item.image.startsWith('/images/') 
                                                            ? `${BASE_URL}${item.image}` 
                                                            : `${BASE_URL}/images/${item.image}`)
                                                ) : '/images/sin imagen.jpeg'} 
                                                alt={item.name} 
                                                className="cart-item-img" 
                                                onError={(e) => {
                                                    e.target.src = '/images/sin imagen.jpeg';
                                                }}
                                            />
                                        </div>
                                        <div className="cart-item-details">
                                            <div className="cart-item-header">
                                                <span className="item-name">{item.name}</span>
                                                <button 
                                                    className="remove-item-btn" 
                                                    onClick={() => handleRemoveItem(item)}
                                                    title="Eliminar"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                            <div className="cart-item-body">
                                                <div className="item-price-info">
                                                    <span className="item-price-label">Precio:</span>
                                                    <span className="item-price-value">${item.price.toFixed(2)}</span>
                                                </div>
                                                <div className="cart-item-actions">
                                                    <div className="quantity-selector">
                                                        <button 
                                                            className="qty-btn"
                                                            onClick={() => handleDecreaseQuantity(item)} 
                                                            disabled={item.quantity <= 1}
                                                        >
                                                            -
                                                        </button>
                                                        <span className="qty-number">{item.quantity}</span>
                                                        <button 
                                                            className="qty-btn"
                                                            onClick={() => handleIncreaseQuantity(item)}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div className="cart-summary-section">
                            <div className="summary-card">
                                <h3>Resumen del Pedido</h3>
                                <div className="summary-row">
                                    <span>Subtotal</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                                <div className="summary-row">
                                    <span>Envío</span>
                                    <span className="free-shipping">Gratis</span>
                                </div>
                                <div className="summary-divider"></div>
                                <div className="summary-row total-row">
                                    <span>Total</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                                
                                <div className="cart-actions">
                                    <button 
                                        className="checkout-btn" 
                                        onClick={handleCheckout}
                                    >
                                        Finalizar Compra
                                    </button>
                                    <button 
                                        className="clear-cart-btn" 
                                        onClick={onClearAll}
                                    >
                                        Vaciar Carrito
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default Cart;