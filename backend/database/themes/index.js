// database/themes/index.js — Demo theme packs applied during tenant provisioning.
// Each theme overrides app_settings colors so the store has a polished look on day one.
// The store owner can change any of these from the admin panel at any time.

// Five theme packs. Colors align with the palette presets in frontend/src/utils/colorPalettes.js
// so users can fine-tune further using the same picker.
const THEMES = {
    'tech-blue': {
        name: 'Tech Azul',
        settings: {
            primaryColor:         '#2563eb',
            secondaryColor:       '#7c3aed',
            accentColor:          '#f59e0b',
            backgroundColor:      '#f8fafc',
            textColor:            '#1e293b',
            headerBgColor:        '#2563eb',
            headerTextColor:      '#ffffff',
            headerButtonColor:    '#ffffff',
            headerButtonTextColor:'#2563eb',
            chatbotColor:         '#2563eb',
        },
    },
    'emerald': {
        name: 'Esmeralda',
        settings: {
            primaryColor:         '#059669',
            secondaryColor:       '#0d9488',
            accentColor:          '#f59e0b',
            backgroundColor:      '#f0fdf4',
            textColor:            '#1e293b',
            headerBgColor:        '#059669',
            headerTextColor:      '#ffffff',
            headerButtonColor:    '#ffffff',
            headerButtonTextColor:'#059669',
            chatbotColor:         '#059669',
        },
    },
    'rose': {
        name: 'Rosa',
        settings: {
            primaryColor:         '#be185d',
            secondaryColor:       '#db2777',
            accentColor:          '#7c3aed',
            backgroundColor:      '#fdf2f8',
            textColor:            '#1e293b',
            headerBgColor:        '#be185d',
            headerTextColor:      '#ffffff',
            headerButtonColor:    '#ffffff',
            headerButtonTextColor:'#be185d',
            chatbotColor:         '#be185d',
        },
    },
    'amber': {
        name: 'Ámbar',
        settings: {
            primaryColor:         '#b45309',
            secondaryColor:       '#d97706',
            accentColor:          '#2563eb',
            backgroundColor:      '#fffbeb',
            textColor:            '#1c1917',
            headerBgColor:        '#b45309',
            headerTextColor:      '#ffffff',
            headerButtonColor:    '#ffffff',
            headerButtonTextColor:'#b45309',
            chatbotColor:         '#b45309',
        },
    },
    'carbon': {
        name: 'Carbón',
        settings: {
            primaryColor:         '#374151',
            secondaryColor:       '#4b5563',
            accentColor:          '#0ea5e9',
            backgroundColor:      '#f9fafb',
            textColor:            '#111827',
            headerBgColor:        '#1f2937',
            headerTextColor:      '#f9fafb',
            headerButtonColor:    '#f9fafb',
            headerButtonTextColor:'#1f2937',
            chatbotColor:         '#374151',
        },
    },
};

const DEFAULT_THEME = 'tech-blue';

/**
 * Apply a color theme to the tenant's app_settings.
 * Safe to call inside an open transaction — uses UPSERT.
 *
 * @param {import('pg').PoolClient} client  - Active DB client with search_path set to tenant schema
 * @param {string} themeId                  - One of the keys in THEMES; falls back to 'tech-blue'
 */
async function applyTheme(client, themeId) {
    const theme = THEMES[themeId] || THEMES[DEFAULT_THEME];
    for (const [key, value] of Object.entries(theme.settings)) {
        await client.query(
            `INSERT INTO app_settings (id, value) VALUES ($1, $2)
             ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value`,
            [key, value]
        );
    }
}

module.exports = { THEMES, DEFAULT_THEME, applyTheme };
