import React, { useState } from 'react';

/**
 * Email settings section: SMTP credentials, feature toggles, invoice footer
 * Manages email sending configuration and per-feature on/off toggles
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

  // Master email toggle — controls whether child toggles are editable
  const emailEnabled = settings.emailEnabled !== 'false' && settings.emailEnabled !== false;

  // Helper: toggle a boolean setting stored as 'true'/'false' string
  const handleToggle = (name) => {
    setSettings(prev => ({
      ...prev,
      [name]: prev[name] === 'false' || prev[name] === false ? 'true' : 'false'
    }));
  };

  // Feature toggle definitions
  const emailFeatures = [
    { key: 'emailVerifyRegistration',  label: 'Verificación de email al registrarse',     desc: 'Envía código de verificación cuando un usuario crea una cuenta nueva.' },
    { key: 'emailVerifyGuestCheckout', label: 'Verificación de email en checkout (invitado)', desc: 'Requiere verificar email por código para compras como invitado.' },
    { key: 'emailOrderConfirmation',   label: 'Confirmación de orden por email',           desc: 'Envía email automático de confirmación al crear una orden.' },
    { key: 'emailInvoiceAutoSend',     label: 'Envío automático de factura (PDF)',         desc: 'Envía la factura en PDF por email al completar el pago.' },
    { key: 'emailPasswordReset',       label: 'Recuperación de contraseña por email',      desc: 'Permite enviar código para restablecer contraseña olvidada.' }
  ];

  return (
    <section className="settings-section">
      <h3>✉️ Correo y Facturación</h3>
      <p className="section-description">
        Configura el envío de correos, activa o desactiva funciones de email, y los datos del pie de factura.
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
          className={`settings-subtab ${credentialsTab === 'funciones' ? 'active' : ''}`}
          onClick={() => setCredentialsTab('funciones')}
        >
          Funciones
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

      {/* Tab: Funciones — master toggle + per-feature checkboxes */}
      {credentialsTab === 'funciones' && (
        <>
          {/* Master toggle */}
          <div className="email-toggle-master" style={{ marginBottom: '18px', padding: '14px 16px', background: emailEnabled ? '#f0fdf4' : '#fef2f2', borderRadius: '8px', border: `1px solid ${emailEnabled ? '#bbf7d0' : '#fecaca'}` }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '1.05rem' }}>
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={() => handleToggle('emailEnabled')}
                style={{ width: '18px', height: '18px' }}
              />
              {emailEnabled ? '✅' : '⛔'} Envío de correos {emailEnabled ? 'activado' : 'desactivado'}
            </label>
            <p className="field-hint" style={{ marginTop: '6px', marginLeft: '28px' }}>
              {emailEnabled
                ? 'El sistema puede enviar correos. Desactiva para pausar todos los envíos.'
                : 'Ningún correo será enviado mientras esté desactivado.'}
            </p>
          </div>

          {/* Per-feature toggles */}
          <div style={{ opacity: emailEnabled ? 1 : 0.5, pointerEvents: emailEnabled ? 'auto' : 'none' }}>
            {emailFeatures.map(({ key, label, desc }) => {
              const isOn = settings[key] !== 'false' && settings[key] !== false;
              return (
                <div key={key} className="email-toggle-row" style={{ padding: '10px 0', borderBottom: '1px solid var(--gray-200, #e5e7eb)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => handleToggle(key)}
                      style={{ width: '16px', height: '16px', marginTop: '3px', flexShrink: 0 }}
                    />
                    <span>
                      <strong>{label}</strong>
                      <br />
                      <span className="field-hint" style={{ fontSize: '0.85rem' }}>{desc}</span>
                    </span>
                  </label>
                </div>
              );
            })}
          </div>
          {!emailEnabled && (
            <p style={{ marginTop: '12px', color: '#b91c1c', fontWeight: 500, fontSize: '0.9rem' }}>
              ⚠️ Activa el envío de correos arriba para configurar funciones individuales.
            </p>
          )}
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
