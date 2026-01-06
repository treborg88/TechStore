import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { toast } from 'react-hot-toast';
import '../styles/SettingsManager.css';

function SettingsManager() {
  const [settings, setSettings] = useState({
    siteName: 'TechStore',
    siteIcon: '🛍️',
    maintenanceMode: false,
    freeShippingThreshold: 50000,
    contactEmail: 'soporte@techstore.com',
    showPromotionBanner: true,
    promoText: '¡Gran venta de año nuevo! 20% de descuento en todo.'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${API_URL}/settings`);
        if (response.ok) {
          const data = await response.json();
          // Convertir tipos de datos (strings a booleans/numbers según corresponda)
          const typedData = {};
          Object.entries(data).forEach(([key, value]) => {
            if (value === 'true') typedData[key] = true;
            else if (value === 'false') typedData[key] = false;
            else if (!isNaN(value) && key === 'freeShippingThreshold') typedData[key] = Number(value);
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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    const uploadToast = toast.loading('Subiendo imagen...');
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/settings/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const { url } = await response.json();
        setSettings(prev => ({ ...prev, heroImage: url }));
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
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${API_URL}/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
      <div className="settings-header">
        <h2>⚙️ Ajustes del Sitio</h2>
        <p>Configura parámetros globales de la tienda.</p>
      </div>

      <form onSubmit={handleSave} className="settings-form">
        <section className="settings-section">
          <h3>General</h3>
          <div className="form-group">
            <label>Nombre del Sitio</label>
            <input 
              type="text" 
              name="siteName" 
              value={settings.siteName} 
              onChange={handleChange} 
            />
          </div>
          <div className="form-group">
            <label>Icono del Sitio (Emoji)</label>
            <input 
              type="text" 
              name="siteIcon" 
              value={settings.siteIcon} 
              onChange={handleChange} 
              placeholder="Ej: 🛍️, 🔧, 💻"
            />
          </div>
          <div className="form-group">
            <label>Color de la Barra Superior</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input 
                type="color" 
                name="headerBgColor" 
                value={settings.headerBgColor || '#2563eb'} 
                onChange={handleChange} 
                style={{ width: '50px', height: '40px', padding: '2px' }}
              />
              <input 
                type="text" 
                value={settings.headerBgColor || '#2563eb'} 
                readOnly 
                style={{ width: '100px' }}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Transparencia de la Barra ({settings.headerTransparency || 100}%)</label>
            <input 
              type="range" 
              name="headerTransparency" 
              min="0" 
              max="100" 
              value={settings.headerTransparency || 100} 
              onChange={handleChange} 
            />
            <p className="field-hint">0% es totalmente transparente, 100% es sólido.</p>
          </div>
          <div className="form-group">
            <label>Email de Contacto</label>
            <input 
              type="email" 
              name="contactEmail" 
              value={settings.contactEmail} 
              onChange={handleChange} 
            />
          </div>
        </section>

        <section className="settings-section">
          <h3>Portada (Hero)</h3>
          <div className="form-group">
            <label>Título Principal</label>
            <input 
              type="text" 
              name="heroTitle" 
              value={settings.heroTitle} 
              onChange={handleChange} 
              placeholder="Ej: La Mejor Tecnología a Tu Alcance"
            />
          </div>
          <div className="form-group">
            <label>Descripción</label>
            <textarea 
              name="heroDescription" 
              value={settings.heroDescription} 
              onChange={handleChange} 
              placeholder="Ej: Descubre nuestra selección..."
              rows="3"
            />
          </div>
          <div className="form-group">
            <label>Imagen de Fondo (Hero Banner)</label>
            <input 
              type="file" 
              accept="image/*"
              onChange={handleImageUpload} 
            />
            {settings.heroImage && (
              <div className="settings-preview">
                <img src={settings.heroImage} alt="Hero Preview" style={{ width: '150px', height: 'auto', marginTop: '10px', borderRadius: '4px', border: '1px solid #ddd' }} />
                <button 
                  type="button" 
                  onClick={() => setSettings(prev => ({ ...prev, heroImage: '' }))}
                  style={{ display: 'block', marginTop: '5px', color: 'red', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Eliminar imagen
                </button>
              </div>
            )}
            <p className="field-hint">Esta imagen se usará como fondo (banner) de la sección principal.</p>
          </div>
          <div className="form-group">
            <label>Texto Botón Primario</label>
            <input 
              type="text" 
              name="heroPrimaryBtn" 
              value={settings.heroPrimaryBtn} 
              onChange={handleChange} 
              placeholder="Ej: Ver Productos"
            />
          </div>
          <div className="form-group">
            <label>Texto Botón Secundario</label>
            <input 
              type="text" 
              name="heroSecondaryBtn" 
              value={settings.heroSecondaryBtn} 
              onChange={handleChange} 
              placeholder="Ej: Ofertas Especiales"
            />
          </div>
        </section>

        <section className="settings-section">
          <h3>E-commerce</h3>
          <div className="form-group">
            <label>Umbral de Envío Gratis ($)</label>
            <input 
              type="number" 
              name="freeShippingThreshold" 
              value={settings.freeShippingThreshold} 
              onChange={handleChange} 
            />
          </div>
          <div className="form-group checkbox-group">
            <label>
              <input 
                type="checkbox" 
                name="maintenanceMode" 
                checked={settings.maintenanceMode} 
                onChange={handleChange} 
              />
              Modo Mantenimiento
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
