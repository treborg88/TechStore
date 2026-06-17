// colorPalettes.js — Curated color presets for the site customizer.
// Each palette maps to the existing theme color settings keys.

export const COLOR_PALETTES = [
  {
    id: 'indigo',
    name: 'Índigo',
    colors: {
      primaryColor: '#2563eb',
      secondaryColor: '#7c3aed',
      accentColor: '#f59e0b',
      backgroundColor: '#f8fafc',
      textColor: '#1e293b',
      headerBgColor: '#2563eb',
      headerTextColor: '#ffffff',
      headerButtonColor: '#ffffff',
      headerButtonTextColor: '#2563eb'
    }
  },
  {
    id: 'emerald',
    name: 'Esmeralda',
    colors: {
      primaryColor: '#059669',
      secondaryColor: '#0d9488',
      accentColor: '#f59e0b',
      backgroundColor: '#f0fdf4',
      textColor: '#1e293b',
      headerBgColor: '#059669',
      headerTextColor: '#ffffff',
      headerButtonColor: '#ffffff',
      headerButtonTextColor: '#059669'
    }
  },
  {
    id: 'amber',
    name: 'Ámbar',
    colors: {
      primaryColor: '#b45309',
      secondaryColor: '#d97706',
      accentColor: '#2563eb',
      backgroundColor: '#fffbeb',
      textColor: '#1c1917',
      headerBgColor: '#b45309',
      headerTextColor: '#ffffff',
      headerButtonColor: '#ffffff',
      headerButtonTextColor: '#b45309'
    }
  },
  {
    id: 'rose',
    name: 'Rosa',
    colors: {
      primaryColor: '#be185d',
      secondaryColor: '#db2777',
      accentColor: '#7c3aed',
      backgroundColor: '#fdf2f8',
      textColor: '#1e293b',
      headerBgColor: '#be185d',
      headerTextColor: '#ffffff',
      headerButtonColor: '#ffffff',
      headerButtonTextColor: '#be185d'
    }
  },
  {
    id: 'slate',
    name: 'Pizarra',
    colors: {
      primaryColor: '#475569',
      secondaryColor: '#334155',
      accentColor: '#0ea5e9',
      backgroundColor: '#f1f5f9',
      textColor: '#0f172a',
      headerBgColor: '#475569',
      headerTextColor: '#ffffff',
      headerButtonColor: '#ffffff',
      headerButtonTextColor: '#475569'
    }
  },
  {
    id: 'violet',
    name: 'Violeta',
    colors: {
      primaryColor: '#7c3aed',
      secondaryColor: '#6d28d9',
      accentColor: '#ec4899',
      backgroundColor: '#faf5ff',
      textColor: '#1e293b',
      headerBgColor: '#7c3aed',
      headerTextColor: '#ffffff',
      headerButtonColor: '#ffffff',
      headerButtonTextColor: '#7c3aed'
    }
  },
  {
    id: 'coral',
    name: 'Coral',
    colors: {
      primaryColor: '#dc2626',
      secondaryColor: '#ea580c',
      accentColor: '#2563eb',
      backgroundColor: '#fff7ed',
      textColor: '#1c1917',
      headerBgColor: '#dc2626',
      headerTextColor: '#ffffff',
      headerButtonColor: '#ffffff',
      headerButtonTextColor: '#dc2626'
    }
  },
  {
    id: 'carbon',
    name: 'Carbón',
    colors: {
      primaryColor: '#374151',
      secondaryColor: '#4b5563',
      accentColor: '#0ea5e9',
      backgroundColor: '#f9fafb',
      textColor: '#111827',
      headerBgColor: '#1f2937',
      headerTextColor: '#f9fafb',
      headerButtonColor: '#f9fafb',
      headerButtonTextColor: '#1f2937'
    }
  }
];

/**
 * Map a General-settings color palette to landing-page globalStyles.
 * Takes a palette's colors (primaryColor, backgroundColor, etc.) and derives
 * landingPageConfig.globalStyles fields (darkColor, lightColor, accentColor, textColor).
 */
export function paletteToLandingStyles(colors) {
  return {
    darkColor: colors.secondaryColor || colors.primaryColor || '#111827',
    lightColor: colors.backgroundColor || '#ffffff',
    accentColor: colors.accentColor || colors.primaryColor || '#2563eb',
    textColor: colors.textColor || '#1e293b',
    headingColor: colors.textColor || '#0f172a',
  };
}

// Font options for the font picker panel
export const FONT_OPTIONS = [
  {
    id: 'system',
    label: 'Sans moderno',
    stack: 'system-ui, sans-serif',
    sample: 'Aa — La mejor tecnología'
  },
  {
    id: 'serif',
    label: 'Clásico serif',
    stack: 'Georgia, serif',
    sample: 'Aa — La mejor tecnología'
  },
  {
    id: 'rounded',
    label: 'Amigable',
    stack: '"Trebuchet MS", sans-serif',
    sample: 'Aa — La mejor tecnología'
  },
  {
    id: 'mono',
    label: 'Técnico',
    stack: '"Courier New", monospace',
    sample: 'Aa — La mejor tecnología'
  }
];
