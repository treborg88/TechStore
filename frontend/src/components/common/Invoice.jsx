import React, { useState, useCallback } from 'react';
import { pdf } from '@react-pdf/renderer';
import '../../print.css';
import './Invoice.css';
import { formatCurrency } from '../../utils/formatCurrency';
import { STATUS_CONFIG, PAYMENT_METHODS, buildInvoiceData, getPaymentStatusLabel } from '../../utils/invoiceUtils';
import InvoicePDF from './InvoicePDF';

const PaymentInstructions = ({ order, paymentMethod, invoiceData }) => {
    const config = PAYMENT_METHODS[paymentMethod]?.instructions;
    if (!config) return null;

    const methodConfig = PAYMENT_METHODS[paymentMethod];

    return (
        <div className="invoice-payment-instructions no-print">
            <div className="invoice-payment-header">
                <span className="invoice-payment-title">
                    {methodConfig.icon} {methodConfig.label}
                </span>
                <span className="invoice-payment-tag">
                    {paymentMethod === 'cash' ? 'Orden: ' : 'Referencia: '}
                    {order.order_number || `#${order.id}`}
                </span>
            </div>

            <div className="invoice-payment-grid">
                {config.fields.map((field, idx) => (
                    <div key={idx}>
                        <p className="invoice-payment-label">{field.label}</p>
                        <p className="invoice-payment-value">
                            {field.getValue ? field.getValue(order) : field.value}
                        </p>
                    </div>
                ))}
                <div>
                    <p className="invoice-payment-label">{config.amountLabel}</p>
                    <p className="invoice-payment-amount">
                        {formatCurrency(invoiceData.total, invoiceData.currency)}
                    </p>
                </div>
            </div>

            <div className="invoice-payment-note-box">
                <span className="invoice-payment-note-icon">{config.note.icon}</span>
                <p className="invoice-payment-note-text">
                    <strong>{config.note.highlight}</strong> {typeof config.note.text === 'function' ? config.note.text(order) : config.note.text}
                </p>
            </div>
        </div>
    );
};

const STATUS_STEPS = [
    { id: 'pending_payment', ...STATUS_CONFIG.pending_payment },
    { id: 'paid', ...STATUS_CONFIG.paid },
    { id: 'to_ship', ...STATUS_CONFIG.to_ship },
    { id: 'shipped', ...STATUS_CONFIG.shipped },
    { id: 'delivered', ...STATUS_CONFIG.delivered }
];

const COD_STATUS_STEPS = [
    { id: 'to_ship', ...STATUS_CONFIG.to_ship },
    { id: 'shipped', ...STATUS_CONFIG.shipped },
    { id: 'delivered', ...STATUS_CONFIG.delivered },
    { id: 'paid', ...STATUS_CONFIG.paid }
];

// StatusTag genérico para mostrar el estado de la orden
const StatusTag = ({ status }) => {
    const config = STATUS_CONFIG[status] || { label: status, icon: '' };
    return (
        <div className={`status-tag status-${status}`}>
            {config.icon} {config.label}
        </div>
    );
};

// PaymentStatusTag: muestra el estado de pago considerando el método de pago
const PaymentStatusTag = ({ status, paymentMethod }) => {
    const label = getPaymentStatusLabel(status, paymentMethod);
    const isPaid = ['paid', 'delivered'].includes(status);
    const isCODPending = paymentMethod === 'cash' && !isPaid;
    
    // Determinar estilo visual basado en el estado
    const getStatusClass = () => {
        if (isPaid) return 'paid';
        if (isCODPending) return 'cod-pending';
        return 'pending_payment';
    };
    
    // Icono según el estado
    const getIcon = () => {
        if (isPaid) return '💰';
        if (isCODPending) return '💵';
        return '⏳';
    };
    
    return (
        <div className={`status-tag status-${getStatusClass()}`}>
            {getIcon()} {label}
        </div>
    );
};

