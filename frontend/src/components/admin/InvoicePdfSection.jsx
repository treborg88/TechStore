// InvoicePdfSection.jsx - Admin settings section for PDF invoice customization
import React, { useState } from 'react';
import { PDF_DEFAULTS } from '../../utils/pdfDefaults';

/**
 * Admin section component for configuring PDF invoice appearance and content.
 * Follows the same pattern as EmailSettingsSection: receives settings + setSettings.
 */
function InvoicePdfSection({ settings, setSettings }) {
  const [activeTab, setActiveTab] = useState('empresa');

  // Get current config merged with defaults
  const pdfConfig = { ...PDF_DEFAULTS, ...(settings.invoicePdfConfig || {}) };

  // Update a single field in the invoicePdfConfig
  const updateField = (field, value) => {
    setSettings(prev => ({
      ...prev,
      invoicePdfConfig: {
        ...(prev.invoicePdfConfig || {}),
        [field]: value
      }
    }));
  };

  // Toggle a boolean field
  const toggleField = (field) => {
    setSettings(prev => ({
      ...prev,
      invoicePdfConfig: {
        ...(prev.invoicePdfConfig || {}),
        [field]: !(prev.invoicePdfConfig?.[field] ?? PDF_DEFAULTS[field])
      }
    }));
  };

  // Reset all settings to defaults
  const handleReset = () => {
    setSettings(prev => ({
      ...prev,
      invoicePdfConfig: {}
    }));
  };

  return (
    <div className="invoice-pdf-section">
      {/* Sub-tabs */}
      <div className="settings-subtabs">
        <button type="button" className={activeTab === 'empresa' ? 'active' : ''} onClick={() => setActiveTab('empresa')}>
          🏢 Empresa
        </button>
        <button type="button" className={activeTab === 'fuentes' ? 'active' : ''} onClick={() => setActiveTab('fuentes')}>
          🔤 Fuentes
        </button>
        <button type="button" className={activeTab === 'colores' ? 'active' : ''} onClick={() => setActiveTab('colores')}>
          🎨 Colores
        </button>
        <button type="button" className={activeTab === 'secciones' ? 'active' : ''} onClick={() => setActiveTab('secciones')}>
          📄 Secciones
        </button>
        <button type="button" className={activeTab === 'contenido' ? 'active' : ''} onClick={() => setActiveTab('contenido')}>
          ✏️ Contenido
        </button>
      </div>

      {/* Tab 1: Company Info */}
      {activeTab === 'empresa' && (
        <div className="settings-grid">
          <div className="form-group">
            <label>Dirección de la Empresa</label>
            <input
              type="text"
              value={pdfConfig.companyAddress}
              onChange={(e) => updateField('companyAddress', e.target.value)}
              placeholder="Ej: Calle Principal #123, Santo Domingo"
            />
            <small className="form-hint">Aparece debajo del nombre en el encabezado del PDF</small>
          </div>
          <div className="form-group">
            <label>Teléfono de la Empresa</label>
            <input
              type="text"
              value={pdfConfig.companyPhone}
              onChange={(e) => updateField('companyPhone', e.target.value)}
              placeholder="Ej: 829-334-6358"
            />
          </div>
          <div className="form-group">
            <label>RNC de la Empresa</label>
            <input
              type="text"
              value={pdfConfig.companyRNC}
              onChange={(e) => updateField('companyRNC', e.target.value)}
              placeholder="Ej: 123456789"
            />
          </div>
          <div className="form-group">
            <label>Ubicación (pie de página)</label>
            <input
              type="text"
              value={pdfConfig.companyLocation}
              onChange={(e) => updateField('companyLocation', e.target.value)}
              placeholder="Ej: República Dominicana"
            />
          </div>
          <div className="form-group">
            <label>Vendedor por Defecto</label>
            <input
              type="text"
              value={pdfConfig.seller}
              onChange={(e) => updateField('seller', e.target.value)}
              placeholder="Ej: Sistema Online"
            />
            <small className="form-hint">Se muestra en &quot;Detalles del Pedido&quot;</small>
          </div>
        </div>
      )}

      {/* Tab 2: Font Sizes */}
      {activeTab === 'fuentes' && (
        <div className="settings-grid">
          <div className="form-group">
            <label>Base del Documento (pt)</label>
            <input type="number" min="6" max="14" step="0.5"
              value={pdfConfig.fontSizeBase}
              onChange={(e) => updateField('fontSizeBase', parseFloat(e.target.value) || PDF_DEFAULTS.fontSizeBase)}
            />
            <small className="form-hint">Tamaño general del texto</small>
          </div>
          <div className="form-group">
            <label>Nombre de Empresa (pt)</label>
            <input type="number" min="12" max="36" step="1"
              value={pdfConfig.fontSizeCompanyName}
              onChange={(e) => updateField('fontSizeCompanyName', parseFloat(e.target.value) || PDF_DEFAULTS.fontSizeCompanyName)}
            />
          </div>
          <div className="form-group">
            <label>Título &quot;FACTURA&quot; (pt)</label>
            <input type="number" min="10" max="24" step="1"
              value={pdfConfig.fontSizeInvoiceTitle}
              onChange={(e) => updateField('fontSizeInvoiceTitle', parseFloat(e.target.value) || PDF_DEFAULTS.fontSizeInvoiceTitle)}
            />
          </div>
          <div className="form-group">
            <label>Número de Factura (pt)</label>
            <input type="number" min="8" max="20" step="1"
              value={pdfConfig.fontSizeInvoiceNumber}
              onChange={(e) => updateField('fontSizeInvoiceNumber', parseFloat(e.target.value) || PDF_DEFAULTS.fontSizeInvoiceNumber)}
            />
          </div>
          <div className="form-group">
            <label>Encabezado de Tabla (pt)</label>
            <input type="number" min="6" max="14" step="0.5"
              value={pdfConfig.fontSizeTableHeader}
              onChange={(e) => updateField('fontSizeTableHeader', parseFloat(e.target.value) || PDF_DEFAULTS.fontSizeTableHeader)}
            />
          </div>
          <div className="form-group">
            <label>Celdas de Tabla (pt)</label>
            <input type="number" min="6" max="14" step="0.5"
              value={pdfConfig.fontSizeTableCell}
              onChange={(e) => updateField('fontSizeTableCell', parseFloat(e.target.value) || PDF_DEFAULTS.fontSizeTableCell)}
            />
          </div>
          <div className="form-group">
            <label>Total (pt)</label>
            <input type="number" min="8" max="20" step="1"
              value={pdfConfig.fontSizeTotal}
              onChange={(e) => updateField('fontSizeTotal', parseFloat(e.target.value) || PDF_DEFAULTS.fontSizeTotal)}
            />
          </div>
          <div className="form-group">
            <label>Notas (pt)</label>
            <input type="number" min="5" max="12" step="0.5"
              value={pdfConfig.fontSizeNotes}
              onChange={(e) => updateField('fontSizeNotes', parseFloat(e.target.value) || PDF_DEFAULTS.fontSizeNotes)}
            />
          </div>
          <div className="form-group">
            <label>Términos y Condiciones (pt)</label>
            <input type="number" min="5" max="12" step="0.5"
              value={pdfConfig.fontSizeTerms}
              onChange={(e) => updateField('fontSizeTerms', parseFloat(e.target.value) || PDF_DEFAULTS.fontSizeTerms)}
            />
          </div>
          <div className="form-group">
            <label>Pie de Página (pt)</label>
            <input type="number" min="5" max="12" step="0.5"
              value={pdfConfig.fontSizeFooter}
              onChange={(e) => updateField('fontSizeFooter', parseFloat(e.target.value) || PDF_DEFAULTS.fontSizeFooter)}
            />
          </div>
        </div>
      )}

      {/* Tab 3: Colors */}
      {activeTab === 'colores' && (
        <div className="settings-grid">
          <div className="form-group">
            <label>Color Primario</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="color"
                value={pdfConfig.primaryColor}
                onChange={(e) => updateField('primaryColor', e.target.value)}
                style={{ width: '40px', height: '32px', padding: 0, border: 'none', cursor: 'pointer' }}
              />
              <input type="text"
                value={pdfConfig.primaryColor}
                onChange={(e) => updateField('primaryColor', e.target.value)}
                placeholder="#2563EB"
                style={{ flex: 1 }}
              />
            </div>
            <small className="form-hint">Nombre de empresa, número de factura, línea del header, total</small>
          </div>
          <div className="form-group">
            <label>Fondo Encabezado Tabla</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="color"
                value={pdfConfig.tableHeaderBg}
                onChange={(e) => updateField('tableHeaderBg', e.target.value)}
                style={{ width: '40px', height: '32px', padding: 0, border: 'none', cursor: 'pointer' }}
              />
              <input type="text"
                value={pdfConfig.tableHeaderBg}
                onChange={(e) => updateField('tableHeaderBg', e.target.value)}
                placeholder="#2563EB"
                style={{ flex: 1 }}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Texto Encabezado Tabla</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="color"
                value={pdfConfig.tableHeaderText}
                onChange={(e) => updateField('tableHeaderText', e.target.value)}
                style={{ width: '40px', height: '32px', padding: 0, border: 'none', cursor: 'pointer' }}
              />
              <input type="text"
                value={pdfConfig.tableHeaderText}
                onChange={(e) => updateField('tableHeaderText', e.target.value)}
                placeholder="#FFFFFF"
                style={{ flex: 1 }}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Fondo Resaltado Total</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="color"
                value={pdfConfig.totalHighlightBg}
                onChange={(e) => updateField('totalHighlightBg', e.target.value)}
                style={{ width: '40px', height: '32px', padding: 0, border: 'none', cursor: 'pointer' }}
              />
              <input type="text"
                value={pdfConfig.totalHighlightBg}
                onChange={(e) => updateField('totalHighlightBg', e.target.value)}
                placeholder="#EFF6FF"
                style={{ flex: 1 }}
              />
            </div>
            <small className="form-hint">Fondo de la fila del total</small>
          </div>
        </div>
      )}

      {/* Tab 4: Sections visibility */}
      {activeTab === 'secciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p className="section-description" style={{ marginBottom: '0.5rem' }}>
            Activa o desactiva las secciones que se muestran en el PDF.
          </p>
          {[
            { key: 'showNotesSection', label: '📝 Sección de Notas', desc: 'Observaciones debajo del resumen económico' },
            { key: 'showTermsSection', label: '📋 Términos y Condiciones', desc: 'Condiciones legales y de devolución' },
            { key: 'showSignatureSection', label: '✍️ Sección de Firma', desc: 'Campos de cédula y firma del cliente' },
            { key: 'showTaxColumn', label: '💰 Columna de Impuestos', desc: 'Columna "% IMP." en la tabla de productos' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="email-toggle-row">
              <label>
                <input
                  type="checkbox"
                  checked={pdfConfig[key]}
                  onChange={() => toggleField(key)}
                />
                <strong>{label}</strong>
                <span>{desc}</span>
              </label>
            </div>
          ))}
        </div>
      )}

      {/* Tab 5: Content */}
      {activeTab === 'contenido' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label>📝 Texto de Notas</label>
            <textarea
              rows="5"
              value={pdfConfig.notesText}
              onChange={(e) => updateField('notesText', e.target.value)}
              placeholder="• Nota 1&#10;• Nota 2&#10;• Nota 3"
            />
            <small className="form-hint">Cada línea con &quot;•&quot; se muestra como un punto. Usa {'{deliveryTime}'} para insertar el tiempo de entrega.</small>
          </div>
          <div className="form-group">
            <label>📋 Texto de Términos y Condiciones</label>
            <textarea
              rows="6"
              value={pdfConfig.termsText}
              onChange={(e) => updateField('termsText', e.target.value)}
              placeholder="• Condición 1&#10;• Condición 2"
            />
          </div>
          <div className="form-group">
            <label>🔻 Texto Personalizado del Pie de Página</label>
            <input
              type="text"
              value={pdfConfig.footerText}
              onChange={(e) => updateField('footerText', e.target.value)}
              placeholder="Dejar vacío para usar el predeterminado: 'Gracias por su compra - {nombre} • {ubicación}'"
            />
            <small className="form-hint">Usa {'{companyName}'} y {'{companyLocation}'} como variables</small>
          </div>
        </div>
      )}

      {/* Reset button */}
      <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
        <button type="button" className="btn-secondary" onClick={handleReset}
          style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
          🔄 Restaurar Valores Predeterminados
        </button>
      </div>
    </div>
  );
}

export default InvoicePdfSection;
