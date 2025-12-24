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
                <h2>Carrito de Compras</h2>
                
                {cartItems.length === 0 ? (
                    <div className="empty-cart">
                        <p>El carrito está vacío.</p>
                        <p>¡Agrega algunos productos para comenzar!</p>
                    </div>
                ) : (
                    <>
                        <ul className="cart-list">
                            {cartItems.map(item => (
                                <li key={`cart-${item.id}`} className="cart-item">
                                    <img 
                                        src={item.image ? `${BASE_URL}${item.image}` : '/images/sin imagen.jpeg'} 
                                        alt={item.name} 
                                        className="cart-item-img" 
                                        onError={(e) => {
                                            e.target.src = '/images/sin imagen.jpeg';
                                        }}
                                    />
                                    <div className="cart-item-info">
                                        <span className="item-name">{item.name}</span>
                                        <span className="item-price">${item.price.toFixed(2)}</span>
                                        <div className="cart-item-controls">
                                            <button 
                                                className="quantity-btn decrease"
                                                onClick={() => handleDecreaseQuantity(item)} 
                                                disabled={item.quantity <= 1}
                                                title="Disminuir cantidad"
                                            >
                                                -
                                            </button>
                                            <span className="quantity">{item.quantity}</span>
                                            <button 
                                                className="quantity-btn increase"
                                                onClick={() => handleIncreaseQuantity(item)}
                                                title="Aumentar cantidad"
                                            >
                                                +
                                            </button>
                                        </div>
                                        <div className="item-total">
                                            Subtotal: ${(item.price * item.quantity).toFixed(2)}
                                        </div>
                                    </div>
                                    <button 
                                        className="remove-item" 
                                        onClick={() => handleRemoveItem(item)}
                                        title="Eliminar producto del carrito"
                                    >
                                        ✖
                                    </button>
                                </li>
                            ))}
                        </ul>
                        
                        <div className="cart-summary">
                            <div className="cart-total">
                                <strong>Total: ${total.toFixed(2)}</strong>
                            </div>
                            
                            <div className="cart-actions">
                                <button 
                                    className="clear-cart-btn" 
                                    onClick={onClearAll}
                                    title="Vaciar carrito completo"
                                >
                                    Vaciar Carrito
                                </button>
                                <button 
                                    className="checkout-btn" 
                                    onClick={handleCheckout}
                                >
                                    Finalizar Compra
                                </button>
                            </div>
                        </div>
                    </>
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