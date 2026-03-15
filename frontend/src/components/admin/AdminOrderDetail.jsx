import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import InvoicePDF from '../common/InvoicePDF';
import { formatCurrency } from '../../utils/formatCurrency';
import { PAYMENT_METHODS, buildInvoiceData } from '../../utils/invoiceUtils';
import { formatVariantLabel } from '../../utils/cartHelpers';
import { apiFetch, apiUrl } from '../../services/apiClient';
import toast from 'react-hot-toast';
import './AdminOrderDetail.css';

const ONLINE_ORDER_STEPS = [
    { id: 'pending_payment', label: 'Pendiente Pago', icon: '⏳', color: '#f59e0b' },
    { id: 'paid', label: 'Pagado', icon: '💰', color: '#10b981' },
    { id: 'to_ship', label: 'Para Enviar', icon: '📦', color: '#3b82f6' },
    { id: 'shipped', label: 'Enviado', icon: '🚚', color: '#8b5cf6' },
    { id: 'delivered', label: 'Entregado', icon: '✅', color: '#059669' }
];

const COD_ORDER_STEPS = [
    { id: 'to_ship', label: 'Para Enviar', icon: '📦', color: '#3b82f6' },
    { id: 'shipped', label: 'Enviado', icon: '🚚', color: '#8b5cf6' },
    { id: 'delivered', label: 'Entregado', icon: '✅', color: '#059669' },
    { id: 'paid', label: 'Pagado ✓', icon: '💰', color: '#10b981' }
];

// Extra status options shared by both flows
const EXTRA_STEPS = [
    { id: 'return', label: 'Devolución', icon: '↩️', color: '#6366f1' },
    { id: 'refund', label: 'Reembolso', icon: '💸', color: '#ec4899' },
    { id: 'cancelled', label: 'Cancelado', icon: '❌', color: '#ef4444' }
];

