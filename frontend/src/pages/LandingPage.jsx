// LandingPage.jsx - Componente autónomo para landing page personalizable
// Cada sección se renderiza segun la config almacenada en app_settings (landingPageConfig)

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiFetch, apiUrl } from '../services/apiClient';
import { cloneLandingPageConfig } from '../utils/landingPageDefaults';
import { useSeo } from '../hooks/useSeo';
import './LandingPage.css';

/* ═══════════════ RENDER FUNCTIONS PER SECTION TYPE ═══════════════ */

/** Hero — Encabezado principal con CTA */
const renderHero = (section) => {
  const { data, styles } = section;
  const isReverse = data.layout === 'text-right';

  // Estilos inline dinámicos desde la configuración
  const sectionStyle = {
    backgroundColor: styles.bgColor,
    backgroundImage: styles.bgImage ? `url(${styles.bgImage})` : styles.bgGradient || 'none',
    color: styles.textColor,
    minHeight: styles.minHeight || 500,
  };

  // Overlay semi-transparente cuando hay imagen de fondo
  if (styles.bgImage) {
    sectionStyle.position = 'relative';
  }

  return (
    <section className="lp-section lp-hero" style={sectionStyle}>
      {styles.bgImage && (
        <div style={{ position: 'absolute', inset: 0, backgroundColor: `rgb(var(--lp-overlay-rgb, 0 0 0) / ${styles.bgOverlayOpacity || 0.5})`, zIndex: 1 }} />
      )}
      <div className={`lp-container lp-split ${isReverse ? 'lp-split--reverse' : ''}`}>
        <div className="lp-hero__text">
          {data.badgeText && (
            <span className="lp-hero__badge" style={{ backgroundColor: data.badgeColor || styles.ctaBgColor }}>
              {data.badgeText}
            </span>
          )}
          <h1 className="lp-h1">{data.title}</h1>
          <p className="lp-body">{data.subtitle}</p>
          {data.ctaText && data.ctaLink && (
            <Link to={data.ctaLink} className="lp-btn lp-btn--lg" style={{ backgroundColor: styles.ctaBgColor, color: styles.ctaTextColor }}>
              {data.ctaText}
            </Link>
          )}
        </div>
        <div className="lp-hero__image">
          {data.image
            ? <img src={data.image} alt={data.title} loading="eager" />
            : <div className="lp-image-placeholder" />
          }
        </div>
      </div>
    </section>
  );
};

