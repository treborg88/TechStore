import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiFetch, apiUrl } from '../services/apiClient';
import { toast } from 'react-hot-toast';
import '../styles/SettingsManager.css';
import EmailSettingsSection from './EmailSettingsSection';

function SettingsManager() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('site');
  const [settings, setSettings] = useState({
    siteName: 'TechStore',
    siteIcon: '🛍️',
    maintenanceMode: false,
    freeShippingThreshold: 50000,
    contactEmail: 'soporte@techstore.com',
    showPromotionBanner: true,
    promoText: '¡Gran venta de año nuevo! 20% de descuento en todo.',
    mailFromName: 'TechStore',
    mailFrom: '',
    mailUser: '',
    mailPassword: '',
    mailHost: '',
    mailPort: 587,
    mailUseTls: true,
    mailTemplateHtml: '<div style="font-family: Arial, sans-serif; color:#111827; line-height:1.6;">\n  <div style="background:#111827;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;">\n    <h2 style="margin:0;">{{siteIcon}} {{siteName}}</h2>\n    <p style="margin:4px 0 0;">Tu pedido fue recibido</p>\n  </div>\n  <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 10px 10px;">\n    <p>Hola <strong>{{customerName}}</strong>,</p>\n    <p>Tu orden <strong>{{orderNumber}}</strong> fue tomada y está en proceso de preparación para envío.</p>\n    <h3 style="margin-top:20px;">Resumen</h3>\n    {{itemsTable}}\n    <p style="margin-top:16px;"><strong>Total:</strong> {{total}}</p>\n    <p><strong>Dirección:</strong> {{shippingAddress}}</p>\n    <p><strong>Pago:</strong> {{paymentMethod}}</p>\n    <p style="margin-top:20px;">Gracias por comprar con nosotros.</p>\n  </div>\n</div>'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const hash = location.hash?.replace('#', '').trim();
    if (hash === 'email' || hash === 'site') {
      setActiveSection(hash);
    }
  }, [location.hash]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await apiFetch(apiUrl('/settings'));
        if (response.ok) {
          const data = await response.json();
          // Convertir tipos de datos (strings a booleans/numbers según corresponda)
          const typedData = {};
          Object.entries(data).forEach(([key, value]) => {
            if (value === 'true') typedData[key] = true;
            else if (value === 'false') typedData[key] = false;
            else if (!isNaN(value) && (key === 'freeShippingThreshold' || key === 'mailPort')) typedData[key] = Number(value);
            else typedData[key] = value;
          });

          setSettings(prev => ({
            ...prev,
            ...typedData
          }));
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageUpload = async (e, targetKey) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    const uploadToast = toast.loading('Subiendo imagen...');
    try {
      const response = await apiFetch(apiUrl('/settings/upload'), {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const { url } = await response.json();
        setSettings(prev => ({ ...prev, [targetKey]: url }));
        toast.success('Imagen subida correctamente', { id: uploadToast });
      } else {
        throw new Error('Error al subir');
      }
    } catch (err) {
      console.error(err);
      toast.error('Ocurrió un error al subir la imagen', { id: uploadToast });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await apiFetch(apiUrl('/settings'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        toast.success('Ajustes guardados correctamente');
        // Opcional: recargar para aplicar cambios globales si no se usan estados compartidos complejos
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const data = await response.json();
        toast.error(data.message || 'Error al guardar');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="settings-manager">Cargando ajustes...</div>;

  return (
    <div className="settings-manager">
      {activeSection === 'site' && (
        <div className="settings-header">
          <h2>⚙️ Ajustes del Sitio</h2>
          <p>Configura parámetros globales de la tienda.</p>
        </div>
      )}

      <form onSubmit={handleSave} className="settings-form">
        {activeSection === 'site' && (
          <>
        <section className="settings-section">
          <h3>🎨 Tema Global (Colores)</h3>
          <p className="section-description">Define la paleta de colores de toda la aplicación.</p>
          
          <div className="settings-grid">
            <div className="form-group">
              <label>Color Principal (Botones, Header)</label>
              <div className="color-input-wrapper">
                <input type="color" name="primaryColor" value={settings.primaryColor || '#2563eb'} onChange={handleChange} />
                <span>{settings.primaryColor}</span>
              </div>
            </div>

            <div className="form-group">
              <label>Color Secundario</label>
              <div className="color-input-wrapper">
                <input type="color" name="secondaryColor" value={settings.secondaryColor || '#7c3aed'} onChange={handleChange} />
                <span>{settings.secondaryColor}</span>
              </div>
            </div>

            <div className="form-group">
              <label>Color de Acento</label>
              <div className="color-input-wrapper">
                <input type="color" name="accentColor" value={settings.accentColor || '#f59e0b'} onChange={handleChange} />
                <span>{settings.accentColor}</span>
              </div>
            </div>

            <div className="form-group">
              <label>Color de Fondo</label>
              <div className="color-input-wrapper">
                <input type="color" name="backgroundColor" value={settings.backgroundColor || '#f8fafc'} onChange={handleChange} />
                <span>{settings.backgroundColor}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h3>🖥️ Página de Inicio (Home)</h3>
          <div className="form-group">
            <label>Título Principal</label>
            <input type="text" name="heroTitle" value={settings.heroTitle} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <textarea name="heroDescription" value={settings.heroDescription} onChange={handleChange} rows="2" />
          </div>
          <div className="form-group">
            <label>Banner del Home</label>
            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'heroImage')} />
            {settings.heroImage && (
              <div className="settings-preview">
                <img src={settings.heroImage} alt="Home Hero" />
                <button type="button" onClick={() => setSettings(prev => ({ ...prev, heroImage: '' }))} className="delete-image-btn">Eliminar</button>
              </div>
            )}
          </div>
          <div className="settings-grid">
            <div className="form-group">
              <label>Botón Primario</label>
              <input type="text" name="heroPrimaryBtn" value={settings.heroPrimaryBtn} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Botón Secundario</label>
              <input type="text" name="heroSecondaryBtn" value={settings.heroSecondaryBtn} onChange={handleChange} />
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h3>📦 Detalle de Producto</h3>
          <div className="form-group">
            <label>Banner Superior (Opcional)</label>
            <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'productDetailHeroImage')} />
            {settings.productDetailHeroImage && (
              <div className="settings-preview">
                <img src={settings.productDetailHeroImage} alt="Product Detail Banner" />
                <button type="button" onClick={() => setSettings(prev => ({ ...prev, productDetailHeroImage: '' }))} className="delete-image-btn">Eliminar</button>
              </div>
            )}
            <p className="field-hint">Este banner aparecerá en la parte superior de cada producto.</p>
          </div>
        </section>

        <section className="settings-section">
          <h3>🏠 Identidad y Navegación</h3>
          <div className="settings-grid">
            <div className="form-group">
              <label>Nombre del Sitio</label>
              <input type="text" name="siteName" value={settings.siteName} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Icono (Emoji)</label>
              <input type="text" name="siteIcon" value={settings.siteIcon} onChange={handleChange} />
            </div>
          </div>
          
          <div className="form-group">
            <label>Color de Barra Superior</label>
            <div className="color-input-wrapper">
              <input type="color" name="headerBgColor" value={settings.headerBgColor || '#2563eb'} onChange={handleChange} />
              <span>{settings.headerBgColor}</span>
            </div>
          </div>
          
          <div className="form-group">
            <label>Transparencia de Barra ({settings.headerTransparency || 100}%)</label>
            <input type="range" name="headerTransparency" min="0" max="100" value={settings.headerTransparency || 100} onChange={handleChange} />
          </div>
        </section>

        <section className="settings-section">
          <h3>⚙️ E-commerce y Otros</h3>
          <div className="form-group">
            <label>Email de Contacto</label>
            <input type="email" name="contactEmail" value={settings.contactEmail} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>Umbral Envío Gratis ($)</label>
            <input type="number" name="freeShippingThreshold" value={settings.freeShippingThreshold} onChange={handleChange} />
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input type="checkbox" name="maintenanceMode" checked={settings.maintenanceMode} onChange={handleChange} />
              Activar Modo Mantenimiento
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h3>Promociones</h3>
          <div className="form-group checkbox-group">
            <label>
              <input 
                type="checkbox" 
                name="showPromotionBanner" 
                checked={settings.showPromotionBanner} 
                onChange={handleChange} 
              />
              Mostrar Banner de Promoción
            </label>
          </div>
          <div className="form-group">
            <label>Texto de la Promoción</label>
            <textarea 
              name="promoText" 
              value={settings.promoText} 
              onChange={handleChange}
              rows="2"
            />
          </div>
        </section>
          </>
        )}

        {activeSection === 'email' && (
          <EmailSettingsSection settings={settings} onChange={handleChange} />
        )}

        <div className="form-actions">
          <button type="submit" className="save-settings-btn" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default SettingsManager;
