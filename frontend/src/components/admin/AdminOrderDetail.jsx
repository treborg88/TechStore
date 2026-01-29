import React, { useState } from 'react';
import Invoice from '../common/Invoice';
import { formatCurrency } from '../../utils/formatCurrency';
import './AdminOrderDetail.css';

const ONLINE_ORDER_STEPS = [
    { id: 'pending_payment', label: 'Pendiente Pago', icon: '⏳', color: '#f59e0b' },
    { id: 'paid', label: 'Pagado', icon: '💰', color: '#10b981' },
    { id: 'to_ship', label: 'Para Enviar', icon: '📦', color: '#3b82f6' },
    { id: 'shipped', label: 'Enviado', icon: '🚚', color: '#8b5cf6' },
    { id: 'delivered', label: 'Entregado', icon: '✅', color: '#059669' },
    { id: 'return', label: 'Devolución', icon: '↩️', color: '#6366f1' },
    { id: 'refund', label: 'Reembolso', icon: '💸', color: '#ec4899' },
    { id: 'cancelled', label: 'Cancelado', icon: '❌', color: '#ef4444' }
];

const COD_ORDER_STEPS = [
    { id: 'to_ship', label: 'Para Enviar', icon: '📦', color: '#3b82f6' },
    { id: 'shipped', label: 'Enviado', icon: '🚚', color: '#8b5cf6' },
    { id: 'delivered', label: 'Entregado', icon: '✅', color: '#059669' },
    { id: 'paid', label: 'Pagado', icon: '💰', color: '#10b981' },
    { id: 'return', label: 'Devolución', icon: '↩️', color: '#6366f1' },
    { id: 'refund', label: 'Reembolso', icon: '💸', color: '#ec4899' },
    { id: 'cancelled', label: 'Cancelado', icon: '❌', color: '#ef4444' }
];

