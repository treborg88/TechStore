import React from 'react';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import '../styles/print.css';

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
  },
  logo: {
    fontSize: 22,
    color: '#2563EB',
    fontFamily: 'Helvetica-Bold',
  },
  companyInfo: {
    textAlign: 'right',
    fontSize: 8,
    color: '#374151',
    lineHeight: 1.4,
  },
  invoiceNumberBox: {
    textAlign: 'right',
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 4,
    marginBottom: 15,
  },
  invoiceNumberBox: {
    textAlign: 'right',
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 4,
    marginBottom: 15,
  },
  invoiceTitle: {
    fontSize: 16,
    color: '#1F2937',
    fontFamily: 'Helvetica-Bold',
  },
  invoiceNumber: {
    fontSize: 14,
    color: '#2563EB',
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
  },
  invoiceDate: {
    fontSize: 8,
    color: '#6B7280',
    marginTop: 4,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    gap: 10,
  },
  infoBox: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoBox: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoLabel: {
    fontSize: 7,
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 3,
    fontFamily: 'Helvetica-Bold',
  },
  infoValue: {
    fontSize: 9,
    color: '#111827',
    marginBottom: 2,
  },
  additionalInfoSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 15,
    backgroundColor: '#FFFBEB',
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  additionalInfoItem: {
    width: '31%',
  },
  additionalInfoLabel: {
    fontSize: 7,
    color: '#92400E',
    fontFamily: 'Helvetica-Bold',
  },
  additionalInfoValue: {
    fontSize: 8,
    color: '#78350F',
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
  col1: { width: '40%' },
  col2: { width: '12%', textAlign: 'center' },
  col3: { width: '16%', textAlign: 'right' },
  col4: { width: '16%', textAlign: 'right' },
  col5: { width: '16%', textAlign: 'right' },
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
  notesSection: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
    color: '#374151',
  },
  notesText: {
    fontSize: 7,
    color: '#6B7280',
    lineHeight: 1.5,
  },
  termsSection: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },
  termsTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 5,
    color: '#374151',
  },
  termsList: {
    fontSize: 7,
    color: '#6B7280',
    lineHeight: 1.6,
  },
  signatureSection: {
    marginTop: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: {
    width: '45%',
  },
  signatureLabel: {
    fontSize: 7,
    color: '#6B7280',
    marginBottom: 3,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#9CA3AF',
    paddingTop: 30,
    marginBottom: 3,
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
      {/* Header with company info */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>{invoiceData.companyIcon} {invoiceData.companyName}</Text>
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
            <Text style={styles.col3}>{item.unitPrice.toFixed(2)}</Text>
            <Text style={styles.col4}></Text>
            <Text style={styles.col5}>{invoiceData.currency} {item.amount.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      {/* Economic Summary */}
      <View style={{marginTop: 15, alignItems: 'flex-end'}}>
        <Text style={{fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 8}}>
          Resumen Económico
        </Text>
        <View style={{width: '40%'}}>
          <View style={styles.summaryRow}>
            <Text style={{...styles.summaryLabel, width: '60%'}}>Subtotal:</Text>
            <Text style={{...styles.summaryValue, width: '40%'}}>
              {invoiceData.currency} {invoiceData.total.toFixed(2)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={{...styles.totalLabel, width: '60%'}}>Total:</Text>
            <Text style={{...styles.totalValue, width: '40%'}}>
              {invoiceData.currency} {invoiceData.total.toFixed(2)}
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

const Invoice = ({ order, customerInfo, items, onClose, showSuccess = true, onStatusChange, siteName = 'Mi Tienda Online', siteIcon = '🛒' }) => {
    const isAuthenticated = !!localStorage.getItem('authToken');

    // Get current date and time
    const now = new Date();
    const currentDate = now.toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const currentTime = now.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Prepare data for PDF
    const invoiceData = {
        companyName: siteName,
        companyIcon: siteIcon,
        companyAddress: 'Calle Principal #123, Santo Domingo',
        companyPhone: '829-334-6358',
        companyRNC: '123456789',
        companyLocation: 'República Dominicana',
        invoiceNumber: order.order_number || `COT/${order.id.toString().padStart(6, '0')}`,
        date: currentDate,
        time: currentTime,
        customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone || 'N/A',
        customerAddress: `${customerInfo.address}, ${customerInfo.sector}, ${customerInfo.city}`,
        customerID: customerInfo.identification || 'N/A',
        seller: 'Sistema Online',
        paymentType: customerInfo.paymentMethod === 'cash' ? 'Contra Entrega' 
                     : customerInfo.paymentMethod === 'transfer' ? 'Transferencia'
                     : customerInfo.paymentMethod === 'card' ? 'Tarjeta' : 'Pendiente',
        paymentStatus: order.status === 'paid' || order.status === 'delivered' ? 'Pagado' : 'Pendiente',
        deliveryTime: '3-5 días hábiles',
        currency: 'RD$',
        source: order.order_number || order.id.toString(),
        items: items.map(item => ({
            description: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            taxPercent: '',
            taxes: '',
            amount: item.price * item.quantity
        })),
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
                    <p className="invoice-date">Fecha: {currentDate}  {currentTime}</p>
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
                            <span className="info-value">DOP</span>
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
                                    <td>RD$ {item.price.toFixed(2)}</td>
                                    <td></td>
                                    <td>RD$ {(item.price * item.quantity).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="invoice-totals">
                    <div className="totals-box">
                        <h4>Resumen Económico</h4>
                        <div className="total-row">
                            <span>Subtotal:</span>
                            <span>RD$ {order.total.toFixed(2)}</span>
                        </div>
                        <div className="total-row final">
                            <span>Total:</span>
                            <span>RD$ {order.total.toFixed(2)}</span>
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
                        {siteIcon} <span>{siteName}</span>
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
