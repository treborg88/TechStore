// pdfDefaults.js - Shared PDF invoice default configuration
// Extracted to its own file so components can import without triggering Fast Refresh warnings

export const PDF_DEFAULTS = {
  // Company info
  companyAddress: '',
  companyPhone: '',
  companyRNC: '',
  companyLocation: '',
  seller: 'Sistema Online',
  // Font sizes (pt)
  fontSizeBase: 9,
  fontSizeCompanyName: 22,
  fontSizeInvoiceTitle: 16,
  fontSizeInvoiceNumber: 14,
  fontSizeTableHeader: 8,
  fontSizeTableCell: 9,
  fontSizeTotal: 12,
  fontSizeNotes: 7,
  fontSizeTerms: 7,
  fontSizeFooter: 8,
  // Colors
  primaryColor: '#2563EB',
  headerBorderColor: '#2563EB',
  tableHeaderBg: '#2563EB',
  tableHeaderText: '#FFFFFF',
  totalHighlightBg: '#EFF6FF',
  // Sections visibility
  showNotesSection: true,
  showTermsSection: true,
  showSignatureSection: true,
  showTaxColumn: true,
  // Content
  notesText: '• El producto llegará en perfecto estado\n• Tiempo estimado de entrega: 3-5 días hábiles\n• Garantía de satisfacción del cliente',
  termsText: '• No hay devolución en Productos cortados, fabricados o importados a medida.\n• La posesión de la factura no constituye prueba de pago.\n• Para la validez de esta factura debe estar sellada y firmada por Caja y Cliente.\n• La fecha de entrega de los productos puede variar por la importación.',
  footerText: '',
};
