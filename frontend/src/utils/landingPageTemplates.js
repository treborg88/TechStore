// landingPageTemplates.js - Presets visuales para la landing page
import { cloneLandingPageConfig } from './landingPageDefaults';

// Lista de opciones visibles en el selector del panel admin
export const LANDING_TEMPLATE_OPTIONS = [
  { id: 'modern-minimal', name: 'Modern Minimal' },
  { id: 'story-brand', name: 'Story Brand' },
  { id: 'neon-tech', name: 'Neon Tech' },
  { id: 'warm-commerce', name: 'Warm Commerce' },
  { id: 'clean-editorial', name: 'Clean Editorial' }
];

// Presets de estilos (solo estilos, no contenido)
const LANDING_TEMPLATE_PRESETS = {
  'modern-minimal': {
    globalStyles: {
      accentColor: '#2563eb',
      darkColor: '#111827',
      lightColor: '#ffffff',
      textColor: '#111827',
      textLightColor: '#4b5563',
      headingColor: '#0f172a'
    },
    sectionData: {
      hero: { layout: 'text-left' },
      productHighlight: { layout: 'image-right' }
    },
    sectionStyles: {
      hero: {
        bgColor: 'var(--background-color)',
        bgGradient: 'linear-gradient(180deg, color-mix(in srgb, var(--background-color) 96%, var(--accent-color) 4%) 0%, var(--background-color) 100%)',
        textColor: 'var(--text-color)',
        ctaBgColor: 'var(--text-color)',
        ctaTextColor: 'var(--background-color)',
        minHeight: 560
      },
      valueProposition: {
        bgColor: 'var(--background-color)',
        textColor: 'var(--text-color)',
        iconBgColor: 'color-mix(in srgb, var(--accent-color) 14%, var(--background-color) 86%)',
        cardBgColor: 'var(--background-color)',
        cardBorderColor: 'color-mix(in srgb, var(--text-color) 10%, transparent)',
        cardShadow: '0 12px 28px rgba(0,0,0,0.06)'
      },
      productHighlight: {
        bgColor: 'color-mix(in srgb, var(--background-color) 94%, var(--accent-color) 6%)',
        textColor: 'var(--text-color)',
        ctaBgColor: 'var(--text-color)',
        ctaTextColor: 'var(--background-color)'
      },
      trustBanner: {
        bgColor: 'var(--text-color)',
        textColor: 'var(--background-color)'
      },
      featuredProduct: {
        bgColor: 'var(--background-color)',
        textColor: 'var(--text-color)',
        priceSaleColor: 'var(--accent-color)',
        priceOriginalColor: 'color-mix(in srgb, var(--text-color) 55%, transparent)',
        ctaBgColor: 'var(--text-color)',
        ctaTextColor: 'var(--background-color)',
        specsDotColor: 'color-mix(in srgb, var(--text-color) 18%, transparent)'
      },
      howItWorks: {
        bgColor: 'color-mix(in srgb, var(--background-color) 96%, var(--accent-color) 4%)',
        textColor: 'var(--text-color)',
        stepNumberBg: 'var(--accent-color)',
        stepNumberColor: 'var(--text-color)',
        stepCardBg: 'var(--background-color)',
        stepCardBorder: 'color-mix(in srgb, var(--text-color) 12%, transparent)'
      },
      productShowcase: {
        bgColor: 'var(--background-color)',
        textColor: 'var(--text-color)',
        cardBgColor: 'var(--background-color)',
        cardBorderColor: 'color-mix(in srgb, var(--text-color) 12%, transparent)',
        cardShadow: '0 14px 30px rgba(0,0,0,0.07)',
        ctaBgColor: 'var(--text-color)',
        ctaTextColor: 'var(--background-color)'
      },
      testimonials: {
        bgColor: 'color-mix(in srgb, var(--background-color) 95%, var(--accent-color) 5%)',
        textColor: 'var(--text-color)',
        cardBgColor: 'var(--background-color)',
        cardBorderColor: 'color-mix(in srgb, var(--text-color) 12%, transparent)',
        cardShadow: '0 12px 30px rgba(0,0,0,0.06)',
        quoteColor: 'color-mix(in srgb, var(--text-color) 88%, transparent)',
        authorColor: 'var(--text-color)',
        starColor: 'var(--accent-color)'
      },
      finalCta: {
        bgColor: 'var(--text-color)',
        textColor: 'var(--background-color)',
        ctaBgColor: 'var(--accent-color)',
        ctaTextColor: 'var(--text-color)'
      }
    }
  },
  'story-brand': {
    globalStyles: {
      accentColor: '#f59e0b',
      darkColor: '#1f2937',
      lightColor: '#fefbf6',
      textColor: '#312e2b',
      textLightColor: '#57534e',
      headingColor: '#1c1917'
    },
    sectionStyles: {
      hero: {
        bgGradient: 'linear-gradient(135deg, #7c2d12 0%, #c2410c 55%, #f59e0b 100%)',
        bgColor: '#7c2d12',
        textColor: '#fff7ed',
        ctaBgColor: '#fbbf24',
        ctaTextColor: '#3b1d05',
        minHeight: 580
      },
      valueProposition: {
        bgColor: '#fff7ed',
        textColor: '#312e2b',
        iconBgColor: '#ffedd5',
        cardBgColor: '#ffffff',
        cardBorderColor: '#fed7aa',
        cardShadow: '0 16px 30px rgba(124,45,18,0.08)'
      },
      productHighlight: {
        bgColor: '#fffbeb',
        textColor: '#312e2b',
        ctaBgColor: '#c2410c',
        ctaTextColor: '#fff7ed'
      },
      trustBanner: {
        bgColor: '#9a3412',
        textColor: '#fffbeb'
      },
      featuredProduct: {
        bgColor: '#fff7ed',
        textColor: '#312e2b',
        priceSaleColor: '#c2410c',
        priceOriginalColor: '#78716c',
        ctaBgColor: '#b45309',
        ctaTextColor: '#fff7ed',
        specsDotColor: '#fdba74'
      },
      howItWorks: {
        bgColor: '#ffedd5',
        textColor: '#312e2b',
        stepNumberBg: '#c2410c',
        stepNumberColor: '#fff7ed',
        stepCardBg: '#fff7ed',
        stepCardBorder: '#fdba74'
      },
      productShowcase: {
        bgColor: '#fff7ed',
        textColor: '#312e2b',
        cardBgColor: '#ffffff',
        cardBorderColor: '#fed7aa',
        cardShadow: '0 18px 35px rgba(124,45,18,0.1)',
        ctaBgColor: '#c2410c',
        ctaTextColor: '#fff7ed'
      },
      testimonials: {
        bgColor: '#fffbeb',
        textColor: '#312e2b',
        cardBgColor: '#ffffff',
        cardBorderColor: '#fed7aa',
        cardShadow: '0 14px 32px rgba(124,45,18,0.08)',
        quoteColor: '#44403c',
        authorColor: '#292524',
        starColor: '#f59e0b'
      },
      leadCapture: {
        bgColor: '#9a3412',
        textColor: '#fffbeb',
        inputBgColor: '#fff7ed',
        inputBorderColor: '#fdba74',
        submitBgColor: '#f59e0b',
        submitTextColor: '#3b1d05'
      },
      finalCta: {
        bgColor: '#7c2d12',
        textColor: '#fffbeb',
        ctaBgColor: '#fbbf24',
        ctaTextColor: '#3b1d05'
      }
    }
  },
  'neon-tech': {
    globalStyles: {
      accentColor: '#22d3ee',
      darkColor: '#0b1020',
      lightColor: '#0f172a',
      textColor: '#e2e8f0',
      textLightColor: '#93c5fd',
      headingColor: '#67e8f9'
    },
    sectionStyles: {
      hero: {
        bgGradient: 'radial-gradient(circle at 20% 20%, rgba(34,211,238,0.5) 0%, transparent 45%), linear-gradient(145deg, #0b1020 0%, #1e1b4b 55%, #0f172a 100%)',
        bgColor: '#0b1020',
        textColor: '#e2e8f0',
        ctaBgColor: '#22d3ee',
        ctaTextColor: '#0b1020',
        minHeight: 600
      },
      valueProposition: {
        bgColor: '#0f172a',
        textColor: '#e2e8f0',
        iconBgColor: 'rgba(34,211,238,0.16)',
        cardBgColor: '#111827',
        cardBorderColor: '#1d4ed8',
        cardShadow: '0 0 0 1px rgba(34,211,238,0.2), 0 18px 34px rgba(2,6,23,0.6)'
      },
      productHighlight: {
        bgColor: '#111827',
        textColor: '#e2e8f0',
        ctaBgColor: '#22d3ee',
        ctaTextColor: '#0b1020'
      },
      trustBanner: {
        bgColor: '#111827',
        textColor: '#67e8f9'
      },
      featuredProduct: {
        bgColor: '#0f172a',
        textColor: '#e2e8f0',
        priceSaleColor: '#22d3ee',
        priceOriginalColor: '#94a3b8',
        ctaBgColor: '#0ea5e9',
        ctaTextColor: '#e0f2fe',
        specsDotColor: '#1d4ed8'
      },
      howItWorks: {
        bgColor: '#111827',
        textColor: '#e2e8f0',
        stepNumberBg: '#22d3ee',
        stepNumberColor: '#0b1020',
        stepCardBg: '#0f172a',
        stepCardBorder: '#1d4ed8'
      },
      productShowcase: {
        bgColor: '#0f172a',
        textColor: '#e2e8f0',
        cardBgColor: '#111827',
        cardBorderColor: '#1d4ed8',
        cardShadow: '0 18px 38px rgba(2,6,23,0.62)',
        ctaBgColor: '#22d3ee',
        ctaTextColor: '#0b1020'
      },
      testimonials: {
        bgColor: '#111827',
        textColor: '#e2e8f0',
        cardBgColor: '#0f172a',
        cardBorderColor: '#1d4ed8',
        cardShadow: '0 16px 32px rgba(2,6,23,0.55)',
        quoteColor: '#cbd5e1',
        authorColor: '#67e8f9',
        starColor: '#22d3ee'
      },
      leadCapture: {
        bgColor: '#0b1020',
        textColor: '#e2e8f0',
        inputBgColor: '#111827',
        inputBorderColor: '#1d4ed8',
        submitBgColor: '#22d3ee',
        submitTextColor: '#0b1020'
      },
      finalCta: {
        bgColor: '#020617',
        textColor: '#67e8f9',
        ctaBgColor: '#22d3ee',
        ctaTextColor: '#0b1020'
      }
    }
  },
  'warm-commerce': {
    globalStyles: {
      accentColor: '#ef4444',
      darkColor: '#7f1d1d',
      lightColor: '#fffaf5',
      textColor: '#3f1d1d',
      textLightColor: '#7a3f3f',
      headingColor: '#6b1f1f'
    },
    sectionStyles: {
      hero: {
        bgGradient: 'linear-gradient(135deg, #fff1e8 0%, #fecdd3 55%, #fde68a 100%)',
        bgColor: '#fff7ed',
        textColor: '#6b1f1f',
        ctaBgColor: '#b91c1c',
        ctaTextColor: '#fff7ed',
        minHeight: 560
      },
      valueProposition: {
        bgColor: '#fffaf5',
        textColor: '#3f1d1d',
        iconBgColor: '#fee2e2',
        cardBgColor: '#ffffff',
        cardBorderColor: '#fecaca',
        cardShadow: '0 14px 30px rgba(185,28,28,0.08)'
      },
      productHighlight: {
        bgColor: '#fff1f2',
        textColor: '#6b1f1f',
        ctaBgColor: '#dc2626',
        ctaTextColor: '#fff7ed'
      },
      trustBanner: {
        bgColor: '#b91c1c',
        textColor: '#fff7ed'
      },
      featuredProduct: {
        bgColor: '#fffaf5',
        textColor: '#3f1d1d',
        priceSaleColor: '#dc2626',
        priceOriginalColor: '#9f6b6b',
        ctaBgColor: '#b91c1c',
        ctaTextColor: '#fff7ed',
        specsDotColor: '#fca5a5'
      },
      howItWorks: {
        bgColor: '#fff1f2',
        textColor: '#3f1d1d',
        stepNumberBg: '#dc2626',
        stepNumberColor: '#fff7ed',
        stepCardBg: '#ffffff',
        stepCardBorder: '#fecaca'
      },
      productShowcase: {
        bgColor: '#fffaf5',
        textColor: '#3f1d1d',
        cardBgColor: '#ffffff',
        cardBorderColor: '#fecaca',
        cardShadow: '0 16px 30px rgba(185,28,28,0.08)',
        ctaBgColor: '#dc2626',
        ctaTextColor: '#fff7ed'
      },
      testimonials: {
        bgColor: '#fff1f2',
        textColor: '#3f1d1d',
        cardBgColor: '#ffffff',
        cardBorderColor: '#fecaca',
        cardShadow: '0 14px 28px rgba(185,28,28,0.08)',
        quoteColor: '#6b1f1f',
        authorColor: '#7f1d1d',
        starColor: '#ef4444'
      },
      leadCapture: {
        bgColor: '#7f1d1d',
        textColor: '#fff7ed',
        inputBgColor: '#ffffff',
        inputBorderColor: '#fecaca',
        submitBgColor: '#ef4444',
        submitTextColor: '#fff7ed'
      },
      finalCta: {
        bgColor: '#991b1b',
        textColor: '#fff7ed',
        ctaBgColor: '#ef4444',
        ctaTextColor: '#fff7ed'
      }
    }
  },
  'clean-editorial': {
    globalStyles: {
      accentColor: '#0f766e',
      darkColor: '#334155',
      lightColor: '#f8fafc',
      textColor: '#334155',
      textLightColor: '#64748b',
      headingColor: '#1e293b'
    },
    sectionStyles: {
      hero: {
        bgColor: '#f8fafc',
        bgGradient: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
        textColor: '#334155',
        ctaBgColor: '#0f766e',
        ctaTextColor: '#f0fdfa',
        minHeight: 540
      },
      valueProposition: {
        bgColor: '#f8fafc',
        textColor: '#334155',
        iconBgColor: '#e2e8f0',
        cardBgColor: '#ffffff',
        cardBorderColor: '#cbd5e1',
        cardShadow: '0 1px 0 rgba(148,163,184,0.35)'
      },
      productHighlight: {
        bgColor: '#f1f5f9',
        textColor: '#334155',
        ctaBgColor: '#0f766e',
        ctaTextColor: '#f0fdfa'
      },
      trustBanner: {
        bgColor: '#334155',
        textColor: '#e2e8f0'
      },
      featuredProduct: {
        bgColor: '#f8fafc',
        textColor: '#334155',
        priceSaleColor: '#0f766e',
        priceOriginalColor: '#94a3b8',
        ctaBgColor: '#0f766e',
        ctaTextColor: '#f0fdfa',
        specsDotColor: '#cbd5e1'
      },
      howItWorks: {
        bgColor: '#f1f5f9',
        textColor: '#334155',
        stepNumberBg: '#0f766e',
        stepNumberColor: '#f0fdfa',
        stepCardBg: '#ffffff',
        stepCardBorder: '#cbd5e1'
      },
      productShowcase: {
        bgColor: '#f8fafc',
        textColor: '#334155',
        cardBgColor: '#ffffff',
        cardBorderColor: '#cbd5e1',
        cardShadow: '0 6px 18px rgba(51,65,85,0.08)',
        ctaBgColor: '#0f766e',
        ctaTextColor: '#f0fdfa'
      },
      testimonials: {
        bgColor: '#f1f5f9',
        textColor: '#334155',
        cardBgColor: '#ffffff',
        cardBorderColor: '#cbd5e1',
        cardShadow: 'none',
        quoteColor: '#475569',
        authorColor: '#1e293b',
        starColor: '#0f766e'
      },
      leadCapture: {
        bgColor: '#334155',
        textColor: '#e2e8f0',
        inputBgColor: '#ffffff',
        inputBorderColor: '#cbd5e1',
        submitBgColor: '#0f766e',
        submitTextColor: '#f0fdfa'
      },
      finalCta: {
        bgColor: '#1e293b',
        textColor: '#e2e8f0',
        ctaBgColor: '#0f766e',
        ctaTextColor: '#f0fdfa'
      }
    }
  }
};

