// landingServiceTemplates.js — Presets de landing page para negocios de servicios
// Basados en LandingServicios.jsx (Clínica Dental, Bufete Jurídico, Spa & Masajes)
// Cada preset define colores globales + contenido completo para todas las secciones

const PRICE_RANGE = { min: 500, max: 2500 };

const DENTAL = {
  id: 'dental-clinic',
  name: 'Clínica Dental',
  icon: '🦷',
  badge: 'Odontología · Salud Bucal',
  description: 'Clínica dental con servicios preventivos, ortodoncia, endodoncia, estética y odontopediatría.',
  pageTitle: 'Clínica Dental Vitalis',
  route: '/servicios',
  globalStyles: {
    darkColor: '#155e75',
    lightColor: '#f0fdf4',
    accentColor: '#d97706',
    textColor: '#1c1917',
    textLightColor: '#57534e',
    headingColor: '#0f172a',
    maxWidth: 1200,
    sectionPadding: 80,
    sectionPaddingMobile: 48,
    fontFamily: 'Georgia, "Times New Roman", serif'
  },
  sections: [
    {
      type: 'hero',
      data: {
        layout: 'text-left',
        title: 'Sonrisas sanas, cuidado cercano',
        subtitle: 'Atención odontológica integral para niños y adultos, con diagnósticos precisos y un equipo que te acompaña en cada paso.',
        ctaText: 'Agendar cita',
        ctaLink: '/contacto',
        image: '',
        badgeText: 'Odontología familiar',
        badgeColor: '#d97706'
      },
      styles: {
        bgColor: '#155e75',
        bgGradient: '',
        textColor: '#ffffff',
        ctaBgColor: '#155e75',
        ctaTextColor: '#ffffff',
        minHeight: 500
      }
    },
    {
      type: 'valueProposition',
      data: {
        label: 'Nuestras Ventajas',
        title: '¿Por qué elegirnos?',
        description: 'Brindamos atención odontológica de calidad con diagnósticos integrales y tratamientos óptimos.',
        points: [
          { icon: '🦷', iconImage: '', title: 'Odontología preventiva', description: 'Limpiezas, fluorización y educación para cuidar tu sonrisa.' },
          { icon: '😁', iconImage: '', title: 'Ortodoncia', description: 'Brackets y alineadores para una mordida funcional y estética.' },
          { icon: '🔬', iconImage: '', title: 'Endodoncia', description: 'Tratamientos de conducto con precisión y mínima molestia.' },
          { icon: '⭐', iconImage: '', title: 'Estética dental', description: 'Blanqueamientos y carillas para realzar tu sonrisa.' }
        ]
      },
      styles: {
        bgColor: '#f0fdf4',
        textColor: '#1c1917',
        iconBgColor: '#e0f2fe',
        cardBgColor: '#ffffff',
        cardBorderColor: '#155e75',
        cardShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }
    },
    {
      type: 'productHighlight',
      data: {
        layout: 'image-right',
        label: 'Quiénes Somos',
        title: 'Bienvenido a Clínica Dental Vitalis',
        description: 'Somos un equipo comprometido con la salud bucal de toda la familia, combinando tecnología moderna con un trato cálido y personalizado. Cada tratamiento comienza con un diagnóstico completo, para ofrecerte un plan claro y adaptado a tus necesidades.',
        ctaText: 'Conoce más',
        ctaLink: '/contacto',
        image: ''
      },
      styles: {
        bgColor: '#ffffff',
        textColor: '#1c1917',
        ctaBgColor: '#155e75',
        ctaTextColor: '#ffffff'
      }
    },
    {
      type: 'trustBanner',
      data: {
        title: '+12 años de experiencia · +3,000 pacientes atendidos · 98% satisfacción',
        subtitle: 'Atención especializada para niños y adultos en un ambiente cálido y de confianza.'
      },
      styles: {
        bgColor: '#d97706',
        textColor: '#ffffff'
      }
    },
    {
      type: 'testimonials',
      data: {
        title: 'Lo que dicen nuestros pacientes',
        subtitle: 'Opiniones reales de personas que confían en nosotros.',
        items: [
          { quote: 'Desde que llevo a mis hijos aquí, las visitas al dentista dejaron de ser un drama. El trato es increíble.', author: 'Paciente satisfecha', avatar: '', rating: 5 },
          { quote: 'Excelentes profesionales, me explicaron cada paso del tratamiento con claridad.', author: 'Carlos Méndez', avatar: '', rating: 5 },
          { quote: 'Ambiente cómodo y atención personalizada. Totalmente recomendados.', author: 'María Fernández', avatar: '', rating: 5 }
        ]
      },
      styles: {
        bgColor: '#f0fdf4',
        textColor: '#1c1917',
        cardBgColor: '#ffffff',
        cardBorderColor: '#e5e7eb',
        cardShadow: '0 2px 8px rgba(0,0,0,0.06)',
        quoteColor: '#1c1917',
        authorColor: '#57534e',
        starColor: '#d97706'
      }
    },
    {
      type: 'finalCta',
      data: {
        title: '¿Listo para cuidar tu sonrisa?',
        subtitle: 'Agenda una consulta hoy mismo y descubre la diferencia de una atención cercana y profesional.',
        ctaText: 'Agendar cita',
        ctaLink: '/contacto'
      },
      styles: {
        bgColor: '#155e75',
        textColor: '#ffffff',
        ctaBgColor: '#d97706',
        ctaTextColor: '#ffffff'
      }
    }
  ]
};

