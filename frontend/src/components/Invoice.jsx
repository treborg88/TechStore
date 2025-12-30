import React from 'react';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import '../styles/print.css';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
  },
  logo: {
    fontSize: 20,
    color: '#2563EB', // Blue
    fontFamily: 'Helvetica-Bold',
  },
  companyInfo: {
    textAlign: 'right',
    fontSize: 9,
    color: '#4B5563',
  },
  invoiceTitle: {
    textAlign: 'right',
    fontSize: 18,
    color: '#111827',
    marginBottom: 20,
    fontFamily: 'Helvetica-Bold',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 8,
    marginBottom: 4,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionValue: {
    fontSize: 10,
    color: '#111827',
    fontFamily: 'Helvetica-Bold',
  },
  table: {
    marginTop: 20,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2563EB', // Blue header
    padding: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF', // White text
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    padding: 8,
    backgroundColor: '#FFFFFF',
  },
  tableRowEven: {
    backgroundColor: '#F9FAFB', // Zebra striping
  },
  col1: { width: '35%' },
  col2: { width: '15%', textAlign: 'center' },
  col3: { width: '20%', textAlign: 'right' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '15%', textAlign: 'right' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
    marginTop: 4,
  },
  summaryLabel: {
    width: '70%',
    textAlign: 'right',
    paddingRight: 20,
    color: '#4B5563',
  },
  summaryValue: {
    width: '15%',
    textAlign: 'right',
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 10,
    marginTop: 10,
    backgroundColor: '#EFF6FF', // Light blue background
    borderTopWidth: 1,
    borderTopColor: '#2563EB',
    fontFamily: 'Helvetica-Bold',
  },
  totalLabel: {
    width: '70%',
    textAlign: 'right',
    paddingRight: 20,
    color: '#2563EB',
    fontSize: 12,
  },
  totalValue: {
    width: '15%',
    textAlign: 'right',
    color: '#2563EB',
    fontSize: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
    fontSize: 8,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

// PDF Document Component
const InvoicePDF = ({ invoiceData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.logo}>TechStore</Text>
        <View style={styles.companyInfo}>
          <Text style={{fontFamily: 'Helvetica-Bold', marginBottom: 2}}>{invoiceData.companyName}</Text>
          <Text>{invoiceData.companyLocation}</Text>
        </View>
      </View>

      <Text style={styles.invoiceTitle}>FACTURA</Text>

      <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20}}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Facturar a:</Text>
          <Text style={styles.sectionValue}>{invoiceData.customerName}</Text>
          <Text style={{fontSize: 10, color: '#4B5563'}}>{invoiceData.customerEmail}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalles de Orden:</Text>
          <Text style={styles.sectionValue}>Orden # {invoiceData.source}</Text>
          <Text style={{fontSize: 10, color: '#4B5563'}}>Fecha: {new Date().toLocaleDateString()}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.col1}>Descripción</Text>
          <Text style={styles.col2}>Cant.</Text>
          <Text style={styles.col3}>Precio</Text>
          <Text style={styles.col4}>Impuestos</Text>
          <Text style={styles.col5}>Total</Text>
        </View>

        {invoiceData.items.map((item, index) => (
          <View key={index} style={[styles.tableRow, index % 2 === 0 ? {} : styles.tableRowEven]}>
            <Text style={styles.col1}>{item.description}</Text>
            <Text style={styles.col2}>{item.quantity}</Text>
            <Text style={styles.col3}>{item.unitPrice.toFixed(2)}</Text>
            <Text style={styles.col4}>{item.taxes || '-'}</Text>
            <Text style={styles.col5}>{invoiceData.currency} {item.amount.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Subtotal</Text>
        <Text style={styles.summaryValue}>{invoiceData.currency} {invoiceData.untaxedAmount.toFixed(2)}</Text>
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>TOTAL A PAGAR</Text>
        <Text style={styles.totalValue}>{invoiceData.currency} {invoiceData.total.toFixed(2)}</Text>
      </View>

      <Text style={styles.footer}>Gracias por su compra - TechStore Inc.</Text>
    </Page>
  </Document>
);

const STATUS_STEPS = [
    { id: 'pending_payment', label: 'Pendiente Pago', icon: '⏳' },
    { id: 'paid', label: 'Pagado', icon: '💰' },
    { id: 'to_ship', label: 'Para Enviar', icon: '📦' },
    { id: 'shipped', label: 'Enviado', icon: '🚚' },
    { id: 'delivered', label: 'Entregado', icon: '✅' }
];

const COD_STATUS_STEPS = [
    { id: 'to_ship', label: 'Para Enviar', icon: '📦' },
    { id: 'shipped', label: 'Enviado', icon: '🚚' },
    { id: 'delivered', label: 'Entregado', icon: '✅' },
    { id: 'paid', label: 'Pagado', icon: '💰' }
];

const Invoice = ({ order, customerInfo, items, onClose, showSuccess = true, onStatusChange }) => {
    const isAuthenticated = !!localStorage.getItem('authToken');

    // Prepare data for PDF
    const invoiceData = {
        companyName: 'TechStore Inc.',
        companyLocation: 'República Dominicana',
        customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
        customerEmail: customerInfo.email,
        source: order.order_number || order.id.toString(),
        currency: 'RD$',
        items: items.map(item => ({
            description: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            taxes: '', 
            amount: item.price * item.quantity
        })),
        untaxedAmount: order.total,
        total: order.total
    };

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
                        📷 <span>TechStore</span>
                    </div>
                    <div className="company-info">
                        <p>TechStore Inc.</p>
                        <p>República Dominicana</p>
                    </div>
                </div>

                <div className="invoice-title-section">
                    <h1 className="invoice-title">Factura</h1>
                </div>

                <div className="invoice-info-grid">
                    <div className="info-row">
                        <span className="info-label">Cliente</span>
                        <span className="info-value">{customerInfo.firstName} {customerInfo.lastName}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Source</span>
                        <span className="info-value">{order.order_number || `#${order.id}`}</span>
                    </div>
                </div>

                <div className="invoice-table-container">
                    <table className="invoice-table">
                        <thead>
                            <tr>
                                <th style={{width: '40%'}}>Descripción</th>
                                <th style={{width: '15%'}}>Cantidad</th>
                                <th style={{width: '15%'}}>Precio Unit.</th>
                                <th style={{width: '15%'}}>Impuestos</th>
                                <th style={{width: '15%'}}>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map(item => (
                                <tr key={item.id}>
                                    <td>{item.name}</td>
                                    <td>{item.quantity.toFixed(2)}</td>
                                    <td>{item.price.toLocaleString('es-DO', { minimumFractionDigits: 2 })}</td>
                                    <td></td>
                                    <td>{(item.price * item.quantity).toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="invoice-totals">
                    <div className="totals-box">
                        <div className="total-row">
                            <span>Subtotal</span>
                            <span>{order.total.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })}</span>
                        </div>
                        <div className="total-row final">
                            <span>Total</span>
                            <span>{order.total.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })}</span>
                        </div>
                    </div>
                </div>

                <div className="invoice-footer">
                    Page 1 / 1
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
                            <>
                                <div className="order-status-stepper">
                                    {(customerInfo.paymentMethod === 'cash' ? COD_STATUS_STEPS : STATUS_STEPS).map((step, index) => {
                                        const steps = customerInfo.paymentMethod === 'cash' ? COD_STATUS_STEPS : STATUS_STEPS;
                                        const currentIdx = steps.findIndex(s => s.id === order.status);
                                        const isCompleted = currentIdx >= index;
                                        const isActive = order.status === step.id;
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
                            </>
                        )}
                    </div>
                )}

                <div className="invoice-header">
                    <div className="invoice-logo">
                        📷 <span>TechStore</span>
                    </div>
                    <div className="invoice-meta">
                        <h3>FACTURA</h3>
                        <p><strong>Orden:</strong> {order.order_number || `#${order.id}`}</p>
                        <p><strong>Fecha:</strong> {new Date(order.created_at).toLocaleDateString()}</p>
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
                                    <td>${item.price.toFixed(2)}</td>
                                    <td>${(item.price * item.quantity).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="invoice-summary-footer">
                    <div className="payment-info-box">
                        <h4>Método de Pago</h4>
                        <p>
                            {customerInfo.paymentMethod === 'cash' && '💵 Pago Contra Entrega'}
                            {customerInfo.paymentMethod === 'transfer' && '🏦 Transferencia Bancaria'}
                            {customerInfo.paymentMethod === 'online' && '💳 Pago en Línea'}
                            {customerInfo.paymentMethod === 'card' && '💳 Tarjeta de Crédito/Débito'}
                        </p>
                        <div className={`status-tag status-${order.status}`}>
                            {order.status === 'pending_payment' && '⏳ Pendiente de Pago'}
                            {order.status === 'paid' && '💰 Pagado'}
                            {order.status === 'to_ship' && '📦 Para Enviar'}
                            {order.status === 'shipped' && '🚚 Enviado'}
                            {order.status === 'delivered' && '✅ Entregado'}
                            {order.status === 'return' && '↩️ Devolución'}
                            {order.status === 'refund' && '💸 Reembolso'}
                            {order.status === 'cancelled' && '❌ Cancelado'}
                        </div>
                    </div>
                    <div className="totals-box">
                        <div className="total-row">
                            <span>Subtotal:</span>
                            <span>${order.total.toFixed(2)}</span>
                        </div>
                        <div className="total-row grand-total">
                            <span>TOTAL:</span>
                            <span>${order.total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="order-summary-success no-print" style={{display: 'none'}}>
                <p><strong>Total:</strong> ${order.total.toFixed(2)}</p>
                <p><strong>Método de Pago:</strong> 
                    {customerInfo.paymentMethod === 'cash' && ' 💵 Pago Contra Entrega'}
                    {customerInfo.paymentMethod === 'transfer' && ' 🏦 Transferencia Bancaria'}
                    {customerInfo.paymentMethod === 'online' && ' 💳 Pago en Línea'}
                    {customerInfo.paymentMethod === 'card' && ' 💳 Tarjeta de Crédito/Débito'}
                </p>
                <p><strong>Estado:</strong> <span className="status-badge">
                    {order.status === 'pending_payment' && '⏳ Pendiente de Pago'}
                    {order.status === 'paid' && '💰 Pagado'}
                    {order.status === 'to_ship' && '📦 Para Enviar'}
                    {order.status === 'shipped' && '🚚 Enviado'}
                    {order.status === 'delivered' && '✅ Entregado'}
                    {order.status === 'return' && '↩️ Devolución'}
                    {order.status === 'refund' && '💸 Reembolso'}
                    {order.status === 'cancelled' && '❌ Cancelado'}
                    {/* Fallback */}
                    {!['pending_payment', 'paid', 'to_ship', 'shipped', 'delivered', 'return', 'refund', 'cancelled'].includes(order.status) && order.status}
                </span></p>
                <p><strong>Envío a:</strong> {customerInfo.address}, {customerInfo.city}</p>
            </div>

            {showSuccess && customerInfo.paymentMethod === 'cash' && (
                <div className="payment-note no-print">
                    💰 Prepara el monto exacto: <strong>${order.total.toFixed(2)}</strong>
                </div>
            )}
            {showSuccess && customerInfo.paymentMethod === 'transfer' && (
                <div className="payment-note transfer-note no-print">
                    <h4>📋 Instrucciones de Transferencia</h4>
                    <div className="bank-details">
                        <p><strong>Banco:</strong> Banco Ejemplo</p>
                        <p><strong>Titular:</strong> Mi Tienda Online</p>
                        <p><strong>Cuenta:</strong> 1234-5678-9012-3456</p>
                        <p><strong>CLABE:</strong> 012345678901234567</p>
                        <p><strong>Monto:</strong> <span className="amount">${order.total.toFixed(2)}</span></p>
                    </div>
                    <p className="transfer-instructions">
                        ⚠️ Envía tu comprobante de pago por email a <strong>pagos@mitienda.com</strong> 
                        indicando el número de orden <strong>#{order.id}</strong>
                    </p>
                </div>
            )}
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
