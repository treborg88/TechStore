import React, { useState } from 'react';
import { API_URL, BASE_URL } from '../config';
import '../styles/OrderTrackerModal.css';
import { formatCurrency } from '../utils/formatCurrency';

function OrderTracker({ currencyCode }) {
    const [searchType, setSearchType] = useState('id'); // 'id' o 'email'
    const [searchValue, setSearchValue] = useState('');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);

    const handleSearch = async (e) => {
        e.preventDefault();
        
        if (!searchValue.trim()) {
            setError('Por favor ingresa un valor de búsqueda');
            return;
        }

        setLoading(true);
        setError('');
        setOrders([]);

        try {
            let url;
            if (searchType === 'id') {
                // Buscar por ID específico
                url = `${API_URL}/orders/track/${searchValue}`;
            } else {
                // Buscar por email
                url = `${API_URL}/orders/track/email/${encodeURIComponent(searchValue)}`;
            }

            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 404) {
                    setError('No se encontraron órdenes');
                } else {
                    throw new Error('Error al buscar órdenes');
                }
                setLoading(false);
                return;
            }

            const data = await response.json();
            
            // Si es búsqueda por ID, convertir a array
            if (searchType === 'id') {
                setOrders([data]);
            } else {
                setOrders(data);
            }
        } catch (err) {
            setError(err.message || 'Error al buscar órdenes');
        } finally {
            setLoading(false);
        }
    };

    const viewOrderDetails = (order) => {
        setSelectedOrder(order);
    };

    const closeOrderDetails = () => {
        setSelectedOrder(null);
    };

    const getStatusText = (status) => {
        const statusMap = {
            'pending_payment': '⏳ Pendiente de Pago',
            'paid': '💰 Pagado',
            'to_ship': '📦 Para Enviar',
            'shipped': '🚚 Enviado',
            'delivered': '✅ Entregado',
            'return': '↩️ Devolución',
            'refund': '💸 Reembolso',
            'cancelled': '❌ Cancelado',
            // Fallback for old statuses
            'pending': '⏳ Pendiente',
            'processing': '⚙️ Procesando'
        };
        return statusMap[status] || status;
    };

    const getPaymentText = (method) => {
        const paymentMap = {
            'cash': '💵 Pago Contra Entrega',
            'transfer': '🏦 Transferencia Bancaria',
            'online': '💳 Pago en Línea',
            'card': '💳 Tarjeta de Crédito/Débito'
        };
        return paymentMap[method] || method;
    };

    return (
        <section className="order-tracker-section">
            <div className="container">
                <div className="order-tracker-header">
                    <h2 className="section-title">Rastrea Tu Orden</h2>
                    <p className="section-subtitle">
                        Busca tu orden por número de pedido o correo electrónico
                    </p>
                </div>

                <div className="order-search-card">
                    <form onSubmit={handleSearch} className="order-search-form">
                        <div className="search-type-selector">
                            <button
                                type="button"
                                className={`search-type-btn ${searchType === 'id' ? 'active' : ''}`}
                                onClick={() => {
                                    setSearchType('id');
                                    setSearchValue('');
                                    setError('');
                                }}
                            >
                                🔢 Por Número de Orden
                            </button>
                            <button
                                type="button"
                                className={`search-type-btn ${searchType === 'email' ? 'active' : ''}`}
                                onClick={() => {
                                    setSearchType('email');
                                    setSearchValue('');
                                    setError('');
                                }}
                            >
                                📧 Por Email
                            </button>
                        </div>

                        <div className="search-input-group">
                            <input
                                type={searchType === 'email' ? 'email' : 'text'}
                                placeholder={searchType === 'id' ? 'Ej: W-241210-00125' : 'Ej: cliente@email.com'}
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                className="search-input"
                                disabled={loading}
                            />
                            <button 
                                type="submit" 
                                className="search-button"
                                disabled={loading}
                            >
                                {loading ? '🔄 Buscando...' : '🔍 Buscar'}
                            </button>
                        </div>

                        {error && (
                            <div className="search-error">
                                ⚠️ {error}
                            </div>
                        )}
                    </form>

                    {/* Resultados */}
                    {orders.length > 0 && (
                        <div className="orders-results">
                            <h3 className="results-title">
                                {orders.length === 1 ? 'Orden Encontrada' : `${orders.length} Órdenes Encontradas`}
                            </h3>
                            <div className="orders-list">
                                {orders.map((order) => (
                                    <div key={order.id} className="order-result-card">
                                        <div className="order-result-header">
                                            <div>
                                                <h4>Orden {order.order_number || `#${order.id}`}</h4>
                                                <p className="order-date">
                                                    {new Date(order.created_at).toLocaleDateString('es-ES', {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric'
                                                    })}
                                                </p>
                                            </div>
                                            <span className={`order-status-badge status-${order.status}`}>
                                                {getStatusText(order.status)}
                                            </span>
                                        </div>
                                        <div className="order-result-body">
                                                <p><strong>Total:</strong> {formatCurrency(order.total, currencyCode)}</p>
                                            <p><strong>Pago:</strong> {getPaymentText(order.payment_method || 'cash')}</p>
                                        </div>
                                        <button 
                                            className="view-details-btn"
                                            onClick={() => viewOrderDetails(order)}
                                        >
                                            Ver Detalles
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de detalles */}
            {selectedOrder && (
                <div className="order-modal-overlay" onClick={closeOrderDetails}>
                    <div className="order-detail-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="order-modal-header">
                            <h3>Detalles de Orden {selectedOrder.order_number || `#${selectedOrder.id}`}</h3>
                            <button className="close-modal" onClick={closeOrderDetails}>✕</button>
                        </div>
                        <div className="order-modal-body">
                            <div className="order-info-section">
                                <div className="info-row">
                                    <span className="info-label">Estado:</span>
                                    <span className={`order-status-badge status-${selectedOrder.status}`}>
                                        {getStatusText(selectedOrder.status)}
                                    </span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Total:</span>
                                        <span className="info-value">{formatCurrency(selectedOrder.total, currencyCode)}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Método de Pago:</span>
                                    <span className="info-value">{getPaymentText(selectedOrder.payment_method || 'cash')}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Fecha:</span>
                                    <span className="info-value">
                                        {new Date(selectedOrder.created_at).toLocaleString('es-ES')}
                                    </span>
                                </div>
                                {selectedOrder.shipping_address && (
                                    <div className="info-row full-width">
                                        <span className="info-label">Dirección de envío:</span>
                                        <span className="info-value">{selectedOrder.shipping_address}</span>
                                    </div>
                                )}
                            </div>

                            {selectedOrder.items && selectedOrder.items.length > 0 && (
                                <div className="order-items-section">
                                    <h4>Productos</h4>
                                    <div className="order-items-list">
                                        {selectedOrder.items.map((item) => (
                                            <div key={item.id} className="order-item-row">
                                                <img 
                                                    src={item.image ? (
                                                        item.image.startsWith('http') 
                                                            ? item.image 
                                                            : (item.image.startsWith('/images/') 
                                                                ? `${BASE_URL}${item.image}` 
                                                                : `${BASE_URL}/images/${item.image}`)
                                                    ) : 'https://placehold.co/100x100?text=No+imagen'} 
                                                    alt={item.name}
                                                    className="item-image"
                                                    onError={(e) => {
                                                        e.target.src = 'https://placehold.co/100x100?text=No+imagen';
                                                    }}
                                                />
                                                <div className="item-info">
                                                    <p className="item-name">{item.name}</p>
                                                        <p className="item-quantity">
                                                            Cantidad: {item.quantity} × {formatCurrency(item.price, currencyCode)}
                                                    </p>
                                                </div>
                                                <div className="item-total">
                                                        {formatCurrency(item.quantity * item.price, currencyCode)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

export default OrderTracker;
