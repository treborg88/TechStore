import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import styles from './InvoicePdfStyles';
import { formatCurrency } from '../../utils/formatCurrency';

export const InvoicePDF = ({ invoiceData }) => (
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

export default InvoicePDF;
