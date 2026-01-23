import { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiUrl } from '../services/apiClient';
import { toast } from 'react-hot-toast';
import './Contact.css';

const defaultContactData = {
  contactTitle: 'Contáctanos',
  contactSubtitle: 'Estamos aquí para ayudarte con cualquier consulta sobre nuestros productos y servicios.',
  contactCompany: 'TechStore S.R.L.',
  contactEmail: 'soporte@techstore.com',
  contactPhone: '+1 (809) 555-0147',
  contactWhatsapp: '+1 (809) 555-7788',
  contactAddress: 'Av. Winston Churchill 123, Santo Domingo, RD',
  contactHours: 'Lun - Sáb: 9:00 AM - 7:00 PM',
  contactSupportLine: 'Respuesta en menos de 24 horas',
  contactMapUrl: 'https://www.google.com/maps?q=Santo%20Domingo&output=embed'
};

export default function Contact({ user }) {
  const isAdmin = user?.role === 'admin';
  const [_loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactData, setContactData] = useState(defaultContactData);
  const contactKeys = useMemo(() => Object.keys(defaultContactData), []);

  const heroStats = useMemo(() => (
    [
      { label: 'Clientes felices', value: '12k+' },
      { label: 'Pedidos entregados', value: '38k+' },
      { label: 'Soporte 24/7', value: 'Siempre' }
    ]
  ), []);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const response = await apiFetch(apiUrl('/settings'));
        if (!response.ok) return;
        const data = await response.json();
        const nextData = { ...defaultContactData };
        contactKeys.forEach((key) => {
          if (data[key] !== undefined && data[key] !== null) {
            nextData[key] = data[key];
          }
        });
        setContactData(nextData);
      } catch (error) {
        console.error('Error cargando ajustes de contacto:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setContactData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;
    setSaving(true);
    try {
      const payload = contactKeys.reduce((acc, key) => {
        acc[key] = contactData[key];
        return acc;
      }, {});

      const response = await apiFetch(apiUrl('/settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.message || 'Error al guardar ajustes');
      }

      toast.success('Datos de contacto actualizados');
    } catch (error) {
      console.error(error);
      toast.error(error.message || 'Error al guardar ajustes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="contact-page">
      <section className="contact-hero">
        <div className="container contact-hero-content">
          <div>
            <p className="contact-kicker">Atención personalizada</p>
            <h2>{contactData.contactTitle}</h2>
            <p className="contact-subtitle">{contactData.contactSubtitle}</p>
            <div className="contact-actions">
              <a className="contact-btn" href={`mailto:${contactData.contactEmail}`}>Enviar correo</a>
              <a className="contact-btn contact-btn-whatsapp" href={`https://wa.me/${contactData.contactWhatsapp?.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>
            </div>
          </div>
          <div className="contact-hero-card">
            <h3>{contactData.contactCompany}</h3>
            <p>{contactData.contactSupportLine}</p>
            <div className="contact-hero-stats">
              {heroStats.map((stat) => (
                <div key={stat.label}>
                  <span>{stat.value}</span>
                  <small>{stat.label}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="contact-content">
        <div className="container contact-grid">
          <div className="contact-info">
            <div className="contact-card">
              <h3>Información principal</h3>
              <div className="contact-info-list">
                <div>
                  <span>Email</span>
                  <strong>{contactData.contactEmail}</strong>
                </div>
                <div>
                  <span>Teléfono</span>
                  <strong>{contactData.contactPhone}</strong>
                </div>
                <div>
                  <span>WhatsApp</span>
                  <strong>{contactData.contactWhatsapp}</strong>
                </div>
                <div>
                  <span>Dirección</span>
                  <strong>{contactData.contactAddress}</strong>
                </div>
                <div>
                  <span>Horario</span>
                  <strong>{contactData.contactHours}</strong>
                </div>
              </div>
            </div>

            <div className="contact-card">
              <h3>Ubicación</h3>
              <p>Visítanos en nuestra oficina principal o agenda una cita personalizada.</p>
              {contactData.contactMapUrl ? (
                <div className="contact-map">
                  <iframe
                    title="Mapa"
                    src={contactData.contactMapUrl}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : (
                <p className="contact-muted">No hay mapa configurado.</p>
              )}
            </div>
          </div>

          <div className="contact-form">
            {isAdmin ? (
              <div className="contact-card">
                <h3>Editar datos de contacto</h3>
                <p className="contact-muted">Solo los administradores pueden modificar esta información.</p>
                <form onSubmit={handleSave} className="contact-edit-form">
                  <label>
                    Título
                    <input name="contactTitle" value={contactData.contactTitle} onChange={handleChange} />
                  </label>
                  <label>
                    Subtítulo
                    <textarea name="contactSubtitle" rows="3" value={contactData.contactSubtitle} onChange={handleChange} />
                  </label>
                  <label>
                    Empresa
                    <input name="contactCompany" value={contactData.contactCompany} onChange={handleChange} />
                  </label>
                  <label>
                    Email
                    <input name="contactEmail" value={contactData.contactEmail} onChange={handleChange} />
                  </label>
                  <label>
                    Teléfono
                    <input name="contactPhone" value={contactData.contactPhone} onChange={handleChange} />
                  </label>
                  <label>
                    WhatsApp
                    <input name="contactWhatsapp" value={contactData.contactWhatsapp} onChange={handleChange} />
                  </label>
                  <label>
                    Dirección
                    <input name="contactAddress" value={contactData.contactAddress} onChange={handleChange} />
                  </label>
                  <label>
                    Horario
                    <input name="contactHours" value={contactData.contactHours} onChange={handleChange} />
                  </label>
                  <label>
                    Mensaje de soporte
                    <input name="contactSupportLine" value={contactData.contactSupportLine} onChange={handleChange} />
                  </label>
                  <label>
                    URL del mapa
                    <input name="contactMapUrl" value={contactData.contactMapUrl} onChange={handleChange} />
                  </label>
                  <button type="submit" disabled={saving} className="contact-save-btn">
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