/** Value Proposition — Grid de puntos de valor */
const renderValueProposition = (section) => {
  const { data, styles } = section;
  return (
    <section className="lp-section" style={{ backgroundColor: styles.bgColor, color: styles.textColor }}>
      <div className="lp-container lp-text-center">
        {data.label && <p className="lp-small" style={{ color: styles.textColor }}>{data.label}</p>}
        <h2 className="lp-h2">{data.title}</h2>
        {data.description && <p className="lp-body lp-max-w-600">{data.description}</p>}
        <div className="lp-points-grid">
          {(data.points || []).map((point, i) => (
            <div key={i} className="lp-point-card" style={{ backgroundColor: styles.cardBgColor, border: `1px solid ${styles.cardBorderColor}`, boxShadow: styles.cardShadow }}>
              <div className="lp-point-icon" style={{ backgroundColor: styles.iconBgColor }}>
                {point.iconImage ? <img src={point.iconImage} alt={point.title} /> : point.icon}
              </div>
              <h3 className="lp-h3">{point.title}</h3>
              {point.description && <p className="lp-body lp-muted">{point.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/** Product Highlight — Split con imagen y texto */
const renderProductHighlight = (section) => {
  const { data, styles } = section;
  const isImageLeft = data.layout === 'image-left';
  return (
    <section className="lp-section" style={{ backgroundColor: styles.bgColor, color: styles.textColor }}>
      <div className={`lp-container lp-split ${isImageLeft ? '' : 'lp-split--reverse'}`}>
        <div className="lp-highlight__image">
          {data.image
            ? <img src={data.image} alt={data.title} loading="lazy" />
            : <div className="lp-image-placeholder" />
          }
        </div>
        <div>
          {data.label && <p className="lp-small">{data.label}</p>}
          <h2 className="lp-h2">{data.title}</h2>
          <p className="lp-body">{data.description}</p>
          {data.ctaText && data.ctaLink && (
            <Link to={data.ctaLink} className="lp-btn" style={{ backgroundColor: styles.ctaBgColor, color: styles.ctaTextColor }}>
              {data.ctaText}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

/** Trust Banner — Franja de confianza */
const renderTrustBanner = (section) => {
  const { data, styles } = section;
  return (
    <section className="lp-section lp-trust" style={{ backgroundColor: styles.bgColor, color: styles.textColor }}>
      <div className="lp-container">
        <h2 className="lp-h2">{data.title}</h2>
        {data.subtitle && <p className="lp-body">{data.subtitle}</p>}
      </div>
    </section>
  );
};

/** Featured Product — Producto estrella con specs y precios */
const renderFeaturedProduct = (section) => {
  const { data, styles } = section;
  return (
    <section className="lp-section" style={{ backgroundColor: styles.bgColor, color: styles.textColor }}>
      <div className="lp-container lp-split">
        <div className="lp-featured__image">
          {data.image
            ? <img src={data.image} alt={data.productName} loading="lazy" />
            : <div className="lp-image-placeholder" />
          }
        </div>
        <div>
          {data.badgeText && (
            <span className="lp-featured__badge" style={{ backgroundColor: styles.priceSaleColor, color: 'var(--lp-on-accent)' }}>
              {data.badgeText}
            </span>
          )}
          {data.label && <p className="lp-small">{data.label}</p>}
          <h2 className="lp-h2">{data.productName}</h2>
          <p className="lp-body">{data.description}</p>

          {/* Tabla de especificaciones */}
          {data.specs && data.specs.length > 0 && (
            <table className="lp-specs-table">
              <tbody>
                {data.specs.map((spec, i) => (
                  <tr key={i} style={{ borderBottomColor: styles.specsDotColor }}>
                    <td>{spec.key}</td>
                    <td>{spec.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Precios */}
          <div className="lp-pricing">
            {data.salePrice != null && (
              <span className="lp-price-current" style={{ color: styles.priceSaleColor }}>
                ${Number(data.salePrice).toFixed(2)}
              </span>
            )}
            {data.originalPrice != null && data.originalPrice !== data.salePrice && (
              <span className="lp-price-original" style={{ color: styles.priceOriginalColor }}>
                ${Number(data.originalPrice).toFixed(2)}
              </span>
            )}
          </div>

          {data.ctaText && data.ctaLink && (
            <Link to={data.ctaLink} className="lp-btn" style={{ backgroundColor: styles.ctaBgColor, color: styles.ctaTextColor }}>
              {data.ctaText}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

/** How It Works — Pasos con número */
const renderHowItWorks = (section) => {
  const { data, styles } = section;
  return (
    <section className="lp-section" style={{ backgroundColor: styles.bgColor, color: styles.textColor }}>
      <div className="lp-container lp-text-center">
        <h2 className="lp-h2">{data.title}</h2>
        <div className="lp-steps-grid">
          {(data.steps || []).map((step, i) => (
            <div key={i} className="lp-step-card" style={{ backgroundColor: styles.stepCardBg, border: `1px solid ${styles.stepCardBorder}` }}>
              <div className="lp-step-number" style={{ backgroundColor: styles.stepNumberBg, color: styles.stepNumberColor }}>
                {step.number || i + 1}
              </div>
              <h3 className="lp-h3">{step.title}</h3>
              <p className="lp-body lp-muted">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/** Product Showcase — Grid de productos con badges y precios */
const renderProductShowcase = (section) => {
  const { data, styles } = section;
  return (
    <section className="lp-section" style={{ backgroundColor: styles.bgColor, color: styles.textColor }}>
      <div className="lp-container lp-text-center">
        <h2 className="lp-h2">{data.title}</h2>
        {data.subtitle && <p className="lp-body lp-max-w-600">{data.subtitle}</p>}
        <div className="lp-products-grid">
          {(data.products || []).map((product, i) => (
            <div key={i} className="lp-product-card" style={{ backgroundColor: styles.cardBgColor, border: `1px solid ${styles.cardBorderColor}`, boxShadow: styles.cardShadow }}>
              <div className="lp-product-card__image">
                {product.image
                  ? <img src={product.image} alt={product.name} loading="lazy" />
                  : <div className="lp-image-placeholder" />
                }
                {product.badgeText && (
                  <span className="lp-product-card__badge" style={{ backgroundColor: product.badgeColor || styles.ctaBgColor }}>
                    {product.badgeText}
                  </span>
                )}
              </div>
              <div className="lp-product-card__body" style={{ color: styles.textColor }}>
                {product.category && <span className="lp-product-card__category">{product.category}</span>}
                <h3 className="lp-h3">{product.name}</h3>
                <p className="lp-body lp-muted" style={{ fontSize: '0.9rem' }}>{product.description}</p>
                {product.features && product.features.length > 0 && (
                  <ul className="lp-product-card__features">
                    {product.features.map((f, j) => <li key={j}>{f}</li>)}
                  </ul>
                )}
                <div className="lp-product-card__pricing">
                  {product.salePrice != null && (
                    <span className="lp-product-card__price-sale" style={{ color: styles.ctaBgColor }}>
                      ${Number(product.salePrice).toFixed(2)}
                    </span>
                  )}
                  {product.originalPrice != null && product.originalPrice !== product.salePrice && (
                    <span className="lp-product-card__price-original">
                      ${Number(product.originalPrice).toFixed(2)}
                    </span>
                  )}
                </div>
                {product.ctaText && product.ctaLink && (
                  <Link to={product.ctaLink} className="lp-btn lp-product-card__cta" style={{ backgroundColor: styles.ctaBgColor, color: styles.ctaTextColor }}>
                    {product.ctaText}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/** Testimonials — Grid de testimonios con estrellas */
const renderTestimonials = (section) => {
  const { data, styles } = section;
  return (
    <section className="lp-section" style={{ backgroundColor: styles.bgColor, color: styles.textColor }}>
      <div className="lp-container lp-text-center">
        <h2 className="lp-h2">{data.title}</h2>
        {data.subtitle && <p className="lp-body lp-max-w-600">{data.subtitle}</p>}
        <div className="lp-testimonials-grid">
          {(data.items || []).map((item, i) => (
            <div key={i} className="lp-testimonial-card" style={{ backgroundColor: styles.cardBgColor, border: `1px solid ${styles.cardBorderColor}`, boxShadow: styles.cardShadow }}>
              <p className="lp-testimonial-quote" style={{ color: styles.quoteColor }}>{item.quote}</p>
              <div className="lp-testimonial-author">
                <div className="lp-avatar">
                  {item.avatar ? <img src={item.avatar} alt={item.author} /> : item.author?.charAt(0) || '?'}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div className="lp-author-name" style={{ color: styles.authorColor }}>{item.author}</div>
                  {item.rating > 0 && (
                    <div className="lp-stars">
                      {Array.from({ length: 5 }, (_, j) => (
                        <span key={j} className="lp-star" style={{ color: j < item.rating ? styles.starColor : 'var(--lp-star-inactive)' }}>★</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

/** Sección de captura de leads con estado local válido */
const LeadCaptureSection = ({ section }) => {
  const { data, styles } = section;
  const [submitted, setSubmitted] = useState(false);

  // Handler para submit del formulario
  const handleSubmit = (e) => {
    e.preventDefault();
    // Solo muestra mensaje de éxito (sin backend real para leads por ahora)
    setSubmitted(true);
  };

  return (
    <section className="lp-section lp-lead-capture" style={{ backgroundColor: styles.bgColor, color: styles.textColor }}>
      <div className="lp-container lp-split">
        <div>
          <h2 className="lp-h2">{data.title}</h2>
          {data.aboutText && <p className="lp-body">{data.aboutText}</p>}
        </div>
        <div>
          <p className="lp-body">{data.description}</p>
          {submitted ? (
            <div className="lp-lead-success">{data.successMessage}</div>
          ) : (
            <form className="lp-lead-form" onSubmit={handleSubmit}>
              {Array.isArray(data.fields) && data.fields.includes('name') && (
                <input type="text" placeholder="Tu nombre" required style={{ backgroundColor: styles.inputBgColor, borderColor: styles.inputBorderColor }} />
              )}
              {Array.isArray(data.fields) && data.fields.includes('email') && (
                <input type="email" placeholder="Tu email" required style={{ backgroundColor: styles.inputBgColor, borderColor: styles.inputBorderColor }} />
              )}
              <button type="submit" className="lp-btn" style={{ backgroundColor: styles.submitBgColor, color: styles.submitTextColor }}>
                {data.submitText}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

/** Lead Capture — Formulario de captura */
const renderLeadCapture = (section) => {
  return <LeadCaptureSection section={section} />;
};

/** Final CTA — Cierre con llamada a la acción */
const renderFinalCta = (section) => {
  const { data, styles } = section;
  return (
    <section className="lp-section lp-text-center" style={{ backgroundColor: styles.bgColor, color: styles.textColor }}>
      <div className="lp-container">
        <h2 className="lp-h1">{data.title}</h2>
        {data.subtitle && <p className="lp-body lp-max-w-600">{data.subtitle}</p>}
        {data.ctaText && data.ctaLink && (
          <Link to={data.ctaLink} className="lp-btn lp-btn--lg" style={{ backgroundColor: styles.ctaBgColor, color: styles.ctaTextColor }}>
            {data.ctaText}
          </Link>
        )}
      </div>
    </section>
  );
};

/* ═══════════════ MAPA DE RENDERIZADO ═══════════════ */

/** Mapa tipo -> función de renderizado */
const SECTION_RENDERERS = {
  hero: renderHero,
  valueProposition: renderValueProposition,
  productHighlight: renderProductHighlight,
  trustBanner: renderTrustBanner,
  featuredProduct: renderFeaturedProduct,
  howItWorks: renderHowItWorks,
  productShowcase: renderProductShowcase,
  testimonials: renderTestimonials,
  leadCapture: renderLeadCapture,
  finalCta: renderFinalCta,
};

/* ═══════════════ COMPONENTE PRINCIPAL ═══════════════ */

const LandingPage = () => {
  // SEO dinámico para la landing page
  useSeo('home');
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const observerRef = useRef(null);

  // Fetch de la configuración desde /api/settings/public
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await apiFetch(apiUrl('/settings/public'), {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        const data = await res.json();

        // Parsear landingPageConfig del JSON guardado en settings
        let raw = null;
        if (data.landingPageConfig) {
          try { raw = JSON.parse(data.landingPageConfig); } catch { raw = null; }
        }

        const merged = cloneLandingPageConfig(raw);

        // Si la landing page esta desactivada, redirigir a home
        if (!merged.enabled) {
          navigate('/', { replace: true });
          return;
        }

        setConfig(merged);
      } catch (err) {
        console.error('Error loading landing page config:', err);
        navigate('/', { replace: true });
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [navigate]);

  // IntersectionObserver para animaciones de scroll
  useEffect(() => {
    if (!config) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-visible');
          }
        });
      },
      { threshold: 0.15 }
    );

    // Observar todas las secciones animables
    const elements = document.querySelectorAll('.lp-animate');
    elements.forEach(el => observerRef.current.observe(el));

    return () => observerRef.current?.disconnect();
  }, [config]);

  // Título dinámico de la landing page
  useEffect(() => {
    if (!config?.pageTitle) return;
    document.title = config.pageTitle;
  }, [config]);

  // Aplicar CSS variables globales desde la configuración
  const applyGlobalStyles = useCallback(() => {
    if (!config?.globalStyles) return {};
    const gs = config.globalStyles;
    return {
      '--lp-font': gs.fontFamily || 'inherit',
      '--lp-text': gs.textColor || 'var(--text-color)',
      '--lp-accent': gs.accentColor || 'var(--primary-color)',
      '--lp-bg': gs.lightColor || 'var(--background-color)',
      '--lp-heading': gs.headingColor || 'var(--text-color)',
      '--lp-muted-text': gs.textLightColor || 'var(--text-color)',
      '--lp-border': gs.darkColor || 'var(--secondary-color)',
      '--lp-on-accent': gs.lightColor || 'var(--background-color)',
      '--lp-star-inactive': gs.darkColor || 'var(--secondary-color)',
      '--lp-overlay-rgb': '0 0 0',
      '--lp-max-width': `${gs.maxWidth || 1200}px`,
      '--lp-section-padding': `${gs.sectionPadding || 80}px`,
      '--lp-section-padding-mobile': `${gs.sectionPaddingMobile || 48}px`,
    };
  }, [config]);

  // Estado de carga
  if (loading) {
    return (
      <div className="lp-loading">
        <div className="lp-loading__spinner" />
        Cargando...
      </div>
    );
  }

  // No debería llegar aquí si la landing está desactivada (navigate redirige)
  if (!config) return null;

  // Filtrar solo secciones habilitadas y renderizar en orden
  const activeSections = config.sections.filter(s => s.enabled);

  return (
    <div className="lp-page" style={applyGlobalStyles()}>
      {activeSections.map((section) => {
        const renderer = SECTION_RENDERERS[section.type];
        if (!renderer) return null;
        return (
          <div key={section.id} className="lp-animate">
            {renderer(section)}
          </div>
        );
      })}
    </div>
  );
};

export default LandingPage;
