import React from 'react';
import { PDFDownloadLink, Document, Page, Text, View, pdf } from '@react-pdf/renderer';
import '../../print.css';
import './Invoice.css';
import styles from './InvoicePdfStyles';
import { formatCurrency } from '../../utils/formatCurrency';

// PDF Document Component
const InvoicePDF = ({ invoiceData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header with company info */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>{invoiceData.companyName}</Text>
          <Text style={{fontSize: 8, color: '#6B7280', marginTop: 4}}>
            {invoiceData.companyAddress}
          </Text>
          <Text style={{fontSize: 8, color: '#6B7280'}}>
            Tel: {invoiceData.companyPhone}
          </Text>
          <Text style={{fontSize: 8, color: '#6B7280'}}>
            RNC: {invoiceData.companyRNC}
          </Text>
        </View>
        <View style={styles.invoiceNumberBox}>
          <Text style={styles.invoiceTitle}>FACTURA</Text>
          <Text style={styles.invoiceNumber}>No. {invoiceData.invoiceNumber}</Text>
          <Text style={styles.invoiceDate}>Fecha: {invoiceData.date}  {invoiceData.time}</Text>
        </View>
      </View>

      {/* Customer Information */}
      <View style={styles.infoGrid}>
        <View style={styles.infoBoxWide}>
          <Text style={styles.infoLabel}>Información del Cliente</Text>
          <Text style={styles.infoValue}>CLIENTE: {invoiceData.customerName}</Text>
          <Text style={styles.infoValue}>RNC/CED: {invoiceData.customerID || 'N/A'}</Text>
          <Text style={styles.infoValue}>DIRECCIÓN: {invoiceData.customerAddress}</Text>
          <Text style={styles.infoValue}>TEL: {invoiceData.customerPhone}</Text>
        </View>
        
        <View style={styles.infoBoxNarrow}>
          <Text style={styles.infoLabel}>Detalles del Pedido</Text>
          <Text style={styles.infoValue}>VENDEDOR: {invoiceData.seller}</Text>
          <Text style={styles.infoValue}>TIPO PAGO: {invoiceData.paymentType}</Text>
          <Text style={styles.infoValue}>MONEDA: {invoiceData.currency}</Text>
          <Text style={styles.infoValue}>ESTADO DE PAGO: {invoiceData.paymentStatus}</Text>
        </View>
      </View>

      {/* Product Details Table */}
      <Text style={{fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 8, marginTop: 5}}>
        Detalle de Orden
      </Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.col1}>DESCRIPCIÓN</Text>
          <Text style={styles.col2}>CANTIDAD</Text>
          <Text style={styles.col3}>PRECIO UNITARIO</Text>
          <Text style={styles.col4}>% IMP.</Text>
          <Text style={styles.col5}>SUBTOTAL</Text>
        </View>

        {invoiceData.items.map((item, index) => (
          <View key={index} style={[styles.tableRow, index % 2 === 0 ? {} : styles.tableRowEven]}>
            <Text style={styles.col1}>{item.description}</Text>
            <Text style={styles.col2}>{item.quantity} Unidades</Text>
            <Text style={styles.col3}>{formatCurrency(item.unitPrice, invoiceData.currency)}</Text>
            <Text style={styles.col4}></Text>
            <Text style={styles.col5}>{formatCurrency(item.amount, invoiceData.currency)}</Text>
          </View>
        ))}
      </View>

      {/* Economic Summary */}
      <View style={{marginTop: 15, alignItems: 'flex-end'}}>
        <Text style={{fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 8}}>
          {"\n\n"}
        </Text>
        <View style={{width: '40%'}}>
          <View style={styles.summaryRow}>
            <Text style={{...styles.summaryLabel, width: '60%'}}>Subtotal:</Text>
            <Text style={{...styles.summaryValue, width: '40%'}}>
              {formatCurrency(invoiceData.total, invoiceData.currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={{...styles.totalLabel, width: '60%'}}>Total:</Text>
            <Text style={{...styles.totalValue, width: '40%'}}>
              {formatCurrency(invoiceData.total, invoiceData.currency)}
            </Text>
          </View>
        </View>
      </View>

      {/* Notes Section */}
      <View style={styles.notesSection}>
        <Text style={styles.notesTitle}>Notas</Text>
        <Text style={styles.notesText}>
          • El producto llegará en perfecto estado{'\n'}
          • Tiempo estimado de entrega: {invoiceData.deliveryTime}{'\n'}
          • Garantía de satisfacción del cliente
        </Text>
      </View>

      {/* Terms and Conditions */}
      <View style={styles.termsSection}>
        <Text style={styles.termsTitle}>Términos y Condiciones</Text>
        <Text style={styles.termsList}>
          • No hay devolución en Productos cortados, fabricados o importados a medida.{'\n'}
          • La posesión de la factura no constituye prueba de pago.{'\n'}
          • Para la validez de esta factura debe estar sellada y firmada por Caja y Cliente.{'\n'}
          • La fecha de entrega de los productos puede variar por la importación.
        </Text>
      </View>

      {/* Signature Section */}
      <View style={styles.signatureSection}>
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLabel}>Cédula:</Text>
          <View style={styles.signatureLine} />
        </View>
        <View style={styles.signatureBox}>
          <Text style={styles.signatureLabel}>Firma:</Text>
          <View style={styles.signatureLine} />
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        Gracias por su compra - {invoiceData.companyName} • {invoiceData.companyLocation}
      </Text>
    </Page>
  </Document>
);

const STATUS_CONFIG = {
    pending_payment: { label: 'Pendiente de Pago', icon: '⏳', color: '#f59e0b' },
    paid: { label: 'Pagado', icon: '💰', color: '#10b981' },
    to_ship: { label: 'Para Enviar', icon: '📦', color: '#3b82f6' },
    shipped: { label: 'Enviado', icon: '🚚', color: '#8b5cf6' },
    delivered: { label: 'Entregado', icon: '✅', color: '#10b981' },
    return: { label: 'Devolución', icon: '↩️', color: '#ef4444' },
    refund: { label: 'Reembolso', icon: '💸', color: '#6366f1' },
    cancelled: { label: 'Cancelado', icon: '❌', color: '#6b7280' }
};

const PAYMENT_METHODS = {
    cash: { 
        label: 'Pago Contra Entrega', 
        icon: '💵', 
        detail: 'Efectivo al Recibir',
        instructions: {
            fields: [
                { label: 'Tipo de Pago', value: 'Efectivo al Recibir' },
                { label: 'Estado del Pedido', getValue: (order) => ['paid', 'delivered'].includes(order.status) ? 'Pagado' : 'Pendiente de Pago' },
                { label: 'Referencia', getValue: (order) => order.order_number || order.id }
            ],
            amountLabel: 'Total a Pagar',
            note: {
                icon: '💡',
                text: 'Por favor, prepara el monto exacto para facilitar el proceso de entrega.',
                highlight: 'Tip:'
            }
        }
    },
    transfer: { 
        label: 'Transferencia Bancaria', 
        icon: '🏦', 
        detail: 'Transferencia Bancaria',
        instructions: {
            fields: [
                { label: 'Banco', value: 'Banco Ejemplo' },
                { label: 'Titular', value: 'Mi Tienda Online' },
                { label: 'Cuenta / CLABE', value: '1234-5678-9012-3456' }
            ],
            amountLabel: 'Monto a Pagar',
            note: {
                icon: '⚠️',
                text: (order) => `Envía tu comprobante de pago por correo a pagos@mitienda.com o por WhatsApp para validar tu orden. Indica el número de orden #${order.id} en el mensaje.`,
                highlight: 'Importante:'
            }
        }
    },
    online: { label: 'Pago en Línea', icon: '💳', detail: 'Pago en Línea' },
    card: { label: 'Tarjeta de Crédito/Débito', icon: '💳', detail: 'Tarjeta' }
};

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
                        {formatCurrency(order.total, invoiceData.currency)}
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

const StatusTag = ({ status }) => {
    const config = STATUS_CONFIG[status] || { label: status, icon: '' };
    return (
        <div className={`status-tag status-${status}`}>
            {config.icon} {config.label}
        </div>
    );
};

export const buildInvoiceData = ({
  order,
  customerInfo,
  items,
  siteName = 'Mi Tienda Online',
  siteIcon = '🛒',
  currencyCode
}) => {
  const orderDate = order?.created_at ? new Date(order.created_at) : new Date();
  const currentDate = orderDate.toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const currentTime = orderDate.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true });

  return {
    companyName: siteName,
    companyIcon: siteIcon,
    companyAddress: 'Calle Principal #123, Santo Domingo',
    companyPhone: '829-334-6358',
    companyRNC: '123456789',
    companyLocation: 'República Dominicana',
    invoiceNumber: order?.order_number || `COT/${order?.id?.toString().padStart(6, '0')}`,
    date: currentDate,
    time: currentTime,
    customerName: `${customerInfo?.firstName || ''} ${customerInfo?.lastName || ''}`.trim(),
    customerEmail: customerInfo?.email || '',
    customerPhone: customerInfo?.phone || 'N/A',
    customerAddress: `${customerInfo?.address || ''}, ${customerInfo?.sector || ''}, ${customerInfo?.city || ''}`.replace(/^,\s*|,\s*,/g, '').trim(),
    customerID: customerInfo?.identification || 'N/A',
    seller: 'Sistema Online',
    paymentType: PAYMENT_METHODS[customerInfo?.paymentMethod]?.label || 'Pendiente',
    paymentStatus: ['paid', 'delivered'].includes(order?.status) ? 'Pagado' : 'Pendiente',
    deliveryTime: '3-5 días hábiles',
    currency: currencyCode || 'USD',
    source: order?.order_number || order?.id?.toString(),
    items: (items || []).map(item => ({
      description: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      taxPercent: '',
      taxes: '',
      amount: item.price * item.quantity
    })),
    total: order?.total || 0
  };
};

