import React, { useState } from 'react';

function EmailSettingsSection({ settings, onChange }) {
  const [showPassword, setShowPassword] = useState(false);
  const [credentialsTab, setCredentialsTab] = useState('correo');

  return (
    <section className="settings-section">
      <h3>🔐 Manejo de credencia</h3>
      <p className="section-description">
        Administra las credenciales de correo y base de datos de manera segura.
      </p>

      <div className="settings-subtabs">
        <button
          type="button"
          className={`settings-subtab ${credentialsTab === 'correo' ? 'active' : ''}`}
          onClick={() => setCredentialsTab('correo')}
        >
          Correo
        </button>
        <button
          type="button"
          className={`settings-subtab ${credentialsTab === 'db' ? 'active' : ''}`}
          onClick={() => setCredentialsTab('db')}
        >
          Base de datos
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
              placeholder="Usa variables como {{siteName}}, {{orderNumber}}, {{customerName}}, {{itemsTable}}, {{total}}"
            />
            <p className="field-hint">
              Variables disponibles: {'{{siteName}}'}, {'{{siteIcon}}'}, {'{{orderNumber}}'}, {'{{customerName}}'}, {'{{customerEmail}}'}, {'{{customerPhone}}'}, {'{{shippingAddress}}'}, {'{{paymentMethod}}'}, {'{{status}}'}, {'{{total}}'}, {'{{itemsTable}}'}.
            </p>
          </div>
        </>
      )}

      {credentialsTab === 'db' && (
        <>
          <div className="settings-grid">
            <div className="form-group">
              <label>Proveedor</label>
              <input type="text" value="Supabase" disabled />
            </div>
            <div className="form-group">
              <label>URL de la base de datos</label>
              <input type="text" value="Configurada en .env" disabled />
            </div>
            <div className="form-group">
              <label>API Key</label>
              <input type="text" value="••••••••••••••" disabled />
            </div>
          </div>
          <p className="field-hint">
            Para cambiar credenciales de base de datos, actualiza las variables del backend (.env) y reinicia el servidor.
          </p>
        </>
      )}
    </section>
  );
}

export default EmailSettingsSection;