const LEGAL = {
  id: 'legal-firm',
  name: 'Bufete Jurídico',
  icon: '⚖️',
  badge: 'Derecho · Asesoría Legal',
  description: 'Bufete de abogados con asesoría integral en derecho civil, laboral, penal, inmobiliario y corporativo.',
  pageTitle: 'Morales & Asociados',
  route: '/servicios',
  globalStyles: {
    darkColor: '#1e293b',
    lightColor: '#f8fafc',
    accentColor: '#d97706',
    textColor: '#1c1917',
    textLightColor: '#57534e',
    headingColor: '#0f172a',
    maxWidth: 1200,
    sectionPadding: 80,
    sectionPaddingMobile: 48,
    fontFamily: '"Inter", system-ui, sans-serif'
  },
  sections: [
    {
      type: 'hero',
      data: {
        layout: 'text-left',
        title: 'Defensa legal clara y comprometida',
        subtitle: 'Asesoría jurídica integral para personas y empresas, con un equipo que traduce la ley en soluciones concretas.',
        ctaText: 'Solicitar consulta',
        ctaLink: '/contacto',
        image: '',
        badgeText: 'Bufete de abogados',
        badgeColor: '#d97706'
      },
      styles: {
        bgColor: '#1e293b',
        bgGradient: '',
        textColor: '#ffffff',
        ctaBgColor: '#1e293b',
        ctaTextColor: '#ffffff',
        minHeight: 500
      }
    },
    {
      type: 'valueProposition',
      data: {
        label: 'Áreas de práctica',
        title: 'Cubrimos todas las ramas del derecho',
        description: 'Ofrecemos asesoría legal honesta y efectiva, protegiendo los derechos e intereses de cada cliente.',
        points: [
          { icon: '⚖️', iconImage: '', title: 'Derecho civil', description: 'Contratos, demandas y conflictos entre particulares.' },
          { icon: '💼', iconImage: '', title: 'Derecho laboral', description: 'Defensa de derechos para empleados y empleadores.' },
          { icon: '🔨', iconImage: '', title: 'Derecho penal', description: 'Representación legal sólida en procesos penales.' },
          { icon: '🏠', iconImage: '', title: 'Derecho inmobiliario', description: 'Compraventas, alquileres y títulos de propiedad.' }
        ]
      },
      styles: {
        bgColor: '#f8fafc',
        textColor: '#1c1917',
        iconBgColor: '#e2e8f0',
        cardBgColor: '#ffffff',
        cardBorderColor: '#1e293b',
        cardShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }
    },
    {
      type: 'productHighlight',
      data: {
        layout: 'image-right',
        label: 'Quiénes Somos',
        title: 'Bienvenido a Morales & Asociados',
        description: 'Somos un equipo de abogados comprometido con representar tus intereses con rigor, ética y cercanía. Analizamos cada caso a fondo para ofrecerte una estrategia clara, honesta y orientada a resultados.',
        ctaText: 'Conoce más',
        ctaLink: '/contacto',
        image: ''
      },
      styles: {
        bgColor: '#ffffff',
        textColor: '#1c1917',
        ctaBgColor: '#1e293b',
        ctaTextColor: '#ffffff'
      }
    },
    {
      type: 'trustBanner',
      data: {
        title: '+15 años de trayectoria · +500 casos resueltos · Atención 24/7',
        subtitle: 'Atención personalizada y confidencial con honorarios transparentes desde el inicio.'
      },
      styles: {
        bgColor: '#d97706',
        textColor: '#ffffff'
      }
    },
    {
      type: 'testimonials',
      data: {
        title: 'Lo que dicen nuestros clientes',
        subtitle: 'Casos reales, resultados concretos.',
        items: [
          { quote: 'Nos sentimos acompañados en todo momento. La claridad con la que explicaron cada paso nos dio mucha tranquilidad.', author: 'Cliente corporativo', avatar: '', rating: 5 },
          { quote: 'Profesionales íntegros y comprometidos. Resolvieron mi caso con rapidez y eficacia.', author: 'Ana Guerrero', avatar: '', rating: 5 },
          { quote: 'Los recomiendo ampliamente. Su enfoque cercano y su conocimiento legal marcaron la diferencia.', author: 'Roberto Sánchez', avatar: '', rating: 5 }
        ]
      },
      styles: {
        bgColor: '#f8fafc',
        textColor: '#1c1917',
        cardBgColor: '#ffffff',
        cardBorderColor: '#e5e7eb',
        cardShadow: '0 2px 8px rgba(0,0,0,0.06)',
        quoteColor: '#1c1917',
        authorColor: '#57534e',
        starColor: '#d97706'
      }
    },
    {
      type: 'finalCta',
      data: {
        title: '¿Necesitas asesoría legal?',
        subtitle: 'Contáctanos hoy y obtén una consulta inicial con nuestro equipo de abogados.',
        ctaText: 'Solicitar consulta',
        ctaLink: '/contacto'
      },
      styles: {
        bgColor: '#1e293b',
        textColor: '#ffffff',
        ctaBgColor: '#d97706',
        ctaTextColor: '#ffffff'
      }
    }
  ]
};