export const generateInvoicePdfBlob = async (invoiceData) => {
  const blob = await pdf(<InvoicePDF invoiceData={invoiceData} />).toBlob();
  return blob;
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

  const invoiceData = buildInvoiceData({
    order,
    customerInfo,
    items,
    siteName,
    siteIcon,
    currencyCode
  });

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
                        <div className="total-row">
                            <span>Subtotal:</span>
                          <span>{formatCurrency(invoiceData.total, invoiceData.currency)}</span>
                        </div>
                        <div className="total-row final">
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
                        <StatusTag status={order.status} />
                    </div>
                    <div className="totals-box">
                        <div className="total-row">
                            <span>Subtotal:</span>
                          <span>{formatCurrency(order.total, invoiceData.currency)}</span>
                        </div>
                        <div className="total-row grand-total">
                            <span>TOTAL:</span>
                          <span>{formatCurrency(order.total, invoiceData.currency)}</span>
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
                <PDFDownloadLink
                    document={<InvoicePDF invoiceData={invoiceData} />}
                    fileName={`factura-${order.id}.pdf`}
                    className="download-invoice-btn"
                >
                    {({ loading }) => (loading ? 'Generando PDF...' : '📄 Descargar Factura (PDF)')}
                </PDFDownloadLink>
                <button className="continue-shopping-btn" onClick={onClose}>
                    Continuar Comprando
                </button>
            </div>
        </div>
    );
};

export default Invoice;
