import React, { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import '../products/ProductDetail.css';
import LoadingSpinner from '../common/LoadingSpinner';
import { formatCurrency } from '../../utils/formatCurrency';
import { resolveImageUrl } from '../../utils/resolveImageUrl';
import { getUnitShortLabel } from '../../utils/productUnits';

function Cart({ cartItems, isLoading = false, onAdd, onRemove, onSetQuantity, onClear, onClose, onClearAll, currencyCode }) {
    const navigate = useNavigate();
    const [quantityInputs, setQuantityInputs] = useState({});
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Mantener inputs sincronizados con cantidades reales del carrito
    useEffect(() => {
        const nextInputs = {};
        cartItems.forEach((item) => {
            nextInputs[item.id] = String(item.quantity);
        });
        setQuantityInputs(nextInputs);
    }, [cartItems]);

    // Validate cart has items before navigating to checkout
    const handleCheckout = () => {
        if (!cartItems || cartItems.length === 0) {
            toast.error('Tu carrito está vacío. Agrega productos antes de continuar.');
            return;
        }
        navigate('/checkout');
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

    // Input directo de cantidad: solo dígitos
    const handleQuantityInputChange = (itemId, value) => {
        if (/^\d*$/.test(value)) {
            setQuantityInputs(prev => ({ ...prev, [itemId]: value }));
        }
    };

    // Confirmar cantidad al salir del campo o presionar Enter
    const handleQuantityCommit = (item) => {
        const rawValue = quantityInputs[item.id];
        const parsed = Number.parseInt(rawValue, 10);

        if (!Number.isFinite(parsed) || parsed < 1) {
            setQuantityInputs(prev => ({ ...prev, [item.id]: String(item.quantity) }));
            return;
        }

        const stockLimit = Number.isFinite(Number(item.stock)) && Number(item.stock) > 0
            ? Number(item.stock)
            : parsed;

        const safeQuantity = Math.min(parsed, stockLimit);
        if (safeQuantity !== parsed) {
            toast.error(`Solo hay ${stockLimit} unidad(es) disponibles.`);
        }

        setQuantityInputs(prev => ({ ...prev, [item.id]: String(safeQuantity) }));

        if (safeQuantity !== item.quantity && onSetQuantity) {
            onSetQuantity(item, safeQuantity);
        }
    };

    // Función para eliminar completamente un item
    const handleRemoveItem = (item) => {
        if (onClear) {
            onClear(item);
        }
    };

    const handleOpenProduct = (item) => {
        if (!item || item.id == null) return;
        navigate(`/product/${item.id}`);
        setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 0);
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
                
                {isLoading ? (
                    <div className="empty-cart card-style">
                        <LoadingSpinner fullPage={false} />
                        <p style={{ marginTop: '12px' }}>Cargando carrito...</p>
                    </div>
                ) : cartItems.length === 0 ? (
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
                                {cartItems.map(item => {
                                    const stockLimit = Number.isFinite(Number(item.stock)) && Number(item.stock) > 0
                                        ? Number(item.stock)
                                        : null;
                                    const isAtStockLimit = stockLimit !== null && item.quantity >= stockLimit;

                                    return (
                                        <li key={`cart-${item.id}`} className="cart-item">
                                            <div className="cart-item-image-container">
                                                <button
                                                    type="button"
                                                    className="cart-item-link cart-item-image-button"
                                                    onClick={() => handleOpenProduct(item)}
                                                    aria-label={`Ver ${item.name}`}
                                                >
                                                    <img 
                                                        src={resolveImageUrl(item.image)} 
                                                        alt={item.name} 
                                                        className="cart-item-img" 
                                                        onError={(e) => {
                                                            e.target.src = '/images/placeholder.svg';
                                                        }}
                                                    />
                                                </button>
                                            </div>
                                            <div className="cart-item-details">
                                                <div className="cart-item-header">
                                                    <button
                                                        type="button"
                                                        className="item-name cart-item-link cart-item-name-button"
                                                        onClick={() => handleOpenProduct(item)}
                                                    >
                                                        {item.name}
                                                    </button>
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
                                                        <span className="item-price-value">{formatCurrency(item.price, currencyCode)} {getUnitShortLabel(item.unit_type)}</span>
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
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                pattern="[0-9]*"
                                                                className="qty-input"
                                                                aria-label={`Cantidad de ${item.name}`}
                                                                value={quantityInputs[item.id] ?? String(item.quantity)}
                                                                onChange={(e) => handleQuantityInputChange(item.id, e.target.value)}
                                                                onBlur={() => handleQuantityCommit(item)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        handleQuantityCommit(item);
                                                                        e.currentTarget.blur();
                                                                    }
                                                                }}
                                                            />
                                                            <button 
                                                                className="qty-btn"
                                                                onClick={() => handleIncreaseQuantity(item)}
                                                                disabled={isAtStockLimit}
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                        
                        <div className="cart-summary-section">
                            <div className="summary-card">
                                <h3>Resumen del Pedido</h3>
                                <div className="summary-row">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(total, currencyCode)}</span>
                                </div>
                                <div className="summary-divider"></div>
                                <div className="summary-row total-row">
                                    <span>Total</span>
                                    <span>{formatCurrency(total, currencyCode)}</span>
                                </div>
                                
                                <div className="cart-actions">
                                    <button 
                                        className="checkout-btn" 
                                        onClick={handleCheckout}
                                    >
                                        Realizar Compra
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