// Aplica un preset al config actual sin tocar contenido
export const applyLandingTemplatePreset = (config, templateId) => {
  const current = cloneLandingPageConfig(config);
  const defaults = cloneLandingPageConfig(null);
  const preset = LANDING_TEMPLATE_PRESETS[templateId];

  // Si no existe preset, solo persistir el id
  if (!preset) {
    current.templateId = templateId || '';
    return current;
  }

  // Se conservan sólo propiedades de layout global para evitar arrastrar paletas previas
  const preservedGlobalLayout = {
    fontFamily: current.globalStyles?.fontFamily,
    maxWidth: current.globalStyles?.maxWidth,
    sectionPadding: current.globalStyles?.sectionPadding,
    sectionPaddingMobile: current.globalStyles?.sectionPaddingMobile
  };

  const next = {
    ...current,
    templateId,
    globalStyles: {
      ...defaults.globalStyles,
      ...preservedGlobalLayout,
      ...(preset.globalStyles || {})
    }
  };

  // Estilos de secciones: reset a default + preset (sin arrastrar estilos viejos)
  next.sections = (current.sections || []).map((section) => {
    const defaultSection = defaults.sections.find((s) => s.id === section.id || s.type === section.type);
    const sectionDataPatch = preset.sectionData?.[section.id] || preset.sectionData?.[section.type];
    const sectionStylePatch = preset.sectionStyles?.[section.id] || preset.sectionStyles?.[section.type];

    return {
      ...(defaultSection || section),
      ...section,
      data: {
        ...((defaultSection && defaultSection.data) || {}),
        ...(section.data || {}),
        ...(sectionDataPatch || {})
      },
      styles: {
        ...((defaultSection && defaultSection.styles) || {}),
        ...(sectionStylePatch || {})
      }
    };
  });

  // Fallback por si faltara alguna sección en la configuración activa
  if ((next.sections || []).length === 0) {
    next.sections = defaults.sections.map((section) => {
      const sectionDataPatch = preset.sectionData?.[section.id] || preset.sectionData?.[section.type];
      const sectionStylePatch = preset.sectionStyles?.[section.id] || preset.sectionStyles?.[section.type];
      return {
        ...section,
        data: {
          ...(section.data || {}),
          ...(sectionDataPatch || {})
        },
        styles: {
          ...(section.styles || {}),
          ...(sectionStylePatch || {})
        }
      };
    });
  }

  next.globalStyles = {
    ...next.globalStyles,
    ...(preset.globalStyles || {})
  };

  return next;
};