// All steps combined for status badge lookup
const ALL_STEPS = [...ONLINE_ORDER_STEPS, ...EXTRA_STEPS];

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
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showShippingSlip, setShowShippingSlip] = useState(false);
    const [shippingSlipEnabled, setShippingSlipEnabled] = useState(false);

    // Leer toggle de cartilla de envío desde admin settings
    useEffect(() => {
        const loadSlipSetting = async () => {
            try {
                const res = await apiFetch(apiUrl('/settings'));
                if (!res.ok) return;
                const data = await res.json();
                // El endpoint /settings retorna un objeto { key: value }
                const val = data?.shippingSlipEnabled;
                setShippingSlipEnabled(val === 'true' || val === true);
            } catch { /* ignorar */ }
        };
        loadSlipSetting();
    }, []);

    const isCOD = order.payment_method === 'cash';

    // Helper: check completed/active state for a step within a given flow
    const getStepState = (step, flowSteps) => {
        const flowIndex = flowSteps.findIndex(s => s.id === step.id);
        const currentIndex = flowSteps.findIndex(s => s.id === order.status);
        const isActive = step.id === order.status;
        const isCompleted = currentIndex >= 0 && flowIndex >= 0 && flowIndex <= currentIndex;
        return { isActive, isCompleted };
    };

    // Disable "Confirmar Pago" if already paid
    const activeFlow = isCOD ? COD_ORDER_STEPS : ONLINE_ORDER_STEPS;
    const paidIndex = activeFlow.findIndex(s => s.id === 'paid');
    const currentIdx = activeFlow.findIndex(s => s.id === order.status);
    const isAlreadyPaid = currentIdx >= 0 && paidIndex >= 0 && currentIdx >= paidIndex;
    const items = useMemo(() => order.items || [], [order.items]);

    // Build customer info and invoice data for PDF generation
    const customerInfo = useMemo(() => ({
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
    }), [order.customer_name, order.customer_email, order.shipping_street, order.shipping_sector, order.shipping_city, order.customer_phone, order.payment_method, order.shipping_cost, order.shipping_distance, order.shipping_coordinates]);
    
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

    // Payment method label helper
    const paymentLabel = PAYMENT_METHODS[order.payment_method]?.label || 'Pendiente';
    const paymentIcon = PAYMENT_METHODS[order.payment_method]?.icon || '💳';

    // Subtotal calculation
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
    const shippingCost = Number(order.shipping_cost) || 0;
    const total = (Number(order.total) || 0) + shippingCost;

    // PDF Download handler
    const handleDownloadPdf = useCallback(async () => {
        if (isGeneratingPdf) return;
        setIsGeneratingPdf(true);
        try {
            const invoiceData = buildInvoiceData({ order, customerInfo, items, siteName, siteIcon, currencyCode });
            const blob = await pdf(React.createElement(InvoicePDF, { invoiceData })).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `factura-${order.order_number || order.id}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error generating PDF:', error);
        } finally {
            setIsGeneratingPdf(false);
        }
    }, [order, customerInfo, items, siteName, siteIcon, currencyCode, isGeneratingPdf]);

    // --- Cartilla de Envío: genera texto plano con datos del envío ---
    const buildShippingSlipText = useCallback(() => {
        const lines = [];
        lines.push(`📦 CARTILLA DE ENVÍO — ${siteName || 'Tienda'}`);
        lines.push(`Orden: ${order.order_number || order.id}`);
        lines.push(`Fecha: ${formatDate(order.created_at)}`);
        lines.push('─'.repeat(30));

        // Cliente
        lines.push(`\n👤 Cliente: ${order.customer_name || '—'}`);
        if (order.customer_phone) lines.push(`📞 Tel: ${order.customer_phone}`);
        if (order.customer_email) lines.push(`✉️ Email: ${order.customer_email}`);

        // Dirección
        const addressParts = [order.shipping_street, order.shipping_sector, order.shipping_city].filter(Boolean);
        if (addressParts.length) lines.push(`\n📍 Dirección: ${addressParts.join(', ')}`);

        // Google Maps link
        if (order.shipping_coordinates) {
            try {
                const coords = typeof order.shipping_coordinates === 'string'
                    ? JSON.parse(order.shipping_coordinates) : order.shipping_coordinates;
                if (coords?.lat && coords?.lng) {
                    lines.push(`🗺️ Mapa: https://www.google.com/maps?q=${coords.lat},${coords.lng}`);
                }
            } catch { /* ignorar */ }
        }

        // Productos
        lines.push(`\n${'─'.repeat(30)}`);
        lines.push('🛒 Productos:');
        items.forEach(item => {
            const variant = item.variant ? ` (${formatVariantLabel(item.variant)})` : '';
            lines.push(`  • ${item.name}${variant} x${item.quantity} — ${formatCurrency(item.price * item.quantity, currencyCode)}`);
        });

        // Totales
        lines.push(`\n${'─'.repeat(30)}`);
        lines.push(`Subtotal: ${formatCurrency(subtotal, currencyCode)}`);
        if (shippingCost > 0) {
            lines.push(`Envío: ${formatCurrency(shippingCost, currencyCode)}`);
            if (order.shipping_distance) lines.push(`Distancia: ${Number(order.shipping_distance).toFixed(2)} km`);
        }
        lines.push(`TOTAL: ${formatCurrency(total, currencyCode)}`);

        // Método de pago
        lines.push(`\n💳 Pago: ${paymentLabel}`);
        if (order.carrier) lines.push(`🚛 Transportista: ${order.carrier}`);
        if (order.tracking_number) lines.push(`📋 Guía: ${order.tracking_number}`);

        return lines.join('\n');
    }, [order, items, siteName, currencyCode, subtotal, shippingCost, total, paymentLabel]);

    // Copiar cartilla al portapapeles
    const handleCopySlip = useCallback(async () => {
        try {
            const text = buildShippingSlipText();
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            toast.success('Cartilla copiada al portapapeles');
        } catch {
            toast.error('No se pudo copiar');
        }
    }, [buildShippingSlipText]);

    // Compartir cartilla (Web Share API con fallback a copiar)
    const handleShareSlip = useCallback(async () => {
        const text = buildShippingSlipText();
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Envío ${order.order_number || order.id}`,
                    text
                });
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
            }
        }
        // Fallback: copiar
        await handleCopySlip();
    }, [buildShippingSlipText, handleCopySlip, order]);

    return (
        <div className="admin-order-detail-page">
            {/* Header card with order ID, status, total */}
            <div className="admin-order-summary-card">
                <div className="summary-header">
                    <div className="header-left">
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
                            {ALL_STEPS.find(s => s.id === order.status)?.icon} {ALL_STEPS.find(s => s.id === order.status)?.label || order.status}
                        </span>
                    </div>
                    <div className="header-right">
                        <span className="total-label">Total</span>
                        <span className="total-value">{formatCurrency(total, currencyCode)}</span>
                        <span className="date-badge">
                            📅 {formatDate(order.created_at || order.createdAt)}
                        </span>
                    </div>
                </div>
            </div>

            <div className="admin-detail-content">
                {/* Main content: order info cards */}
                <div className="detail-main">

                    {/* Unified order info block */}
                    <div className="detail-card order-info-block">
                        {/* Customer section */}
                        <div className="order-section">
                            <h3 className="card-section-header">👤 Cliente</h3>
                            <div className="admin-info-grid">
                                <div className="admin-info-item">
                                    <span className="admin-info-label">Nombre</span>
                                    <span className="admin-info-value">{order.customer_name || '—'}</span>
                                </div>
                                <div className="admin-info-item">
                                    <span className="admin-info-label">Email</span>
                                    <span className="admin-info-value">{order.customer_email || '—'}</span>
                                </div>
                                <div className="admin-info-item">
                                    <span className="admin-info-label">Teléfono</span>
                                    <span className="admin-info-value">{order.customer_phone || '—'}</span>
                                </div>
                                <div className="admin-info-item">
                                    <span className="admin-info-label">Dirección</span>
                                    <span className="admin-info-value">
                                        {[order.shipping_street, order.shipping_sector, order.shipping_city]
                                            .filter(Boolean).join(', ') || '—'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Products section */}
                        <div className="order-section">
                            <h3 className="card-section-header">📦 Productos ({items.length})</h3>
                            <div className="admin-items-list">
                                {items.map((item, idx) => {
                                    const variantLabel = formatVariantLabel(item.variant_attributes);
                                    return (
                                        <div className="admin-item-row" key={item.id || idx}>
                                            <div className="admin-item-info">
                                                <span className="admin-item-name">
                                                    {item.name}
                                                    {variantLabel && <span className="admin-item-variant"> — {variantLabel}</span>}
                                                </span>
                                                <span className="admin-item-qty">× {item.quantity}</span>
                                            </div>
                                            <span className="admin-item-price">
                                                {formatCurrency(item.price * item.quantity, currencyCode)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Totals */}
                            <div className="admin-totals">
                                <div className="admin-total-row">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(subtotal, currencyCode)}</span>
                                </div>
                                {shippingCost > 0 && (
                                    <div className="admin-total-row">
                                        <span>Envío</span>
                                        <span>{formatCurrency(shippingCost, currencyCode)}</span>
                                    </div>
                                )}
                                <div className="admin-total-row admin-grand-total">
                                    <span>Total</span>
                                    <span>{formatCurrency(total, currencyCode)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Payment section */}
                        <div className="order-section">
                            <h3 className="card-section-header">💳 Pago</h3>
                            <div className="admin-info-grid payment-row">
                                <div className="admin-info-item">
                                    <span className="admin-info-label">Método</span>
                                    <span className="admin-info-value">{paymentIcon} {paymentLabel}</span>
                                </div>
                                <div className="admin-info-item">
                                    <span className="admin-info-label">Estado</span>
                                    <span className="admin-info-value">
                                        {ALL_STEPS.find(s => s.id === order.status)?.icon} {ALL_STEPS.find(s => s.id === order.status)?.label || order.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Print / Download actions */}
                    <div className="detail-card admin-doc-actions">
                        <button className="admin-btn ghost full-width" onClick={() => window.print()}>
                            🖨️ Imprimir Factura
                        </button>
                        <button 
                            className="admin-btn ghost full-width" 
                            onClick={handleDownloadPdf}
                            disabled={isGeneratingPdf}
                        >
                            {isGeneratingPdf ? '⏳ Generando...' : '📄 Descargar PDF'}
                        </button>
                    </div>
                </div>

                {/* Sidebar: status management, shipping, notes */}
                <div className="detail-sidebar">
                    <div className="detail-card status-card">
                        <h3>📦 Estado de la Orden</h3>

                        {/* Show only the flow matching this order's payment method */}
                        <div className="flow-label">
                            {isCOD ? '💵 Contra entrega' : '💳 Pago en línea'}
                        </div>
                        <div className="status-pills">
                            {(isCOD ? COD_ORDER_STEPS : ONLINE_ORDER_STEPS).map((step) => {
                                const { isActive, isCompleted } = getStepState(step, isCOD ? COD_ORDER_STEPS : ONLINE_ORDER_STEPS);
                                return (
                                    <button
                                        type="button"
                                        key={step.id}
                                        className={`status-pill ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                                        onClick={() => onStatusChange(order.id, step.id)}
                                    >
                                        {step.icon} {step.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Collapsible extra options: return, refund, cancelled */}
                        <details className="more-options-toggle">
                            <summary>⚙️ Más opciones</summary>
                            <div className="status-pills extra-pills">
                                {EXTRA_STEPS.map((step) => {
                                    const isActive = step.id === order.status;
                                    return (
                                        <button
                                            type="button"
                                            key={step.id}
                                            className={`status-pill ${isActive ? 'active' : ''}`}
                                            onClick={() => onStatusChange(order.id, step.id)}
                                        >
                                            {step.icon} {step.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </details>

                        <div className="action-buttons">
                            <button
                                className="admin-btn success full-width"
                                onClick={() => onStatusChange(order.id, 'paid')}
                                disabled={isAlreadyPaid}
                            >
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
                                {/* Open Google Maps directions to the delivery coordinates */}
                                {order.shipping_coordinates && (
                                    <button
                                        className="admin-btn primary sm full-width"
                                        onClick={() => {
                                            try {
                                                const coords = typeof order.shipping_coordinates === 'string'
                                                    ? JSON.parse(order.shipping_coordinates)
                                                    : order.shipping_coordinates;
                                                window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`, '_blank');
                                            } catch { /* ignore */ }
                                        }}
                                    >
                                        📍 Abrir en el Mapa
                                    </button>
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
                                        <button className="admin-btn primary sm full-width" onClick={() => setShowTrackingForm(true)}>Añadir Datos de Envío</button>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Botón de cartilla de envío (configurable desde admin) */}
                        {shippingSlipEnabled && (
                            <button
                                className="admin-btn primary sm full-width shipping-slip-trigger"
                                onClick={() => setShowShippingSlip(true)}
                            >
                                📋 Cartilla de Envío
                            </button>
                        )}
                    </div>

                    <div className="detail-card notes-card">
                        <h3>📝 Notas Internas</h3>
                        <p className="helper-text">Información privada para administración.</p>
                        <textarea
                            value={internalNotes}
                            onChange={(e) => setInternalNotes(e.target.value)}
                            placeholder="Añade notas sobre el despacho, problemas, etc."
                            rows="4"
                        />
                        <button 
                            className="admin-btn primary full-width" 
                            onClick={() => onSaveNotes(order.id, internalNotes)}
                            disabled={isSubmitting || internalNotes === order.internal_notes}
                        >
                            {isSubmitting ? 'Guardando...' : '💾 Guardar Nota'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Cartilla de Envío */}
            {showShippingSlip && (
                <div className="shipping-slip-overlay" onClick={() => setShowShippingSlip(false)}>
                    <div className="shipping-slip-modal" onClick={e => e.stopPropagation()}>
                        <div className="shipping-slip-header">
                            <h3>📋 Cartilla de Envío</h3>
                            <button className="shipping-slip-close" onClick={() => setShowShippingSlip(false)}>✕</button>
                        </div>
                        <pre className="shipping-slip-content">{buildShippingSlipText()}</pre>
                        <div className="shipping-slip-actions">
                            <button className="admin-btn primary" onClick={handleCopySlip}>📋 Copiar</button>
                            <button className="admin-btn ghost" onClick={handleShareSlip}>🔗 Compartir</button>
                            {/* Botón que abre Google Maps si la orden tiene coordenadas */}
                            {order.shipping_coordinates && (() => {
                                try {
                                    const coords = typeof order.shipping_coordinates === 'string'
                                        ? JSON.parse(order.shipping_coordinates) : order.shipping_coordinates;
                                    if (coords?.lat && coords?.lng) {
                                        return (
                                            <button
                                                className="admin-btn ghost"
                                                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`, '_blank')}
                                            >
                                                🗺️ Mapa
                                            </button>
                                        );
                                    }
                                } catch { /* ignorar */ }
                                return null;
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}