const SPA = {
  id: 'spa-wellness',
  name: 'Spa & Masajes',
  icon: '💆',
  badge: 'Bienestar · Relajación',
  description: 'Spa con masajes relajantes, terapéuticos, reflexología, aromaterapia y tratamientos faciales.',
  pageTitle: 'Spa Armonía',
  route: '/servicios',
  globalStyles: {
    darkColor: '#065f46',
    lightColor: '#f0fdf4',
    accentColor: '#e11d48',
    textColor: '#1c1917',
    textLightColor: '#57534e',
    headingColor: '#0f172a',
    maxWidth: 1200,
    sectionPadding: 80,
    sectionPaddingMobile: 48,
    fontFamily: '"Georgia", "Palatino Linotype", serif'
  },
  sections: [
    {
      type: 'hero',
      data: {
        layout: 'text-left',
        title: 'Tu momento de calma comienza aquí',
        subtitle: 'Terapias de masaje y bienestar diseñadas para relajar tu cuerpo, despejar tu mente y recargar tu energía.',
        ctaText: 'Reservar sesión',
        ctaLink: '/contacto',
        image: '',
        badgeText: 'Spa & bienestar',
        badgeColor: '#e11d48'
      },
      styles: {
        bgColor: '#065f46',
        bgGradient: '',
        textColor: '#ffffff',
        ctaBgColor: '#065f46',
        ctaTextColor: '#ffffff',
        minHeight: 500
      }
    },
    {
      type: 'valueProposition',
      data: {
        label: 'Cartera de servicios',
        title: 'Tratamientos para tu bienestar',
        description: 'Cada terapia es diseñada por especialistas certificados, usando productos naturales y técnicas probadas.',
        points: [
          { icon: '🌊', iconImage: '', title: 'Masaje relajante', description: 'Libera tensiones con técnicas suaves.' },
          { icon: '💪', iconImage: '', title: 'Masaje terapéutico', description: 'Alivio de dolores musculares con trabajo profundo.' },
          { icon: '🦶', iconImage: '', title: 'Reflexología', description: 'Estimulación de puntos clave para tu bienestar.' },
          { icon: '🌿', iconImage: '', title: 'Aromaterapia', description: 'Aceites esenciales que potencian la relajación.' }
        ]
      },
      styles: {
        bgColor: '#f0fdf4',
        textColor: '#1c1917',
        iconBgColor: '#d1fae5',
        cardBgColor: '#ffffff',
        cardBorderColor: '#065f46',
        cardShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }
    },
    {
      type: 'productHighlight',
      data: {
        layout: 'image-right',
        label: 'Quiénes Somos',
        title: 'Bienvenido a Spa Armonía',
        description: 'Creamos un espacio pensado para que te desconectes del ritmo diario y te reconectes contigo mismo. Cada terapia es diseñada por especialistas certificados, usando productos naturales y técnicas probadas.',
        ctaText: 'Ver tratamientos',
        ctaLink: '/contacto',
        image: ''
      },
      styles: {
        bgColor: '#ffffff',
        textColor: '#1c1917',
        ctaBgColor: '#065f46',
        ctaTextColor: '#ffffff'
      }
    },
    {
      type: 'trustBanner',
      data: {
        title: '+8 años de experiencia · +20 tratamientos · 100% productos naturales',
        subtitle: 'Terapeutas certificados y ambientes privados para tu máxima relajación.'
      },
      styles: {
        bgColor: '#e11d48',
        textColor: '#ffffff'
      }
    },
    {
      type: 'testimonials',
      data: {
        title: 'Lo que dicen nuestros visitantes',
        subtitle: 'Experiencias que inspiran bienestar.',
        items: [
          { quote: 'Salí del spa sintiéndome como nueva. La atención y el ambiente son simplemente perfectos.', author: 'Clienta habitual', avatar: '', rating: 5 },
          { quote: 'Un espacio de paz en medio del caos. Los masajes son increíbles, volveré sin duda.', author: 'Laura Martínez', avatar: '', rating: 5 },
          { quote: 'Productos naturales, terapeutas expertas y un ambiente que te envuelve en calma. 100% recomendado.', author: 'Andrea Torres', avatar: '', rating: 5 }
        ]
      },
      styles: {
        bgColor: '#f0fdf4',
        textColor: '#1c1917',
        cardBgColor: '#ffffff',
        cardBorderColor: '#e5e7eb',
        cardShadow: '0 2px 8px rgba(0,0,0,0.06)',
        quoteColor: '#1c1917',
        authorColor: '#57534e',
        starColor: '#e11d48'
      }
    },
    {
      type: 'finalCta',
      data: {
        title: '¿Listo para tu momento de calma?',
        subtitle: 'Reserva tu sesión hoy y descubre una nueva forma de bienestar.',
        ctaText: 'Reservar sesión',
        ctaLink: '/contacto'
      },
      styles: {
        bgColor: '#065f46',
        textColor: '#ffffff',
        ctaBgColor: '#e11d48',
        ctaTextColor: '#ffffff'
      }
    }
  ]
};

/** All service templates indexed by id */
export const SERVICE_TEMPLATES = [DENTAL, LEGAL, SPA];

/**
 * Apply a service template to an existing landing page config.
 * Merges globalStyles and replaces sections with the template's content.
 * @param {Object} currentConfig - Current landingPageConfig
 * @param {string} templateId - One of 'dental-clinic', 'legal-firm', 'spa-wellness'
 * @returns {Object} New landingPageConfig with template applied
 */
export function applyServiceTemplate(currentConfig, templateId) {
  const template = SERVICE_TEMPLATES.find(t => t.id === templateId);
  if (!template) return currentConfig;

  // Deep clone the current config
  const next = JSON.parse(JSON.stringify(currentConfig || {}));

  // Apply global styles
  next.globalStyles = { ...template.globalStyles };

  // Apply page-level settings
  next.pageTitle = template.pageTitle;
  next.route = template.route;

  // Replace sections completely with the template's sections
  next.sections = template.sections.map(section => JSON.parse(JSON.stringify(section)));

  return next;
}
