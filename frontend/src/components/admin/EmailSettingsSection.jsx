import React, { useState } from 'react';

/**
 * Email & invoice footer settings section
 * Manages SMTP credentials and bank transfer details for invoices
 */
function EmailSettingsSection({ settings, onChange, setSettings }) {
  const [showPassword, setShowPassword] = useState(false);
  const [credentialsTab, setCredentialsTab] = useState('correo');

  // Helper to update nested paymentMethodsConfig.transfer fields
  const handleTransferField = (field, value) => {
    setSettings(prev => ({
      ...prev,
      paymentMethodsConfig: {
        ...prev.paymentMethodsConfig,
        transfer: { ...prev.paymentMethodsConfig?.transfer, [field]: value }
      }
    }));
  };

  return (
    <section className="settings-section">
      <h3>✉️ Correo y Facturación</h3>
      <p className="section-description">
        Configura el envío de correos y los datos del pie de factura.
      </p>

      <div className="settings-subtabs">
        <button
          type="button"
          className={`settings-subtab ${credentialsTab === 'correo' ? 'active' : ''}`}
          onClick={() => setCredentialsTab('correo')}
        >
          Correo SMTP
        </button>
        <button
          type="button"
          className={`settings-subtab ${credentialsTab === 'factura' ? 'active' : ''}`}
          onClick={() => setCredentialsTab('factura')}
        >
          Pie de Factura
        </button>
      </div>

      {credentialsTab === 'correo' && (
        <>
          <div className="settings-grid">
            <div className="form-group">
              <label>Nombre del Remitente</label>
              <input
                type="text"
                name="mailFromName"
                value={settings.mailFromName || ''}
                onChange={onChange}
                placeholder="Mi Tienda Online"
              />
            </div>
            <div className="form-group">
              <label>Correo del Remitente</label>
              <input
                type="email"
                name="mailFrom"
                value={settings.mailFrom || ''}
                onChange={onChange}
                placeholder="ventas@mitienda.com"
              />
            </div>
            <div className="form-group">
              <label>Usuario (SMTP)</label>
              <input
                type="text"
                name="mailUser"
                value={settings.mailUser || ''}
                onChange={onChange}
                placeholder="usuario@mitienda.com"
              />
            </div>
            <div className="form-group">
              <label>Contraseña (SMTP)</label>
              <div className="password-field">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="mailPassword"
                  value={settings.mailPassword || ''}
                  onChange={onChange}
                  placeholder="********"
                />
                <button
                  type="button"
                  className="toggle-password-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Servidor SMTP</label>
              <input
                type="text"
                name="mailHost"
                value={settings.mailHost || ''}
                onChange={onChange}
                placeholder="smtp.gmail.com"
              />
            </div>
            <div className="form-group">
              <label>Puerto SMTP</label>
              <input
                type="number"
                name="mailPort"
                value={settings.mailPort || ''}
                onChange={onChange}
                placeholder="587"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '12px' }}>
            <label>
              <input
                type="checkbox"
                name="mailUseTls"
                checked={!!settings.mailUseTls}
                onChange={onChange}
              />{' '}
              Usar TLS (STARTTLS)
            </label>
          </div>

          <div className="form-group">
            <label>Plantilla HTML del correo</label>
            <textarea
              name="mailTemplateHtml"
              value={settings.mailTemplateHtml || ''}
              onChange={onChange}
              rows="8"
              placeholder="Usa variables como {{siteName}}, {{orderNumber}}, {{customerName}}, {{itemsTable}}, {{total}}, {{subtotal}}, {{shippingCost}}"
            />
            <p className="field-hint">
              Variables disponibles: {'{{siteName}}'}, {'{{siteIcon}}'}, {'{{orderNumber}}'}, {'{{customerName}}'}, {'{{customerEmail}}'}, {'{{customerPhone}}'}, {'{{shippingAddress}}'}, {'{{paymentMethod}}'}, {'{{status}}'}, {'{{subtotal}}'}, {'{{shippingCost}}'}, {'{{total}}'}, {'{{itemsTable}}'}.
            </p>
          </div>
        </>
      )}

      {credentialsTab === 'factura' && (
        <>
          <p className="section-description">
            Estos datos aparecen en el pie de factura cuando el método de pago es Transferencia Bancaria.
          </p>
          <div className="settings-grid">
            <div className="form-group">
              <label>Nombre del Banco</label>
              <input
                type="text"
                value={settings.paymentMethodsConfig?.transfer?.bankName || ''}
                onChange={(e) => handleTransferField('bankName', e.target.value)}
                placeholder="Ej: Banco Popular"
              />
            </div>
            <div className="form-group">
              <label>Titular de la Cuenta</label>
              <input
                type="text"
                value={settings.paymentMethodsConfig?.transfer?.bankHolder || ''}
                onChange={(e) => handleTransferField('bankHolder', e.target.value)}
                placeholder="Ej: Mi Tienda Online SRL"
              />
            </div>
            <div className="form-group">
              <label>Cuenta / CLABE / Link de Pago</label>
              <input
                type="text"
                value={settings.paymentMethodsConfig?.transfer?.bankAccount || ''}
                onChange={(e) => handleTransferField('bankAccount', e.target.value)}
                placeholder="Ej: 1234-5678-9012-3456"
              />
            </div>
          </div>
          <div className="form-group">
            <label>Nota Importante (instrucciones de pago)</label>
            <textarea
              value={settings.paymentMethodsConfig?.transfer?.transferNote || ''}
              onChange={(e) => handleTransferField('transferNote', e.target.value)}
              placeholder="Ej: Envía tu comprobante de pago por WhatsApp al 829-000-0000 indicando tu número de orden."
              rows="3"
            />
            <p className="field-hint">
              Este texto aparece como nota destacada en la factura del cliente.
            </p>
          </div>
        </>
      )}

    </section>
  );
}

export default EmailSettingsSection;
