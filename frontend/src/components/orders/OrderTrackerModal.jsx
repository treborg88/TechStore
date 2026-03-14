import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { apiFetch, apiUrl } from '../../services/apiClient';
import './OrderTrackerModal.css';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatQuantityWithUnit } from '../../utils/productUnits';
import { resolveImageUrl } from '../../utils/resolveImageUrl';

function OrderTrackerModal({ onClose, user, currencyCode }) {
    const [searchType, setSearchType] = useState('id'); // 'id' o 'email'
    const [searchValue, setSearchValue] = useState('');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);

    // Cargar órdenes automáticamente si el usuario está logueado
    useEffect(() => {
        if (user) {
            fetchMyOrders();
        }
    }, [user]);

    const fetchMyOrders = async () => {
        setLoading(true);
        setError('');
        setOrders([]);

        try {
            const response = await apiFetch(apiUrl('/orders/my'));

            if (!response.ok) {
                if (response.status === 404) {
                    setError('No se encontraron órdenes');
                } else {
                    throw new Error('Error al cargar tus órdenes');
                }
                setLoading(false);
                return;
            }

            const data = await response.json();
            setOrders(data);
        } catch (err) {
            setError(err.message || 'Error al cargar órdenes');
        } finally {
            setLoading(false);
        }
    };

    const _searchOrdersByEmail = async (email) => {
        setLoading(true);
        setError('');
        setOrders([]);

        try {
            const url = `${API_URL}/orders/track/email/${encodeURIComponent(email)}`;
            const response = await apiFetch(url);

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
            setOrders(data);
        } catch (err) {
            setError(err.message || 'Error al buscar órdenes');
        } finally {
            setLoading(false);
        }
    };

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
                url = `${API_URL}/orders/track/${searchValue}`;
            } else {
                url = `${API_URL}/orders/track/email/${encodeURIComponent(searchValue)}`;
            }

            const response = await apiFetch(url);

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
        <div className="orders-page" style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
            <div className="order-tracker-container" style={{ width: '100%', maxWidth: '1210px' }}>
                <div className="cart-modal-header">
                    <h2>📦 {user ? 'Mis Órdenes' : 'Rastrear Órdenes'}</h2>
                    <button className="close-modal" onClick={onClose}>✕</button>
                </div>
                
                <div className="order-tracker-body">
                    <p className="tracker-subtitle">
                        {user
                            ? `Gestiona y revisa el estado de tus pedidos recientes`
                            : 'Busca tu orden por número de pedido o correo electrónico'
                        }
                    </p>

                    {loading && !orders.length && (
                        <div className="loading-message">
                            🔄 Cargando órdenes...
                        </div>
                    )}

                {!user && (
                    <form onSubmit={handleSearch} className="order-search-form-modal">
                        <div className="search-type-selector-modal">
                            <button
                                type="button"
                                className={`search-type-btn-modal ${searchType === 'id' ? 'active' : ''}`}
                                onClick={() => {
                                    setSearchType('id');
                                    setSearchValue('');
                                    setError('');
                                }}
                            >
                                🔢 Número
                            </button>
                            <button
                                type="button"
                                className={`search-type-btn-modal ${searchType === 'email' ? 'active' : ''}`}
                                onClick={() => {
                                    setSearchType('email');
                                    setSearchValue('');
                                    setError('');
                                }}
                            >
                                📧 Email
                            </button>
                        </div>

                        <div className="search-input-group-modal">
                            <input
                                type={searchType === 'email' ? 'email' : 'text'}
                                placeholder={searchType === 'id' ? 'Ej: 123' : 'Ej: cliente@email.com'}
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                className="search-input-modal"
                                disabled={loading}
                            />
                            <button 
                                type="submit" 
                                className="search-button-modal"
                                disabled={loading}
                            >
                                {loading ? '🔄' : '🔍'}
                            </button>
                        </div>

                        {error && (
                            <div className="search-error-modal">
                                ⚠️ {error}
                            </div>
                        )}
                    </form>
                )}

                {!loading && user && orders.length === 0 && !error && (
                    <div className="no-orders-message">
                        <p>📭 No tienes órdenes aún</p>
                        <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '10px' }}>
                            Cuando realices una compra, tus órdenes aparecerán aquí
                        </p>
                    </div>
                )}

                {!loading && !user && orders.length === 0 && error && (
                    <div className="no-orders-message">
                        <p>📭 {error}</p>
                    </div>
                )}

                {orders.length > 0 && (
                    <div className="orders-results-modal">
                        <h3 className="results-title-modal">
                            {orders.length === 1 ? 'Orden Encontrada' : `${orders.length} Órdenes`}
                        </h3>
                        <div className="orders-list-modal">
                            {orders.map((order) => (
                                <div key={order.id} className="order-card-modal">
                                    <div className="order-card-header">
                                        <div>
                                            <h4>Orden #{order.order_number || order.id}</h4>
                                            <p className="order-date-modal">
                                                {new Date(order.created_at).toLocaleDateString('es-ES')}
                                            </p>
                                        </div>
                                        <span className={`order-status-badge-modal status-${order.status}`}>
                                            {getStatusText(order.status)}
                                        </span>
                                    </div>
                                    <div className="order-card-body">
                                        <p><span>Total:</span> <strong>{formatCurrency(order.total, currencyCode)}</strong></p>
                                        <p><span>Pago:</span> <strong>{getPaymentText(order.payment_method || 'cash')}</strong></p>
                                    </div>
                                    <button
                                        className="view-details-btn-modal"
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

            {selectedOrder && (
                <div className="order-detail-overlay" onClick={closeOrderDetails}>
                    <div className="order-detail-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="order-modal-header">
                            <h3>Detalles de Orden #{selectedOrder.order_number || selectedOrder.id}</h3>
                            <button className="close-modal" onClick={closeOrderDetails}>✕</button>
                        </div>
                        <div className="order-modal-body">
                            <div className="order-info-section">
                                <div className="info-row">
                                    <span className="info-label">Estado</span>
                                    <span className={`order-status-badge-modal status-${selectedOrder.status}`}>
                                        {getStatusText(selectedOrder.status)}
                                    </span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Total</span>
                                    <span className="info-value">{formatCurrency(selectedOrder.total, currencyCode)}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Método de Pago</span>
                                    <span className="info-value">{getPaymentText(selectedOrder.payment_method || 'cash')}</span>
                                </div>
                                <div className="info-row">
                                    <span className="info-label">Fecha</span>
                                    <span className="info-value">
                                        {new Date(selectedOrder.created_at).toLocaleString('es-ES')}
                                    </span>
                                </div>
                                
                                {(selectedOrder.shipping_street || selectedOrder.shipping_city) && (
                                    <div className="info-row full-width">
                                        <span className="info-label">Dirección</span>
                                        <span className="info-value">
                                            {[selectedOrder.shipping_street, selectedOrder.shipping_sector, selectedOrder.shipping_city].filter(Boolean).join(', ')}
                                        </span>
                                    </div>
                                )}

                                {selectedOrder.shipping_address && 
                                 selectedOrder.shipping_address !== [selectedOrder.shipping_street, selectedOrder.shipping_sector, selectedOrder.shipping_city].filter(Boolean).join(', ') && (
                                    <div className="info-row full-width">
                                        <span className="info-label">Notas/Referencias</span>
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
                                                    src={resolveImageUrl(item.image)} 
                                                    alt={item.name}
                                                    className="item-image"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = '/images/placeholder.svg';
                                                    }}
                                                />
                                                <div className="item-info">
                                                    <p className="item-name">{item.name}</p>
                                                    <p className="item-quantity">
                                                        Cantidad: {formatQuantityWithUnit(item.quantity, item.unit_type)} × {formatCurrency(item.price, currencyCode)}
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
        </div>
    );
}

export default OrderTrackerModal;
