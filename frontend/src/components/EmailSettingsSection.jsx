import React, { useState } from 'react';

function EmailSettingsSection({ settings, onChange }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section className="settings-section">
      <h3>✉️ Configuración de Correo</h3>
      <p className="section-description">
        Configura el remitente y las credenciales SMTP para enviar confirmaciones de órdenes.
      </p>

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
          placeholder="Usa variables como {{siteName}}, {{orderNumber}}, {{customerName}}, {{itemsTable}}, {{total}}"
        />
        <p className="field-hint">
          Variables disponibles: {'{{siteName}}'}, {'{{siteIcon}}'}, {'{{orderNumber}}'}, {'{{customerName}}'}, {'{{customerEmail}}'}, {'{{customerPhone}}'}, {'{{shippingAddress}}'}, {'{{paymentMethod}}'}, {'{{status}}'}, {'{{total}}'}, {'{{itemsTable}}'}.
        </p>
      </div>
    </section>
  );
}

export default EmailSettingsSection;