export default function AdminOrderDetail({ 
    order, 
    onClose, 
    onStatusChange, 
    onSaveNotes, 
    onDelete,
    isSubmitting,
    siteName,
    siteIcon,
    currencyCode
}) {
    const [internalNotes, setInternalNotes] = useState(order.internal_notes || '');
    const [showTrackingForm, setShowTrackingForm] = useState(false);
    const [trackingData, setTrackingData] = useState({ 
        carrier: order.carrier || '', 
        trackingNumber: order.tracking_number || '' 
    });

    const isCOD = order.payment_method === 'cash';
    const steps = isCOD ? COD_ORDER_STEPS : ONLINE_ORDER_STEPS;
    const currentStatusIndex = steps.findIndex((step) => step.id === order.status);
    
    const handleTrackingSubmit = (e) => {
        e.preventDefault();
        onStatusChange(order.id, 'shipped', { 
            carrier: trackingData.carrier, 
            tracking_number: trackingData.trackingNumber 
        });
        setShowTrackingForm(false);
    };

    const formatDate = (value) => {
        if (!value) return '—';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return '—';
        return parsed.toLocaleDateString('es-DO');
    };

    return (
        <div className="admin-order-detail-page">
            <div className="admin-order-summary-card">
                <div className="summary-header">
                    <div className="header-left">
                        {/* Back button to return to orders list */}
                        <button 
                            className="back-button" 
                            onClick={onClose} 
                            title="Volver a órdenes"
                            aria-label="Volver a la lista de órdenes"
                        >
                            ←
                        </button>
                        <h1>Orden {order.order_number || `#${order.id}`}</h1>
                        <span className={`status-badge status-${order.status}`}>
                            {steps.find(s => s.id === order.status)?.icon} {steps.find(s => s.id === order.status)?.label || order.status}
                        </span>
                    </div>
                    <div className="header-right">
                        <span className="total-label">Total</span>
                        <span className="total-value">{formatCurrency(order.total, currencyCode)}</span>
                        <span className="date-badge">
                            Fecha: <strong>{formatDate(order.created_at || order.createdAt)}</strong> 📅
                        </span>
                    </div>
                </div>
            </div>

            <div className="admin-detail-content">
                <div className="detail-main">
                    <div className="detail-card invoice-card">
                        
                        
                        <div className="invoice-container-full">
                            
                            <Invoice 
                                order={order}
                                customerInfo={{
                                    firstName: order.customer_name?.split(' ')[0] || '',
                                    lastName: order.customer_name?.split(' ').slice(1).join(' ') || '',
                                    email: order.customer_email,
                                    address: order.shipping_street,
                                    sector: order.shipping_sector,
                                    city: order.shipping_city,
                                    phone: order.customer_phone,
                                    paymentMethod: order.payment_method,
                                    shippingCost: order.shipping_cost,
                                    shippingDistance: order.shipping_distance,
                                    shippingCoordinates: order.shipping_coordinates
                                }}
                                items={order.items || []}
                                onClose={onClose}
                                showSuccess={false}
                                onStatusChange={(newStatus) => onStatusChange(order.id, newStatus)}
                                siteName={siteName}
                                siteIcon={siteIcon}
                                currencyCode={currencyCode}
                            />
                            
                        </div>
                        
                    </div>
                </div>

                <div className="detail-sidebar">
                    <div className="detail-card status-card">
                        <h3>📦 Información de Envío</h3>
                        <div className="status-pills">
                            {steps.slice(0, 4).map((step, index) => {
                                const isActive = step.id === order.status;
                                const isCompleted = currentStatusIndex >= 0 && index <= currentStatusIndex;
                                return (
                                    <button
                                        type="button"
                                        key={step.id}
                                        className={`status-pill ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                                        onClick={() => onStatusChange(order.id, step.id)}
                                    >
                                        {step.label}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="status-select-row">
                            <label>Cambiar Estado</label>
                            <select
                                value={order.status}
                                onChange={(e) => onStatusChange(order.id, e.target.value)}
                                className="admin-status-select"
                            >
                                {steps.map(s => (
                                    <option key={s.id} value={s.id}>{s.icon} {s.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="action-buttons">
                            <button className="admin-btn primary full-width" onClick={() => onStatusChange(order.id, order.status)}>
                                🔄 Cambiar Estado
                            </button>
                            <button className="admin-btn success full-width" onClick={() => onStatusChange(order.id, 'paid')}>
                                ✓ Confirmar Pago
                            </button>
                            <button className="admin-btn danger full-width" onClick={() => onDelete && onDelete(order.id)}>
                                ❌ Cancelar Orden
                            </button>
                        </div>
                    </div>

                    <div className="detail-card shipping-card">
                        <h3>🚚 Información de Envío</h3>
                        
                        {/* Shipping cost and distance info */}
                        {(order.shipping_cost > 0 || order.shipping_distance) && (
                            <div className="shipping-cost-info">
                                {order.shipping_distance && (
                                    <div className="info-row">
                                        <strong>📏 Distancia</strong>
                                        <span>{Number(order.shipping_distance).toFixed(2)} km</span>
                                    </div>
                                )}
                                {order.shipping_cost > 0 && (
                                    <div className="info-row highlight">
                                        <strong>💵 Costo Envío</strong>
                                        <span>{formatCurrency(order.shipping_cost, currencyCode)}</span>
                                    </div>
                                )}
                                {order.shipping_coordinates && (
                                    <div className="info-row coordinates">
                                        <strong>📍 Coordenadas</strong>
                                        <span>
                                            {(() => {
                                                try {
                                                    const coords = typeof order.shipping_coordinates === 'string' 
                                                        ? JSON.parse(order.shipping_coordinates) 
                                                        : order.shipping_coordinates;
                                                    return `${coords.lat?.toFixed(6)}, ${coords.lng?.toFixed(6)}`;
                                                } catch {
                                                    return 'N/A';
                                                }
                                            })()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {showTrackingForm ? (
                            <div className="tracking-form-container">
                                <div className="form-group">
                                    <label>Transportista</label>
                                    <input 
                                        type="text" 
                                        value={trackingData.carrier}
                                        onChange={e => setTrackingData({...trackingData, carrier: e.target.value})}
                                        placeholder="Ej. DHL, Mensajero Local..."
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Número de Guía</label>
                                    <input 
                                        type="text" 
                                        value={trackingData.trackingNumber}
                                        onChange={e => setTrackingData({...trackingData, trackingNumber: e.target.value})}
                                        placeholder="Ej. 12345678"
                                    />
                                </div>
                                <div className="form-actions">
                                    <button className="admin-btn ghost sm" onClick={() => setShowTrackingForm(false)}>Cancelar</button>
                                    <button className="admin-btn primary sm" onClick={handleTrackingSubmit}>Guardar</button>
                                </div>
                            </div>
                        ) : (
                            <div className="shipping-info-display">
                                {order.carrier ? (
                                    <>
                                        <div className="info-row">
                                            <strong>Transportista</strong>
                                            <span>{order.carrier}</span>
                                        </div>
                                        <div className="info-row">
                                            <strong>No. Guía</strong>
                                            <span>{order.tracking_number}</span>
                                        </div>
                                        <button className="admin-btn ghost sm full-width" onClick={() => setShowTrackingForm(true)}>Editar Tracking</button>
                                    </>
                                ) : (
                                    <>
                                        <p className="helper-text">Estimar cuando el pago esté confirmado.</p>
                                        <button className="admin-btn primary sm full-width" onClick={() => setShowTrackingForm(true)}>Añadir Datos de Envío</button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="detail-card notes-card">
                        <h3>📝 Notas Internas</h3>
                        <div className="note-display">
                            <div className="note-author">
                                <div className="avatar">👤</div>
                                <div className="note-meta">
                                    <strong>Admin</strong>
                                    <span className="note-subtitle">Admin</span>
                                </div>
                            </div>
                            <div className="note-content">
                                {internalNotes || 'Nota interna de prueba (prácticamente, solo visible para el administrador).'}
                            </div>
                        </div>
                        <button className="admin-btn primary full-width add-note-btn">
                            + Agregar Nota
                        </button>
                        <p className="helper-text">Información privada para administración.</p>
                        <textarea
                            value={internalNotes}
                            onChange={(e) => setInternalNotes(e.target.value)}
                            placeholder="Añade notas sobre el despacho, problemas, etc."
                            rows="6"
                        />
                        <button 
                            className="admin-btn primary full-width" 
                            onClick={() => onSaveNotes(order.id, internalNotes)}
                            disabled={isSubmitting || internalNotes === order.internal_notes}
                        >
                            {isSubmitting ? 'Guardando...' : 'Guardar Nota'}
                        </button>
                    </div>
                </div>
            </div>

            
        </div>
    );
}