import { StyleSheet } from '@react-pdf/renderer';

/**
 * Build PDF styles dynamically from admin config.
 * @param {Object} cfg - Merged config (PDF_DEFAULTS + user overrides)
 * @returns {Object} StyleSheet.create() result
 */
export const buildPdfStyles = (cfg = {}) => {
  // Config values with fallbacks
  const primary = cfg.primaryColor || '#2563EB';
  const tableHdBg = cfg.tableHeaderBg || primary;
  const tableHdTx = cfg.tableHeaderText || '#FFFFFF';
  const totalBg = cfg.totalHighlightBg || '#EFF6FF';
  const base = cfg.fontSizeBase || 9;
  const companyName = cfg.fontSizeCompanyName || 22;
  const invTitle = cfg.fontSizeInvoiceTitle || 16;
  const invNum = cfg.fontSizeInvoiceNumber || 14;
  const tblHdr = cfg.fontSizeTableHeader || 8;
  const tblCell = cfg.fontSizeTableCell || base;
  const totalFs = cfg.fontSizeTotal || 12;
  const notesFs = cfg.fontSizeNotes || 7;
  const termsFs = cfg.fontSizeTerms || 7;
  const footerFs = cfg.fontSizeFooter || 8;

  return StyleSheet.create({
    page: {
      padding: 30,
      fontSize: base,
      fontFamily: 'Helvetica',
      backgroundColor: '#FFFFFF',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 15,
      paddingBottom: 15,
      borderBottomWidth: 2,
      borderBottomColor: primary,
    },
    logo: {
      fontSize: companyName,
      color: primary,
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
      backgroundColor: totalBg,
      padding: 10,
      borderRadius: 4,
      marginBottom: 15,
    },
    invoiceTitle: {
      fontSize: invTitle,
      color: '#1F2937',
      fontFamily: 'Helvetica-Bold',
    },
    invoiceNumber: {
      fontSize: invNum,
      color: primary,
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
    infoBoxWide: {
      width: '60%',
      backgroundColor: '#F9FAFB',
      padding: 10,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    infoBoxNarrow: {
      width: '38%',
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
      fontSize: base,
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
      backgroundColor: tableHdBg,
      padding: 8,
      fontSize: tblHdr,
      fontFamily: 'Helvetica-Bold',
      color: tableHdTx,
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
      padding: 8,
      fontSize: tblCell,
      backgroundColor: '#FFFFFF',
    },
    tableRowEven: {
      backgroundColor: '#F9FAFB',
    },
    // Column widths with tax column (5-col layout)
    col1: { width: '40%' },
    col2: { width: '12%', textAlign: 'center' },
    col3: { width: '16%', textAlign: 'right' },
    col4: { width: '16%', textAlign: 'right' },
    col5: { width: '16%', textAlign: 'right' },
    // Column widths without tax column (4-col layout)
    col1NoTax: { width: '46%' },
    col2NoTax: { width: '14%', textAlign: 'center' },
    col3NoTax: { width: '20%', textAlign: 'right' },
    col5NoTax: { width: '20%', textAlign: 'right' },
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
      fontSize: base,
    },
    summaryValue: {
      width: '15%',
      textAlign: 'right',
      fontFamily: 'Helvetica-Bold',
      color: '#111827',
      fontSize: base,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      padding: 10,
      marginTop: 10,
      backgroundColor: totalBg,
      borderTopWidth: 1,
      borderTopColor: primary,
      fontFamily: 'Helvetica-Bold',
    },
    totalLabel: {
      width: '70%',
      textAlign: 'right',
      paddingRight: 20,
      color: primary,
      fontSize: totalFs,
    },
    totalValue: {
      width: '15%',
      textAlign: 'right',
      color: primary,
      fontSize: totalFs,
    },
    notesSection: {
      marginTop: 20,
      padding: 10,
      backgroundColor: '#F3F4F6',
      borderRadius: 4,
    },
    notesTitle: {
      fontSize: notesFs + 1,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 5,
      color: '#374151',
    },
    notesText: {
      fontSize: notesFs,
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
      fontSize: termsFs + 1,
      fontFamily: 'Helvetica-Bold',
      marginBottom: 5,
      color: '#374151',
    },
    termsList: {
      fontSize: termsFs,
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
      fontSize: footerFs,
      color: '#9CA3AF',
      textAlign: 'center',
    },
  });
};

// Default static styles (backward compatibility)
const styles = buildPdfStyles();
export default styles;
