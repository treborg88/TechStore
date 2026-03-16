import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { buildPdfStyles } from './InvoicePdfStyles';
import { formatCurrency } from '../../utils/formatCurrency';
import { PDF_DEFAULTS } from '../admin/InvoicePdfSection';

export const InvoicePDF = ({ invoiceData, pdfConfig: rawConfig }) => {
  // Merge admin config with defaults
  const cfg = { ...PDF_DEFAULTS, ...(rawConfig || {}) };
  // Build dynamic styles from config
  const styles = buildPdfStyles(cfg);

  // Resolve notes text — support {deliveryTime} placeholder
  const resolvedNotes = (cfg.notesText || PDF_DEFAULTS.notesText)
    .replace(/\{deliveryTime\}/g, invoiceData.deliveryTime || '3-5 días hábiles');

  // Resolve footer text — support {companyName} and {companyLocation}
  const resolvedFooter = cfg.footerText
    ? cfg.footerText
        .replace(/\{companyName\}/g, invoiceData.companyName || '')
        .replace(/\{companyLocation\}/g, invoiceData.companyLocation || '')
    : `Gracias por su compra - ${invoiceData.companyName} • ${invoiceData.companyLocation}`;

  return (
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
            <Text style={cfg.showTaxColumn ? styles.col1 : styles.col1NoTax}>DESCRIPCIÓN</Text>
            <Text style={cfg.showTaxColumn ? styles.col2 : styles.col2NoTax}>CANTIDAD</Text>
            <Text style={cfg.showTaxColumn ? styles.col3 : styles.col3NoTax}>PRECIO UNITARIO</Text>
            {cfg.showTaxColumn && <Text style={styles.col4}>% IMP.</Text>}
            <Text style={cfg.showTaxColumn ? styles.col5 : styles.col5NoTax}>SUBTOTAL</Text>
          </View>

          {invoiceData.items.map((item, index) => (
            <View key={index} style={[styles.tableRow, index % 2 === 0 ? {} : styles.tableRowEven]}>
              <Text style={cfg.showTaxColumn ? styles.col1 : styles.col1NoTax}>{item.description}</Text>
              <Text style={cfg.showTaxColumn ? styles.col2 : styles.col2NoTax}>{item.quantityLabel || `${item.quantity} un.`}</Text>
              <Text style={cfg.showTaxColumn ? styles.col3 : styles.col3NoTax}>{formatCurrency(item.unitPrice, invoiceData.currency)}</Text>
              {cfg.showTaxColumn && <Text style={styles.col4}></Text>}
              <Text style={cfg.showTaxColumn ? styles.col5 : styles.col5NoTax}>{formatCurrency(item.amount, invoiceData.currency)}</Text>
            </View>
          ))}
        </View>

        {/* Economic Summary */}
        <View style={{marginTop: 15, alignItems: 'flex-end'}}>
          <Text style={{fontSize: cfg.fontSizeBase, fontFamily: 'Helvetica-Bold', marginBottom: 8}}>
            {"\n\n"}
          </Text>
          <View style={{width: '40%'}}>
            <View style={styles.summaryRow}>
              <Text style={{...styles.summaryLabel, width: '60%'}}>Subtotal:</Text>
              <Text style={{...styles.summaryValue, width: '40%'}}>
                {formatCurrency(invoiceData.subtotal, invoiceData.currency)}
              </Text>
            </View>
            {invoiceData.shippingCost > 0 && (
              <View style={styles.summaryRow}>
                <Text style={{...styles.summaryLabel, width: '60%'}}>Envío:</Text>
                <Text style={{...styles.summaryValue, width: '40%'}}>
                  {formatCurrency(invoiceData.shippingCost, invoiceData.currency)}
                </Text>
              </View>
            )}
            <View style={styles.totalRow}>
              <Text style={{...styles.totalLabel, width: '60%'}}>Total:</Text>
              <Text style={{...styles.totalValue, width: '40%'}}>
                {formatCurrency(invoiceData.total, invoiceData.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes Section (configurable) */}
        {cfg.showNotesSection && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notas</Text>
            <Text style={styles.notesText}>{resolvedNotes}</Text>
          </View>
        )}

        {/* Terms and Conditions (configurable) */}
        {cfg.showTermsSection && (
          <View style={styles.termsSection}>
            <Text style={styles.termsTitle}>Términos y Condiciones</Text>
            <Text style={styles.termsList}>{cfg.termsText || PDF_DEFAULTS.termsText}</Text>
          </View>
        )}

        {/* Signature Section (configurable) */}
        {cfg.showSignatureSection && (
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
        )}

        {/* Footer */}
        <Text style={styles.footer}>{resolvedFooter}</Text>
      </Page>
    </Document>
  );
};

export default InvoicePDF;
