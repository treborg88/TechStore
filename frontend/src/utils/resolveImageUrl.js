// resolveImageUrl.js — Centraliza la resolución de URLs de imágenes
// Las imágenes se sirven desde /storage/* (proxy del sistema de archivos local).
// En producción, Nginx + Cloudflare cachean las respuestas.

// Imagen por defecto cuando no hay imagen disponible
const DEFAULT_IMAGE = '/images/placeholder.svg';

/**
 * Resuelve una URL de imagen a su forma óptima:
 * - /images/* o /storage/* paths → se dejan como están
 * - URLs externas (http/https) → se pasan directo
 * - Bare filenames (legacy: "foto.jpg" sin ruta) → fallback
 * - null/undefined → fallback
 * 
 * @param {string|null|undefined} url - URL de imagen (full, relative o bare)
 * @param {string} [fallback=DEFAULT_IMAGE] - Imagen por defecto si url es falsy
 * @returns {string} URL resuelta lista para usar en <img src>
 */
export function resolveImageUrl(url, fallback = DEFAULT_IMAGE) {
  if (!url) return fallback;

  // URL externa → pasar directo
  if (url.startsWith('http')) return url;

  // Path relativo /images/* o /storage/* → dejar como está
  if (url.startsWith('/images/') || url.startsWith('/storage/')) return url;

  // Bare filename (legacy: "foto.jpg" sin ruta) → no se puede resolver
  return fallback;
}