const StatusStepper = ({ currentStatus, paymentMethod, onStatusChange }) => {
    const steps = paymentMethod === 'cash' ? COD_STATUS_STEPS : STATUS_STEPS;
    const currentIdx = steps.findIndex(s => s.id === currentStatus);
    
    return (
        <div className="order-status-stepper">
            {steps.map((step, index) => {
                const isCompleted = currentIdx >= index;
                const isActive = currentStatus === step.id;
                const isNext = currentIdx + 1 === index;
                
                return (
                    <div 
                        key={step.id} 
                        className={`status-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''} ${isNext ? 'clickable' : ''}`}
                        onClick={() => isNext && onStatusChange(step.id)}
                        title={isNext ? `Cambiar a ${step.label}` : ''}
                    >
                        <span className="step-text">
                            {step.icon} {step.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

const Invoice = ({ order, customerInfo, items, onClose, showSuccess = true, onStatusChange, siteName = 'Mi Tienda Online', siteIcon = '🛒', currencyCode }) => {
  const isAuthenticated = !!localStorage.getItem('userData');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  const invoiceData = buildInvoiceData({
    order,
    customerInfo,
    items,
    siteName,
    siteIcon,
    currencyCode
  });

  // Handle PDF download manually for better error handling
  const handleDownloadPdf = useCallback(async () => {
    if (isGeneratingPdf) return;
    
    setIsGeneratingPdf(true);
    setPdfError(null);
    
    try {
      // Validate invoiceData before generating PDF
      if (!invoiceData || !invoiceData.items || invoiceData.items.length === 0) {
        throw new Error('No hay items para generar la factura');
      }

      // Generate PDF blob using React.createElement to avoid JSX issues
      const blob = await pdf(
        React.createElement(InvoicePDF, { invoiceData })
      ).toBlob();
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `factura-${order.order_number || order.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Cleanup URL object
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setPdfError(error.message || 'Error al generar el PDF. Intenta de nuevo.');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [invoiceData, order, isGeneratingPdf]);

    return (
        <div className="order-success printable-area">
            {showSuccess && (
                <>
                    <div className="success-icon no-print">✅</div>
                    <h2>¡Pedido Confirmado!</h2>
                    <p className="order-number">Orden {order.order_number || `#${order.id}`}</p>
                    <p className="success-message no-print">
                        Tu pedido ha sido recibido y está siendo procesado.
                        {!isAuthenticated && (
                            <><br/>📧 Recibirás la confirmación en <strong>{customerInfo.email}</strong></>
                        )}
                    </p>
                </>
            )}
            
            {/* Invoice Header for Print (HTML version - kept for consistency/fallback) */}
            <div className="invoice-container only-print">
                <div className="invoice-header-bg">
                    <div className="invoice-logo">
                        {siteIcon} <span>{siteName}</span>
                    </div>
                    <div className="company-info">
                        <p><strong>{siteName}</strong></p>
                        <p>Calle Principal #123, Santo Domingo</p>
                        <p>Tel: 809-555-1234 • RNC: 132080238</p>
                        <p>República Dominicana</p>
                    </div>
                </div>

                <div className="invoice-title-section">
                    <h1 className="invoice-title">FACTURA</h1>
                    <p className="invoice-number">No. {invoiceData.invoiceNumber}</p>
                  <p className="invoice-date">Fecha: {invoiceData.date}  {invoiceData.time}</p>
                </div>

                <div className="invoice-info-grid">
                    <div className="info-section">
                        <h4>Información del Cliente</h4>
                        <div className="info-row">
                            <span className="info-label">CLIENTE:</span>
                            <span className="info-value">{customerInfo.firstName} {customerInfo.lastName}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">RNC/CED:</span>
                            <span className="info-value">{customerInfo.identification || 'N/A'}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">DIRECCIÓN:</span>
                            <span className="info-value">{customerInfo.address}, {customerInfo.sector}, {customerInfo.city}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">TEL:</span>
                            <span className="info-value">{customerInfo.phone || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div className="info-section">
                        <h4>Información Adicional</h4>
                        <div className="info-row">
                            <span className="info-label">VENDEDOR:</span>
                            <span className="info-value">Sistema Online</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">TIPO PAGO:</span>
                            <span className="info-value">{invoiceData.paymentType}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">MONEDA:</span>
                          <span className="info-value">{invoiceData.currency}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">ESTADO DE PAGO:</span>
                            <span className="info-value">{invoiceData.paymentStatus}</span>
                        </div>
                    </div>
                </div>

                <h3 style={{marginTop: '20px', fontSize: '14px'}}>Detalle de Orden</h3>
                <div className="invoice-table-container">
                    <table className="invoice-table">
                        <thead>
                            <tr>
                                <th style={{width: '40%'}}>DESCRIPCIÓN</th>
                                <th style={{width: '12%'}}>CANTIDAD</th>
                                <th style={{width: '16%'}}>PRECIO UNITARIO</th>
                                <th style={{width: '16%'}}>% IMP.</th>
                                <th style={{width: '16%'}}>SUBTOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td>{item.name}</td>
                                    <td>{item.quantity} Unidades</td>
                                  <td>{formatCurrency(item.price, invoiceData.currency)}</td>
                                    <td></td>
                                  <td>{formatCurrency(item.price * item.quantity, invoiceData.currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="invoice-totals">
                    <div className="totals-box">
                        <br /><br />
                        <div className="subtotal-row">
                            <span>Subtotal:</span>
                          <span>{formatCurrency(invoiceData.subtotal, invoiceData.currency)}</span>
                        </div>
                        {invoiceData.shippingCost > 0 && (
                            <div className="total-row shipping-row">
                                <span>Envío:</span>
                                <span>{formatCurrency(invoiceData.shippingCost, invoiceData.currency)}</span>
                            </div>
                        )}
                        <div className="total-row grand-total">
                            <span>Total:</span>
                          <span>{formatCurrency(invoiceData.total, invoiceData.currency)}</span>
                        </div>
                    </div>
                </div>

                <div className="invoice-notes">
                    <h4>Notas</h4>
                    <p>• El producto llegará en perfecto estado</p>
                    <p>• Tiempo estimado de entrega: 1-3 días hábiles</p>
                    <p>• Garantía de satisfacción del cliente</p>
                </div>

                <div className="invoice-terms">
                    <h4>Términos y Condiciones</h4>
                    <p>• No hay devolución en Productos cortados, fuera del tiempo de garantía.</p>
                    <p>• La posesión de la factura no constituye prueba de pago, a menos que esta indique pagado.</p>
                    <p>• Para la validez de esta factura debe estar firmada por el Cliente.</p>
                    <p>• La fecha de entrega de los productos puede variar .</p>
                </div>

                <div className="signature-section">
                    <div className="signature-box">
                        <p>Cédula: _______________________</p>
                    </div>
                    <div className="signature-box">
                        <p>Firma: _______________________</p>
                    </div>
                </div>

                <div className="invoice-footer">
                    Gracias por su compra - {siteName} • República Dominicana
                </div>
            </div>

            {/* Professional Screen View */}
            <div className="invoice-screen-view no-print">
                {/* Status Stepper for Admin */}
                {!showSuccess && onStatusChange && (
                    <div className="order-status-stepper-wrapper">
                        {['cancelled', 'return', 'refund'].includes(order.status) ? (
                            <div className="special-status-banner">
                                {order.status === 'cancelled' && '❌ Esta orden ha sido CANCELADA'}
                                {order.status === 'return' && '↩️ Esta orden está en proceso de DEVOLUCIÓN'}
                                {order.status === 'refund' && '💸 Esta orden ha sido REEMBOLSADA'}
                            </div>
                        ) : (
                            <StatusStepper 
                                currentStatus={order.status} 
                                paymentMethod={customerInfo.paymentMethod} 
                                onStatusChange={onStatusChange} 
                            />
                        )}
                    </div>
                )}

                <div className="invoice-header">
                    <div className="invoice-logo">
                        {siteIcon} <span>{siteName}</span>
                    </div>
                    <div className="invoice-meta">
                        <h3>FACTURA</h3>
                        <p><strong>Orden:</strong> {order.order_number || `#${order.id}`}</p>
                        <p><strong>Fecha:</strong> {invoiceData.date} {invoiceData.time}</p>
                    </div>
                </div>

                <div className="invoice-addresses">
                    <div className="address-col">
                        <h4>Facturar a:</h4>
                        <p><strong>{customerInfo.firstName} {customerInfo.lastName}</strong></p>
                        <p>{customerInfo.email}</p>
                        <p>{customerInfo.phone}</p>
                    </div>
                    <div className="address-col">
                        <h4>Enviar a:</h4>
                        <p>{customerInfo.address}</p>
                        <p>{customerInfo.sector}, {customerInfo.city}</p>
                        <p>República Dominicana</p>
                    </div>
                </div>

                <div className="invoice-details-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Cant.</th>
                                <th>Precio</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td>{item.name}</td>
                                    <td>{item.quantity}</td>
                                <td>{formatCurrency(item.price, invoiceData.currency)}</td>
                                <td>{formatCurrency(item.price * item.quantity, invoiceData.currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="invoice-summary-footer">
                        <div className="payment-info-box">
                        <h4>Método de Pago</h4>
                        <p>
                            {PAYMENT_METHODS[customerInfo.paymentMethod]?.icon} {PAYMENT_METHODS[customerInfo.paymentMethod]?.label}
                        </p>
                        <PaymentStatusTag status={order.status} paymentMethod={customerInfo.paymentMethod} />
                    </div>
                    <div className="totals-box">
                        <div className="subtotal-row">
                            <span>Subtotal:</span>
                          <span>{formatCurrency(invoiceData.subtotal, invoiceData.currency)}</span>
                        </div>
                        {invoiceData.shippingCost > 0 && (
                            <div className="total-row shipping-row">
                                <span>Envío:</span>
                                <span>{formatCurrency(invoiceData.shippingCost, invoiceData.currency)}</span>
                            </div>
                        )}
                        <div className="total-row grand-total">
                            <span>TOTAL:</span>
                          <span>{formatCurrency(invoiceData.total, invoiceData.currency)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <PaymentInstructions 
                order={order} 
                paymentMethod={customerInfo.paymentMethod} 
                invoiceData={invoiceData} 
            />
            {showSuccess && !isAuthenticated && (
                <div className="guest-info no-print">
                    💡 <strong>Tip:</strong> Crea una cuenta para hacer seguimiento de tus pedidos.
                </div>
            )}
            
            <div className="success-actions no-print">
                <button 
                    className="print-invoice-btn" 
                    onClick={() => window.print()}
                >
                    🖨️ Imprimir Factura
                </button>
                <button
                    className="download-invoice-btn"
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                >
                    {isGeneratingPdf ? 'Generando PDF...' : '📄 Descargar Factura (PDF)'}
                </button>
                {pdfError && <span className="pdf-error-message">{pdfError}</span>}
                <button className="continue-shopping-btn" onClick={onClose}>
                    Continuar Comprando
                </button>
            </div>
        </div>
    );
};

export default Invoice;
