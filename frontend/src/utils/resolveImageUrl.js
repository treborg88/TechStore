// resolveImageUrl.js — Centraliza la resolución de URLs de imágenes
// En producción, redirige Supabase Storage a través del proxy Nginx /storage/
// para que Cloudflare cachee las imágenes y reduzca el egress de Supabase.
// En desarrollo (localhost), usa la URL de Supabase directamente (no hay Nginx).

// Detectar entorno: dev/LAN (sin Nginx) vs prod (con Nginx proxy)
// Incluye localhost, 127.0.0.1 e IPs privadas (192.168.*, 10.*, 172.16-31.*)
const isDev = typeof window !== 'undefined' && (/^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(window.location.hostname));

// Marcador que identifica una URL pública de Supabase Storage
const SUPABASE_STORAGE_MARKER = '/storage/v1/object/public/';

// Imagen por defecto cuando no hay imagen disponible
const DEFAULT_IMAGE = '/images/sin imagen.jpeg';

/**
 * Resuelve una URL de imagen a su forma óptima:
 * - Producción: Supabase Storage URL → /storage/<path> (proxy Nginx → Cloudflare cache)
 * - Desarrollo: Supabase Storage URL → se deja intacta (acceso directo, no hay Nginx)
 * - /images/* paths → se dejan como están
 * - Bare filenames → fallback (legacy, no se pueden servir)
 * - null/undefined → fallback
 * 
 * @param {string|null|undefined} url - URL de imagen (full, relative o bare)
 * @param {string} [fallback=DEFAULT_IMAGE] - Imagen por defecto si url es falsy
 * @returns {string} URL resuelta lista para usar en <img src>
 */
export function resolveImageUrl(url, fallback = DEFAULT_IMAGE) {
  if (!url) return fallback;

  // Supabase Storage → proxy en prod, directo en dev
  const storageIndex = url.indexOf(SUPABASE_STORAGE_MARKER);
  if (storageIndex !== -1) {
    // En dev/LAN no hay Nginx, usar la URL completa de Supabase directamente
    if (isDev) return url;
    // En producción, usar proxy /storage/ para cache de Cloudflare
    return '/storage/' + url.slice(storageIndex + SUPABASE_STORAGE_MARKER.length);
  }

  // URL externa (no Supabase) → pasar directo
  if (url.startsWith('http')) return url;

  // Path relativo /images/* o /storage/* → dejar como está
  if (url.startsWith('/images/') || url.startsWith('/storage/')) return url;

  // Bare filename (legacy: "foto.jpg" sin ruta) → no se puede resolver
  return fallback;
}
