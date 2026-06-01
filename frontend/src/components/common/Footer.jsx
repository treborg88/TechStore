import React from 'react';

const DEFAULT_FOOTER_CONFIG = {
  brandMessage: 'Tu tienda de confianza para todos los dispositivos electrónicos y accesorios.',
  quickLinksTitle: 'Enlaces Rápidos',
  quickLinks: [
    { label: 'Inicio', href: '/', enabled: true },
    { label: 'Productos', href: '/tienda', enabled: true },
    { label: 'Ofertas', href: '/tienda?promo=1', enabled: true },
    { label: 'Sobre Nosotros', href: '/contacto', enabled: true }
  ],
  supportTitle: 'Atención al Cliente',
  supportLinks: [
    { label: 'Contáctanos', href: '/contacto', enabled: true },
    { label: 'Devoluciones', href: '/contacto', enabled: true },
    { label: 'Preguntas Frecuentes', href: '/contacto', enabled: true },
    { label: 'Estado del Pedido', href: '/orders', enabled: true }
  ],
  socialTitle: 'Síguenos',
  socialLinks: [
    { icon: '📘', href: '', enabled: true },
    { icon: '📱', href: '', enabled: true },
    { icon: '📷', href: '', enabled: true },
    { icon: '🐦', href: '', enabled: true }
  ],
  copyrightText: '© 2026 Eonsclover. Todos los derechos reservados.'
};

function Footer({ siteName = 'Eonsclover', footerConfig }) {
  const config = {
    ...DEFAULT_FOOTER_CONFIG,
    ...(footerConfig || {}),
    quickLinks: Array.isArray(footerConfig?.quickLinks) && footerConfig.quickLinks.length > 0
      ? footerConfig.quickLinks
      : DEFAULT_FOOTER_CONFIG.quickLinks,
    supportLinks: Array.isArray(footerConfig?.supportLinks) && footerConfig.supportLinks.length > 0
      ? footerConfig.supportLinks
      : DEFAULT_FOOTER_CONFIG.supportLinks,
    socialLinks: Array.isArray(footerConfig?.socialLinks) && footerConfig.socialLinks.length > 0
      ? footerConfig.socialLinks
      : DEFAULT_FOOTER_CONFIG.socialLinks
  };

  const enabledQuickLinks = config.quickLinks.filter((link) => link?.enabled !== false);
  const enabledSupportLinks = config.supportLinks.filter((link) => link?.enabled !== false);
  const enabledSocialLinks = config.socialLinks.filter((link) => link?.enabled !== false);

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-column">
            <h3 className="footer-title">{siteName}</h3>
            <p className="footer-text">
              {config.brandMessage}
            </p>
          </div>
          <div className="footer-column">
            <h4 className="footer-subtitle">{config.quickLinksTitle}</h4>
            <ul className="footer-links">
              {enabledQuickLinks.map((link, index) => (
                <li key={`quick-${index}`}>
                  <a href={link.href || '#'} className="footer-link">{link.label || 'Enlace'}</a>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-column">
            <h4 className="footer-subtitle">{config.supportTitle}</h4>
            <ul className="footer-links">
              {enabledSupportLinks.map((link, index) => (
                <li key={`support-${index}`}>
                  <a href={link.href || '#'} className="footer-link">{link.label || 'Enlace'}</a>
                </li>
              ))}
            </ul>
          </div>
          <div className="footer-column">
            <h4 className="footer-subtitle">{config.socialTitle}</h4>
            <div className="social-links">
              {enabledSocialLinks.map((social, index) => {
                const href = social.href || '#';
                const isExternal = /^https?:\/\//i.test(href);
                return (
                  <a
                    key={`social-${index}`}
                    href={href}
                    className="social-link"
                    target={isExternal ? '_blank' : undefined}
                    rel={isExternal ? 'noreferrer noopener' : undefined}
                  >
                    {social.icon || '🔗'}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>{config.copyrightText}</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
