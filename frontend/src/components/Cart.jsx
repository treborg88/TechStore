import React, { useState } from "react";
import Checkout from "./Checkout";
import { BASE_URL } from '../config';

function Cart({ cartItems, onAdd, onRemove, onClear, onClose, onClearAll }) {
    const [showCheckout, setShowCheckout] = useState(false);
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const handleCheckout = () => {
        setShowCheckout(true);
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
        <div className="cart-modal">
            <div className="cart-modal-content">
                <button className="close-cart" onClick={onClose}>✖</button>
                <h2 className="cart-title">Tu Carrito</h2>
                
                {cartItems.length === 0 ? (
                    <div className="empty-cart">
                        <div className="empty-cart-icon">🛒</div>
                        <p>El carrito está vacío.</p>
                        <button className="continue-shopping-btn" onClick={onClose}>
                            Explorar Productos
                        </button>
                    </div>
                ) : (
                    <div className="cart-layout">
                        <div className="cart-items-section">
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
                
                {showCheckout && (
                    <Checkout
                        cartItems={cartItems}
                        total={total}
                        onClose={handleCheckoutClose}
                        onClearCart={onClearAll}
                    />
                )}
            </div>
        </div>
    );
}

export default Cart;