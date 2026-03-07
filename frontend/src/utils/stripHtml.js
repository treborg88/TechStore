// stripHtml.js - Remove HTML tags, returning plain text only
// Used for product card previews and admin table descriptions
export const stripHtml = (html = '') => {
  if (!html) return '';
  // Use DOMParser to safely extract text content (no XSS risk)
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};
