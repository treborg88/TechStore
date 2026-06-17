// LandingPageAdmin.jsx — Panel de administración para la landing page
// Diseño: barra de navegación horizontal con iconos + sidebar + preview en vivo
// Sigue el mismo patrón visual que SiteCustomizer.jsx (sección "General")

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { DEFAULT_LANDING_PAGE_CONFIG, cloneLandingPageConfig } from '../../utils/landingPageDefaults';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { LANDING_TEMPLATE_OPTIONS, applyLandingTemplatePreset } from '../../utils/landingPageTemplates';
import { SERVICE_TEMPLATES, applyServiceTemplate } from '../../utils/landingServiceTemplates';
import { COLOR_PALETTES, paletteToLandingStyles } from '../../utils/colorPalettes';
import toast from 'react-hot-toast';
import './LandingPageAdmin.css';

/* ═══════════════ CONSTANTES ═══════════════ */

const SECTION_LABELS = {
  hero: 'Hero',
  valueProposition: 'Propuesta de Valor',
  productHighlight: 'Producto Destacado',
  trustBanner: 'Banner de Confianza',
  featuredProduct: 'Producto Estrella',
  howItWorks: 'Cómo Funciona',
  productShowcase: 'Vitrina de Productos',
  testimonials: 'Testimonios',
  leadCapture: 'Captura de Leads',
  finalCta: 'CTA Final',
};

const SECTION_ICONS = {
  hero: '🎯',
  valueProposition: '💎',
  productHighlight: '📸',
  trustBanner: '🏆',
  featuredProduct: '⭐',
  howItWorks: '📋',
  productShowcase: '🛍️',
  testimonials: '💬',
  leadCapture: '📧',
  finalCta: '🚀',
};

/** Paneles principales del editor */
const PANELS = [
  { id: 'config', icon: '⚙️', label: 'Config' },
  { id: 'templates', icon: '📐', label: 'Plantillas' },
  { id: 'globalStyles', icon: '🎨', label: 'Estilos' },
  { id: 'sections', icon: '📋', label: 'Secciones' },
];

/* ═══════════════ HELPERS ═══════════════ */

const updateNestedField = (config, sectionId, path, value) => {
  const next = cloneLandingPageConfig(config);
  const sectionIdx = next.sections.findIndex(s => s.id === sectionId);
  if (sectionIdx < 0) return next;
  const parts = path.split('.');
  let target = next.sections[sectionIdx];
  for (let i = 0; i < parts.length - 1; i++) {
    target = target[parts[i]];
  }
  target[parts[parts.length - 1]] = value;
  return next;
};

const mapCatalogProductToLanding = (product) => {
  const salePrice = Number(product?.price) || 0;
  const originalPrice = Number(product?.originalPrice ?? product?.compareAtPrice ?? product?.price) || salePrice;
  return {
    productId: product?.id ?? null,
    name: product?.name || '',
    productName: product?.name || '',
    description: product?.description || '',
    category: product?.category || '',
    image: product?.image || '',
    originalPrice,
    salePrice,
    ctaText: 'Ver Producto',
    ctaLink: product?.id ? `/product/${product.id}` : '/products',
    features: Array.isArray(product?.features) ? product.features.slice(0, 3) : []
  };
};

/* ═══════════════ SUB-COMPONENTES ═══════════════ */

const ColorInput = ({ label, value, onChange }) => {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  const isHexColor = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(normalizedValue);
  return (
    <div className="lp-color-row">
      <label className="lp-color-swatch-label">
        <input type="color" value={isHexColor ? normalizedValue : '#000000'}
          onChange={(e) => onChange(e.target.value)} className="lp-color-picker" />
        <span className="lp-color-swatch" style={{ background: isHexColor ? normalizedValue : '#000000' }} />
      </label>
      <span className="lp-color-name">{label}</span>
      <span className="lp-color-hex">{normalizedValue}</span>
    </div>
  );
};

const TextInput = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div className="lp-form-group">
    <label className="lp-field-label">{label}</label>
    <input type={type} value={value ?? ''}
      onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      placeholder={placeholder} className="lp-text-input" />
  </div>
);

const TextArea = ({ label, value, onChange, rows = 3 }) => (
  <div className="lp-form-group">
    <label className="lp-field-label">{label}</label>
    <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)}
      rows={rows} className="lp-textarea" />
  </div>
);

const ImageInput = ({ label, value, onChange, onUpload, isUploading = false }) => (
  <div className="lp-form-group">
    <label className="lp-field-label">{label}</label>
    <input type="text" value={value ?? ''} onChange={(e) => onChange(e.target.value)}
      placeholder="https://..." className="lp-text-input" />
    <div className="lp-upload-row">
      <input type="file" accept="image/*" className="lp-file-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f && onUpload) onUpload(f); e.target.value = ''; }}
        disabled={isUploading} />
      {isUploading && <small style={{ opacity: 0.8 }}>Subiendo...</small>}
    </div>
    {value && (
      <img src={value} alt="preview" className="lp-img-preview" />
    )}
  </div>
);

/* ═══════════════ EDITORES POR SECCIÓN ═══════════════ */

const StylesEditor = ({ styles, onStyleChange }) => {
  if (!styles) return null;
  return (
    <div className="lp-section-styles">
      <p className="lp-subsection-label">Colores de la sección</p>
      <div className="lp-style-grid">
        {Object.entries(styles).map(([key, val]) => {
          const isColor = typeof val === 'string' && (val.startsWith('#') || val.startsWith('rgb'));
          if (!isColor) return null;
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          return <ColorInput key={key} label={label} value={val} onChange={(v) => onStyleChange(key, v)} />;
        })}
      </div>
      {Object.entries(styles).map(([key, val]) => {
        if (typeof val === 'number') {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          return <TextInput key={key} label={label} value={val} type="number"
            onChange={(v) => onStyleChange(key, v)} />;
        }
        const isColor = typeof val === 'string' && (val.startsWith('#') || val.startsWith('rgb'));
        if (typeof val === 'string' && !isColor && val !== '') {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          return <TextInput key={key} label={label} value={val}
            onChange={(v) => onStyleChange(key, v)} />;
        }
        return null;
      })}
    </div>
  );
};

const HeroEditor = ({ data, onDataChange, onImageUpload, isImageUploading, availableProducts = [], productsLoading = false }) => {
  const handleSelectHeroProduct = (productId) => {
    const selected = availableProducts.find((p) => String(p.id) === String(productId));
    if (!selected) { onDataChange('productId', null); return; }
    const mapped = mapCatalogProductToLanding(selected);
    onDataChange('productId', mapped.productId);
    onDataChange('title', mapped.productName || mapped.name || data.title);
    onDataChange('subtitle', mapped.description || data.subtitle);
    onDataChange('image', mapped.image || data.image);
    onDataChange('ctaLink', mapped.ctaLink || data.ctaLink);
    onDataChange('ctaText', data.ctaText || mapped.ctaText || 'Ver Producto');
  };

  return (
    <div className="lp-editor-section">
      <div className="lp-form-group">
        <label className="lp-field-label">Producto del catálogo (opcional)</label>
        <select value={data.productId ?? ''} onChange={(e) => handleSelectHeroProduct(e.target.value)}
          className="lp-text-input" disabled={productsLoading}>
          <option value="">{productsLoading ? 'Cargando...' : 'Ninguno (manual)'}</option>
          {availableProducts.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
      <TextInput label="Subtítulo" value={data.subtitle} onChange={(v) => onDataChange('subtitle', v)} />
      <TextInput label="Texto CTA" value={data.ctaText} onChange={(v) => onDataChange('ctaText', v)} />
      <TextInput label="Enlace CTA" value={data.ctaLink} onChange={(v) => onDataChange('ctaLink', v)} placeholder="/" />
      <ImageInput label="Imagen" value={data.image} onChange={(v) => onDataChange('image', v)}
        onUpload={(file) => onImageUpload && onImageUpload('image', file)}
        isUploading={isImageUploading ? isImageUploading('image') : false} />
      <TextInput label="Texto del badge" value={data.badgeText} onChange={(v) => onDataChange('badgeText', v)} />
      <div className="lp-form-group">
        <label className="lp-field-label">Layout</label>
        <select value={data.layout || 'text-left'} onChange={(e) => onDataChange('layout', e.target.value)} className="lp-text-input">
          <option value="text-left">Texto izquierda</option>
          <option value="text-right">Texto derecha</option>
        </select>
      </div>
    </div>
  );
};

const ValuePropositionEditor = ({ data, onDataChange, onArrayChange }) => (
  <div className="lp-editor-section">
    <TextInput label="Label superior" value={data.label} onChange={(v) => onDataChange('label', v)} />
    <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
    <TextArea label="Descripción" value={data.description} onChange={(v) => onDataChange('description', v)} />
    <p className="lp-subsection-label">Puntos ({(data.points || []).length})</p>
    {(data.points || []).map((point, i) => (
      <div key={i} className="lp-array-item">
        <div className="lp-array-fields">
          <input type="text" value={point.icon || ''} onChange={(e) => onArrayChange('points', i, 'icon', e.target.value)}
            className="lp-text-input lp-emoji-input" placeholder="🔥" />
          <input type="text" value={point.title || ''} onChange={(e) => onArrayChange('points', i, 'title', e.target.value)}
            className="lp-text-input" placeholder="Título" />
          <input type="text" value={point.description || ''} onChange={(e) => onArrayChange('points', i, 'description', e.target.value)}
            className="lp-text-input" placeholder="Descripción" />
        </div>
        <button type="button" className="lp-array-del"
          onClick={() => { const next = [...(data.points || [])]; next.splice(i, 1); onDataChange('points', next); }}>✕</button>
      </div>
    ))}
    <button type="button" className="lp-add-btn"
      onClick={() => onDataChange('points', [...(data.points || []), { icon: '✨', title: '', description: '' }])}>
      + Agregar punto
    </button>
  </div>
);

const ProductHighlightEditor = ({ data, onDataChange, onImageUpload, isImageUploading, availableProducts = [], productsLoading = false }) => {
  const handleSelect = (productId) => {
    const selected = availableProducts.find((p) => String(p.id) === String(productId));
    if (!selected) { onDataChange('productId', null); return; }
    const mapped = mapCatalogProductToLanding(selected);
    onDataChange('productId', mapped.productId);
    onDataChange('label', mapped.category || data.label);
    onDataChange('title', mapped.productName || mapped.name || data.title);
    onDataChange('description', mapped.description || data.description);
    onDataChange('image', mapped.image || data.image);
    onDataChange('ctaLink', mapped.ctaLink || data.ctaLink);
    onDataChange('ctaText', data.ctaText || mapped.ctaText || 'Ver Producto');
  };

  return (
    <div className="lp-editor-section">
      <div className="lp-form-group">
        <label className="lp-field-label">Producto del catálogo</label>
        <select value={data.productId ?? ''} onChange={(e) => handleSelect(e.target.value)}
          className="lp-text-input" disabled={productsLoading}>
          <option value="">{productsLoading ? 'Cargando...' : 'Ninguno (manual)'}</option>
          {availableProducts.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      </div>
      <TextInput label="Label" value={data.label} onChange={(v) => onDataChange('label', v)} />
      <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
      <TextArea label="Descripción" value={data.description} onChange={(v) => onDataChange('description', v)} />
      <TextInput label="Texto CTA" value={data.ctaText} onChange={(v) => onDataChange('ctaText', v)} />
      <TextInput label="Enlace CTA" value={data.ctaLink} onChange={(v) => onDataChange('ctaLink', v)} />
      <ImageInput label="Imagen" value={data.image} onChange={(v) => onDataChange('image', v)}
        onUpload={(file) => onImageUpload && onImageUpload('image', file)}
        isUploading={isImageUploading ? isImageUploading('image') : false} />
      <div className="lp-form-group">
        <label className="lp-field-label">Layout</label>
        <select value={data.layout || 'image-left'} onChange={(e) => onDataChange('layout', e.target.value)} className="lp-text-input">
          <option value="image-left">Imagen izquierda</option>
          <option value="image-right">Imagen derecha</option>
        </select>
      </div>
    </div>
  );
};

const TrustBannerEditor = ({ data, onDataChange }) => (
  <div className="lp-editor-section">
    <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
    <TextInput label="Subtítulo" value={data.subtitle} onChange={(v) => onDataChange('subtitle', v)} />
  </div>
);

const FeaturedProductEditor = ({ data, onDataChange, onArrayChange, availableProducts = [], productsLoading = false, onImageUpload, isImageUploading }) => {
  const handleSelect = (productId) => {
    const selected = availableProducts.find((p) => String(p.id) === String(productId));
    if (!selected) { onDataChange('productId', null); return; }
    const mapped = mapCatalogProductToLanding(selected);
    Object.entries({
      productId: mapped.productId, productName: mapped.productName,
      description: mapped.description, image: mapped.image,
      originalPrice: mapped.originalPrice, salePrice: mapped.salePrice,
      ctaText: data.ctaText || mapped.ctaText || 'Ver Producto', ctaLink: mapped.ctaLink
    }).forEach(([k, v]) => onDataChange(k, v));
  };

  return (
    <div className="lp-editor-section">
      <TextInput label="Label" value={data.label} onChange={(v) => onDataChange('label', v)} />
      <div className="lp-form-group">
        <label className="lp-field-label">Producto del catálogo</label>
        <select value={data.productId ?? ''} onChange={(e) => handleSelect(e.target.value)}
          className="lp-text-input" disabled={productsLoading}>
          <option value="">{productsLoading ? 'Cargando...' : 'Seleccionar...'}</option>
          {availableProducts.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      </div>
      <TextInput label="Nombre" value={data.productName} onChange={(v) => onDataChange('productName', v)} />
      <TextArea label="Descripción" value={data.description} onChange={(v) => onDataChange('description', v)} />
      <ImageInput label="Imagen" value={data.image} onChange={(v) => onDataChange('image', v)}
        onUpload={(file) => onImageUpload && onImageUpload('image', file)}
        isUploading={isImageUploading ? isImageUploading('image') : false} />
      <TextInput label="Precio original" value={data.originalPrice} type="number" onChange={(v) => onDataChange('originalPrice', v)} />
      <TextInput label="Precio venta" value={data.salePrice} type="number" onChange={(v) => onDataChange('salePrice', v)} />
      <TextInput label="Badge" value={data.badgeText} onChange={(v) => onDataChange('badgeText', v)} />
      <TextInput label="Texto CTA" value={data.ctaText} onChange={(v) => onDataChange('ctaText', v)} />
      <TextInput label="Enlace CTA" value={data.ctaLink} onChange={(v) => onDataChange('ctaLink', v)} />
      <p className="lp-subsection-label">Especificaciones ({(data.specs || []).length})</p>
      {(data.specs || []).map((spec, i) => (
        <div key={i} className="lp-array-item">
          <div className="lp-array-fields lp-array-fields--2col">
            <input type="text" value={spec.key || ''} onChange={(e) => onArrayChange('specs', i, 'key', e.target.value)}
              className="lp-text-input" placeholder="Propiedad" />
            <input type="text" value={spec.value || ''} onChange={(e) => onArrayChange('specs', i, 'value', e.target.value)}
              className="lp-text-input" placeholder="Valor" />
          </div>
          <button type="button" className="lp-array-del"
            onClick={() => { const next = [...(data.specs || [])]; next.splice(i, 1); onDataChange('specs', next); }}>✕</button>
        </div>
      ))}
      <button type="button" className="lp-add-btn"
        onClick={() => onDataChange('specs', [...(data.specs || []), { key: '', value: '' }])}>
        + Agregar especificación
      </button>
    </div>
  );
};

const HowItWorksEditor = ({ data, onDataChange, onArrayChange }) => (
  <div className="lp-editor-section">
    <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
    <p className="lp-subsection-label">Pasos ({(data.steps || []).length})</p>
    {(data.steps || []).map((step, i) => (
      <div key={i} className="lp-array-item">
        <div className="lp-array-fields">
          <input type="text" value={step.number || ''} onChange={(e) => onArrayChange('steps', i, 'number', e.target.value)}
            className="lp-text-input lp-step-input" placeholder="#" />
          <input type="text" value={step.title || ''} onChange={(e) => onArrayChange('steps', i, 'title', e.target.value)}
            className="lp-text-input" placeholder="Título" />
          <input type="text" value={step.description || ''} onChange={(e) => onArrayChange('steps', i, 'description', e.target.value)}
            className="lp-text-input" placeholder="Descripción" />
        </div>
        <button type="button" className="lp-array-del"
          onClick={() => { const next = [...(data.steps || [])]; next.splice(i, 1); onDataChange('steps', next); }}>✕</button>
      </div>
    ))}
    <button type="button" className="lp-add-btn"
      onClick={() => onDataChange('steps', [...(data.steps || []), { number: String((data.steps || []).length + 1), title: '', description: '' }])}>
      + Agregar paso
    </button>
  </div>
);

const ProductShowcaseEditor = ({ data, onDataChange, availableProducts = [], productsLoading = false, onProductImageUpload, isImageUploading }) => {
  const updateProduct = (index, field, value) => {
    if (typeof field === 'object') {
      // Patch object
      const next = [...(data.products || [])];
      next[index] = { ...next[index], ...field };
      onDataChange('products', next);
      return;
    }
    const next = [...(data.products || [])];
    next[index] = { ...next[index], [field]: value };
    onDataChange('products', next);
  };

  const selectCatalogProduct = (index, productId) => {
    const selected = availableProducts.find((p) => String(p.id) === String(productId));
    if (!selected) { updateProduct(index, 'productId', null); return; }
    const mapped = mapCatalogProductToLanding(selected);
    updateProduct(index, mapped);
  };

  return (
    <div className="lp-editor-section">
      <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
      <TextInput label="Subtítulo" value={data.subtitle} onChange={(v) => onDataChange('subtitle', v)} />
      <p className="lp-subsection-label">Productos ({(data.products || []).length})</p>
      {(data.products || []).map((product, i) => (
        <details key={i} className="lp-collapsible-item">
          <summary className="lp-collapsible-summary">
            {product.name || `Producto ${i + 1}`}
            <button type="button" className="lp-array-del"
              onClick={(e) => { e.stopPropagation(); const next = [...(data.products || [])]; next.splice(i, 1); onDataChange('products', next); }}>✕</button>
          </summary>
          <div className="lp-collapsible-body">
            <div className="lp-form-group">
              <label className="lp-field-label">Producto del catálogo</label>
              <select value={product.productId ?? ''} onChange={(e) => selectCatalogProduct(i, e.target.value)}
                className="lp-text-input" disabled={productsLoading}>
                <option value="">{productsLoading ? 'Cargando...' : 'Seleccionar...'}</option>
                {availableProducts.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>
            <TextInput label="Nombre" value={product.name} onChange={(v) => updateProduct(i, 'name', v)} />
            <TextInput label="Categoría" value={product.category} onChange={(v) => updateProduct(i, 'category', v)} />
            <TextArea label="Descripción" value={product.description} onChange={(v) => updateProduct(i, 'description', v)} rows={2} />
            <ImageInput label="Imagen" value={product.image} onChange={(v) => updateProduct(i, 'image', v)}
              onUpload={(file) => onProductImageUpload && onProductImageUpload(i, file)}
              isUploading={isImageUploading ? isImageUploading(`products.${i}.image`) : false} />
            <TextInput label="Precio original" value={product.originalPrice} type="number" onChange={(v) => updateProduct(i, 'originalPrice', v)} />
            <TextInput label="Precio venta" value={product.salePrice} type="number" onChange={(v) => updateProduct(i, 'salePrice', v)} />
            <TextInput label="Badge" value={product.badgeText} onChange={(v) => updateProduct(i, 'badgeText', v)} />
            <TextInput label="Texto CTA" value={product.ctaText} onChange={(v) => updateProduct(i, 'ctaText', v)} />
            <TextInput label="Enlace CTA" value={product.ctaLink} onChange={(v) => updateProduct(i, 'ctaLink', v)} />
          </div>
        </details>
      ))}
      <button type="button" className="lp-add-btn"
        onClick={() => onDataChange('products', [...(data.products || []), {
          name: '', description: '', category: '', image: '', features: [],
          originalPrice: 0, salePrice: 0, badgeText: '', badgeColor: '#ff6b35', ctaText: 'Ver Producto', ctaLink: '/'
        }])}>
        + Agregar producto
      </button>
    </div>
  );
};

const TestimonialsEditor = ({ data, onDataChange, onArrayChange }) => (
  <div className="lp-editor-section">
    <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
    <TextInput label="Subtítulo" value={data.subtitle} onChange={(v) => onDataChange('subtitle', v)} />
    <p className="lp-subsection-label">Testimonios ({(data.items || []).length})</p>
    {(data.items || []).map((item, i) => (
      <div key={i} className="lp-array-item">
        <div className="lp-array-fields">
          <textarea value={item.quote || ''} onChange={(e) => onArrayChange('items', i, 'quote', e.target.value)}
            className="lp-textarea" placeholder="Cita..." rows={2} />
          <input type="text" value={item.author || ''} onChange={(e) => onArrayChange('items', i, 'author', e.target.value)}
            className="lp-text-input" placeholder="Autor" />
          <input type="number" value={item.rating ?? 5} min={1} max={5}
            onChange={(e) => onArrayChange('items', i, 'rating', Number(e.target.value))}
            className="lp-text-input" style={{ width: 60 }} />
        </div>
        <button type="button" className="lp-array-del"
          onClick={() => { const next = [...(data.items || [])]; next.splice(i, 1); onDataChange('items', next); }}>✕</button>
      </div>
    ))}
    <button type="button" className="lp-add-btn"
      onClick={() => onDataChange('items', [...(data.items || []), { quote: '', author: '', avatar: '', rating: 5 }])}>
      + Agregar testimonio
    </button>
  </div>
);

const LeadCaptureEditor = ({ data, onDataChange }) => (
  <div className="lp-editor-section">
    <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
    <TextArea label="Descripción" value={data.description} onChange={(v) => onDataChange('description', v)} />
    <TextArea label="Texto About" value={data.aboutText} onChange={(v) => onDataChange('aboutText', v)} />
    <TextInput label="Texto del botón" value={data.submitText} onChange={(v) => onDataChange('submitText', v)} />
    <TextInput label="Mensaje de éxito" value={data.successMessage} onChange={(v) => onDataChange('successMessage', v)} />
  </div>
);

const FinalCtaEditor = ({ data, onDataChange }) => (
  <div className="lp-editor-section">
    <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
    <TextInput label="Subtítulo" value={data.subtitle} onChange={(v) => onDataChange('subtitle', v)} />
    <TextInput label="Texto CTA" value={data.ctaText} onChange={(v) => onDataChange('ctaText', v)} />
    <TextInput label="Enlace CTA" value={data.ctaLink} onChange={(v) => onDataChange('ctaLink', v)} />
  </div>
);

const SECTION_EDITORS = {
  hero: HeroEditor,
  valueProposition: ValuePropositionEditor,
  productHighlight: ProductHighlightEditor,
  trustBanner: TrustBannerEditor,
  featuredProduct: FeaturedProductEditor,
  howItWorks: HowItWorksEditor,
  productShowcase: ProductShowcaseEditor,
  testimonials: TestimonialsEditor,
  leadCapture: LeadCaptureEditor,
  finalCta: FinalCtaEditor,
};

/* ── Mini card for section list ── */
const SectionPreviewCard = ({ section, index, onMove, onToggle }) => {
  const icon = SECTION_ICONS[section.type] || '📄';
  const label = SECTION_LABELS[section.type] || section.type;
  const totalSections = 10; // approximate max

  return (
    <div className={`lp-section-card ${section.enabled ? '' : 'disabled'}`}>
      <div className="lp-section-card-reorder">
        <button type="button" disabled={index === 0}
          onClick={() => onMove(index, -1)} className="lp-reorder-btn" title="Mover arriba">↑</button>
        <button type="button" disabled={index === totalSections - 1}
          onClick={() => onMove(index, 1)} className="lp-reorder-btn" title="Mover abajo">↓</button>
      </div>
      <label className="lp-section-card-toggle">
        <input type="checkbox" checked={section.enabled} onChange={() => onToggle(section.id)} />
        <span className="lp-toggle-slider"></span>
      </label>
      <span className="lp-section-card-icon">{icon}</span>
      <span className="lp-section-card-label">{label}</span>
    </div>
  );
};

/* ═══════════════ COMPONENTE PRINCIPAL ═══════════════ */

function LandingPageAdmin({ settings, setSettings }) {
  const [activePanel, setActivePanel] = useState('config');
  const [openSections, setOpenSections] = useState({});
  const [availableProducts, setAvailableProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [imageUploadingKey, setImageUploadingKey] = useState('');

  const config = settings.landingPageConfig || cloneLandingPageConfig(null);

  // Cargar productos disponibles para secciones que los referencian
  useEffect(() => {
    let mounted = true;
    const fetchAvailableProducts = async () => {
      setProductsLoading(true);
      try {
        let page = 1, totalPages = 1;
        const allProducts = [];
        do {
          const res = await apiFetch(apiUrl(`/products?page=${page}&limit=100`));
          if (!res.ok) break;
          const payload = await res.json();
          const pageData = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
          allProducts.push(...pageData);
          totalPages = Number(payload?.totalPages) || 1;
          page += 1;
        } while (page <= totalPages && page <= 20);
        if (mounted) {
          const unique = [];
          const seen = new Set();
          allProducts.forEach((product) => {
            const key = String(product?.id ?? '');
            if (!key || seen.has(key)) return;
            seen.add(key);
            unique.push(product);
          });
          setAvailableProducts(unique);
        }
      } catch (err) {
        console.error('Error cargando productos:', err);
      } finally {
        if (mounted) setProductsLoading(false);
      }
    };
    fetchAvailableProducts();
    return () => { mounted = false; };
  }, []);

  const updateConfig = useCallback((updater) => {
    setSettings(prev => ({
      ...prev,
      landingPageConfig: typeof updater === 'function'
        ? updater(prev.landingPageConfig || cloneLandingPageConfig(null))
        : updater
    }));
  }, [setSettings]);

  const toggleSection = (id) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const moveSection = (index, direction) => {
    updateConfig(prev => {
      const next = cloneLandingPageConfig(prev);
      const newIdx = index + direction;
      if (newIdx < 0 || newIdx >= next.sections.length) return next;
      [next.sections[index], next.sections[newIdx]] = [next.sections[newIdx], next.sections[index]];
      return next;
    });
  };

  const toggleSectionEnabled = (sectionId) => {
    updateConfig(prev => {
      const next = cloneLandingPageConfig(prev);
      const section = next.sections.find(s => s.id === sectionId);
      if (section) section.enabled = !section.enabled;
      return next;
    });
  };

  const updateSectionData = useCallback((sectionId, field, value) => {
    updateConfig(prev => updateNestedField(prev, sectionId, `data.${field}`, value));
  }, [updateConfig]);

  const updateSectionStyle = (sectionId, field, value) => {
    updateConfig(prev => updateNestedField(prev, sectionId, `styles.${field}`, value));
  };

  const updateSectionArrayItem = useCallback((sectionId, arrayField, index, field, value) => {
    updateConfig(prev => {
      const next = cloneLandingPageConfig(prev);
      const section = next.sections.find(s => s.id === sectionId);
      if (!section || !Array.isArray(section.data[arrayField])) return next;
      section.data[arrayField][index] = { ...section.data[arrayField][index], [field]: value };
      return next;
    });
  }, [updateConfig]);

  const uploadImageToSettingsStorage = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await apiFetch(apiUrl('/settings/upload'), { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Error al subir imagen');
    const data = await response.json();
    if (!data?.url) throw new Error('La subida no devolvió URL');
    return data.url;
  }, []);

  const handleSectionImageUpload = useCallback(async (sectionId, field, file) => {
    const uploadKey = `${sectionId}.${field}`;
    setImageUploadingKey(uploadKey);
    const uploadToast = toast.loading('Subiendo imagen...');
    try {
      const url = await uploadImageToSettingsStorage(file);
      updateSectionData(sectionId, field, url);
      toast.success('Imagen subida correctamente', { id: uploadToast });
    } catch (err) {
      console.error('Error subiendo imagen:', err);
      toast.error('No se pudo subir la imagen', { id: uploadToast });
    } finally {
      setImageUploadingKey('');
    }
  }, [updateSectionData, uploadImageToSettingsStorage]);

  const handleSectionArrayImageUpload = useCallback(async (sectionId, arrayField, index, field, file) => {
    const uploadKey = `${sectionId}.${arrayField}.${index}.${field}`;
    setImageUploadingKey(uploadKey);
    const uploadToast = toast.loading('Subiendo imagen...');
    try {
      const url = await uploadImageToSettingsStorage(file);
      updateSectionArrayItem(sectionId, arrayField, index, field, url);
      toast.success('Imagen subida correctamente', { id: uploadToast });
    } catch (err) {
      console.error('Error subiendo imagen:', err);
      toast.error('No se pudo subir la imagen', { id: uploadToast });
    } finally {
      setImageUploadingKey('');
    }
  }, [updateSectionArrayItem, uploadImageToSettingsStorage]);

  const enabledSections = useMemo(() =>
    (config.sections || []).filter(s => s.enabled),
    [config.sections]
  );

  /** Navegación horizontal: paneles fijos + dinámicos para cada sección */
  const sectionNavItems = useMemo(() => {
    const items = [...PANELS];
    (config.sections || []).forEach((section) => {
      const icon = SECTION_ICONS[section.type] || '📄';
      const label = SECTION_LABELS[section.type] || section.type;
      items.push({ id: `section-${section.id}`, icon, label, isSection: true });
    });
    return items;
  }, [config.sections]);

  return (
    <div className="lp-app">
      {/* ── Barra de navegación horizontal ── */}
      <nav className="lp-section-nav" aria-label="Secciones de la landing page">
        {sectionNavItems.map(item => (
          <button
            key={item.id}
            type="button"
            title={item.label}
            className={`lp-nav-btn${activePanel === item.id ? ' active' : ''}`}
            onClick={() => activePanel === `section-${item.sectionId}` ? setOpenSections(prev => ({ ...prev, [item.sectionId]: !prev[item.sectionId] })) : setActivePanel(item.id)}
          >
            <span className="lp-nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="lp-nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Cuerpo: sidebar + preview ── */}
      <div className="lp-body">
        {/* ── SIDEBAR ── */}
        <div className="lp-sidebar">
          {/* ── PANEL: Config ── */}
          {activePanel === 'config' && (
            <div className="lp-panel">
              <p className="lp-panel-label">Landing Page</p>

              <div className="lp-toggle-row">
                <div className="lp-toggle-info">
                  <span className="lp-toggle-title">Activar Landing Page</span>
                  <span className="lp-toggle-desc">Ruta: <code>{config.route || '/landing'}</code></span>
                </div>
                <div className={`lp-toggle${config.enabled ? ' on' : ''}`} role="switch"
                  aria-checked={!!config.enabled}
                  onClick={() => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), enabled: !prev.enabled }))}>
                  <div className="lp-toggle-thumb" />
                </div>
              </div>

              <div className="lp-panel-divider" />

              <div className="lp-form-group">
                <label className="lp-field-label">Título de la página</label>
                <input type="text" className="lp-text-input" value={config.pageTitle || ''}
                  onChange={(e) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), pageTitle: e.target.value }))} />
              </div>

              <div className="lp-form-group">
                <label className="lp-field-label">Ruta URL</label>
                <input type="text" className="lp-text-input" value={config.route || '/landing'}
                  onChange={(e) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), route: e.target.value }))}
                  placeholder="/landing" />
              </div>

              <div className="lp-form-group">
                <label className="lp-field-label">Plantilla visual</label>
                <select value={config.templateId || 'modern-minimal'}
                  onChange={(e) => updateConfig(prev => applyLandingTemplatePreset(prev, e.target.value))}
                  className="lp-text-input">
                  {LANDING_TEMPLATE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>{opt.name}</option>
                  ))}
                </select>
                <p className="lp-field-hint">Al cambiar plantilla se aplican estilos base.</p>
              </div>

              <div className="lp-panel-divider" />
              <button type="button" className="lp-reset-btn"
                onClick={() => {
                  if (window.confirm('¿Restablecer toda la configuración de la landing page?')) {
                    updateConfig(cloneLandingPageConfig(null));
                  }
                }}>
                🔄 Restablecer valores por defecto
              </button>
            </div>
          )}

          {/* ── PANEL: Global Styles + Palette ── */}
          {activePanel === 'globalStyles' && (
            <div className="lp-panel">
              <p className="lp-panel-label">Paleta de Colores</p>
              <p className="lp-panel-hint">Elige una paleta o personaliza colores individualmente.</p>

              {/* Palette presets */}
              <div className="lp-palette-list">
                {COLOR_PALETTES.map(pal => {
                  const gs = config.globalStyles || {};
                  const isActive =
                    gs.darkColor === (pal.colors.secondaryColor || pal.colors.primaryColor) &&
                    gs.lightColor === pal.colors.backgroundColor;
                  return (
                    <button
                      key={pal.id}
                      type="button"
                      className={`lp-palette-row${isActive ? ' selected' : ''}`}
                      onClick={() => {
                        const lpStyles = paletteToLandingStyles(pal.colors);
                        updateConfig(prev => ({
                          ...cloneLandingPageConfig(prev),
                          globalStyles: { ...prev.globalStyles, ...lpStyles },
                          // Sync section styles to match the new palette (only for sections
                          // that still have the same defaults from the previous palette)
                          sections: (prev.sections || []).map(section => {
                            const oldGs = prev.globalStyles || {};
                            const s = section.styles || {};
                            // Only override bgColor and textColor if they match the old global defaults
                            const refresh = {};
                            if (s.bgColor && s.bgColor === oldGs.darkColor) refresh.bgColor = lpStyles.darkColor;
                            if (s.textColor && s.textColor === oldGs.textColor) refresh.textColor = lpStyles.textColor;
                            if (s.ctaBgColor && s.ctaBgColor === oldGs.accentColor) refresh.ctaBgColor = lpStyles.accentColor;
                            return { ...section, styles: { ...s, ...refresh } };
                          })
                        }));
                      }}
                    >
                      <div className="lp-palette-chips">
                        {[
                          pal.colors.primaryColor,
                          pal.colors.accentColor,
                          pal.colors.backgroundColor,
                          pal.colors.textColor
                        ].map((c, i) => (
                          <div key={i} className="lp-palette-chip" style={{ background: c }} />
                        ))}
                      </div>
                      <span className="lp-palette-name">{pal.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="lp-panel-divider" />
              <p className="lp-panel-label">Ajuste Fino</p>
              <div className="lp-color-slots">
                <ColorInput label="Oscuro" value={config.globalStyles?.darkColor}
                  onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, darkColor: v } }))} />
                <ColorInput label="Claro" value={config.globalStyles?.lightColor}
                  onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, lightColor: v } }))} />
                <ColorInput label="Acento" value={config.globalStyles?.accentColor}
                  onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, accentColor: v } }))} />
                <ColorInput label="Texto" value={config.globalStyles?.textColor}
                  onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, textColor: v } }))} />
                <ColorInput label="Títulos" value={config.globalStyles?.headingColor}
                  onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, headingColor: v } }))} />
              </div>
              <div className="lp-panel-divider" />
              <p className="lp-panel-label">Dimensiones</p>
              <div className="lp-style-section">
                <TextInput label="Ancho máx (px)" value={config.globalStyles?.maxWidth} type="number"
                  onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, maxWidth: v } }))} />
                <TextInput label="Padding secc (px)" value={config.globalStyles?.sectionPadding} type="number"
                  onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, sectionPadding: v } }))} />
              </div>
            </div>
          )}

          {/* ── PANEL: Plantillas ── */}
          {activePanel === 'templates' && (
            <div className="lp-panel">
              <p className="lp-panel-label">Plantillas de Servicios</p>
              <p className="lp-panel-hint">Selecciona una plantilla para aplicar colores, contenido y secciones completas.</p>
              <div className="lp-template-grid">
                {SERVICE_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    className={`lp-template-card`}
                    onClick={() => {
                      updateConfig(prev => applyServiceTemplate(prev, tmpl.id));
                    }}
                  >
                    <span className="lp-template-icon">{tmpl.icon}</span>
                    <span className="lp-template-name">{tmpl.name}</span>
                    <span className="lp-template-badge">{tmpl.badge}</span>
                    <span className="lp-template-desc">{tmpl.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── PANEL: Secciones ── */}
          {activePanel === 'sections' && (
            <div className="lp-panel">
              <p className="lp-panel-label">Secciones</p>
              <p className="lp-panel-hint">Reordena, activa o desactiva secciones.</p>
              <div className="lp-section-card-list">
                {(config.sections || []).map((section, index) => (
                  <SectionPreviewCard
                    key={section.id}
                    section={section}
                    index={index}
                    onMove={moveSection}
                    onToggle={toggleSectionEnabled}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── PANELES DINÁMICOS: Secciones individuales ── */}
          {(config.sections || []).map(section => {
            if (activePanel !== `section-${section.id}`) return null;
            const SectionEditor = SECTION_EDITORS[section.type];
            if (!SectionEditor) return (
              <div className="lp-panel" key={section.id}>
                <p className="lp-panel-label">{SECTION_LABELS[section.type] || section.type}</p>
                <p className="lp-panel-hint">No hay editor disponible para esta sección.</p>
              </div>
            );
            return (
              <div className="lp-panel lp-panel--scroll" key={section.id}>
                <p className="lp-panel-label">{SECTION_LABELS[section.type] || section.type}</p>
                <SectionEditor
                  data={section.data || {}}
                  onDataChange={(field, value) => updateSectionData(section.id, field, value)}
                  onArrayChange={(arrayField, index, field, value) => updateSectionArrayItem(section.id, arrayField, index, field, value)}
                  onImageUpload={(field, file) => handleSectionImageUpload(section.id, field, file)}
                  onProductImageUpload={(index, file) => handleSectionArrayImageUpload(section.id, 'products', index, 'image', file)}
                  isImageUploading={(fieldPath) => imageUploadingKey === `${section.id}.${fieldPath}`}
                  availableProducts={availableProducts}
                  productsLoading={productsLoading}
                />
                <div className="lp-panel-divider" />
                <StylesEditor
                  styles={section.styles}
                  onStyleChange={(field, value) => updateSectionStyle(section.id, field, value)}
                />
              </div>
            );
          })}
        </div>

        {/* ── PREVIEW ── */}
        <div className="lp-preview-area">
          <div className="lp-preview-topbar">
            <span className="lp-preview-title">Vista previa</span>
            <span className="lp-preview-badge">
              {config.enabled ? '✅ Activada' : '❌ Desactivada'}
              {' · '}
              {enabledSections.length} sección(es) activa(s)
            </span>
          </div>
          <div className="lp-preview-scroll">
            <div className="lp-preview-container">
              {/* Renderizado de la landing en miniatura */}
              <div className="lp-landing-preview" style={{
                '--lp-dark': config.globalStyles?.darkColor || '#111827',
                '--lp-light': config.globalStyles?.lightColor || '#ffffff',
                '--lp-accent': config.globalStyles?.accentColor || '#2563eb',
                '--lp-text': config.globalStyles?.textColor || '#111827',
                '--lp-heading': config.globalStyles?.headingColor || '#0f172a',
                maxWidth: config.globalStyles?.maxWidth ? `${config.globalStyles.maxWidth}px` : '1200px',
                margin: '0 auto',
              }}>
                {enabledSections.length === 0 && (
                  <div className="lp-preview-empty">
                    <p>No hay secciones activas.</p>
                    <p className="lp-preview-empty-hint">Activa secciones en el panel "Secciones" para ver la vista previa.</p>
                  </div>
                )}
                {enabledSections.map((section) => (
                  <div key={section.id} className="lp-preview-section">
                    <div className="lp-preview-section-badge">{SECTION_ICONS[section.type] || '📄'} {SECTION_LABELS[section.type] || section.type}</div>

                    {/* Hero — full-width background image */}
                    {section.type === 'hero' && (
                      <div className="lp-prev-hero" style={{
                        position: 'relative',
                        minHeight: `${Math.min(section.styles?.minHeight || 400, 380)}px`,
                        display: 'flex', alignItems: 'center',
                        padding: '50px 40px',
                        textAlign: section.data?.layout === 'text-right' ? 'right' : 'left',
                        justifyContent: section.data?.layout === 'text-right' ? 'flex-end' : 'flex-start',
                        overflow: 'hidden',
                        color: section.styles?.textColor || 'var(--lp-light)',
                        background: section.data?.image
                          ? `url(${section.data.image}) center center / cover no-repeat`
                          : (section.styles?.bgGradient || section.styles?.bgColor || 'var(--lp-dark)')
                      }}>
                        {/* Dark overlay */}
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: `rgba(0,0,0,${section.styles?.bgOverlayOpacity ?? 0.5})`,
                          pointerEvents: 'none', zIndex: 0
                        }} />
                        <div style={{ position: 'relative', zIndex: 1, maxWidth: '70%' }}>
                          {section.data?.badgeText && (
                            <span style={{
                              display: 'inline-block', padding: '3px 10px', borderRadius: 4,
                              background: section.styles?.ctaBgColor || section.data?.badgeColor || 'var(--lp-accent)',
                              color: '#fff', fontSize: '0.6rem', fontWeight: 700,
                              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8
                            }}>{section.data.badgeText}</span>
                          )}
                          <h3 style={{ fontSize: '1.4rem', margin: '0 0 6px', fontWeight: 700, lineHeight: 1.2 }}>{section.data?.title || 'Título del Hero'}</h3>
                          <p style={{ fontSize: '0.8rem', opacity: 0.9, margin: '0 0 14px', lineHeight: 1.4 }}>{section.data?.subtitle || 'Subtítulo del hero'}</p>
                          <span style={{ display: 'inline-block', padding: '7px 18px', borderRadius: 6, background: section.styles?.ctaBgColor || 'var(--lp-accent)', color: section.styles?.ctaTextColor || 'var(--lp-light)', fontSize: '0.75rem', fontWeight: 600 }}>{section.data?.ctaText || 'Comprar Ahora'}</span>
                        </div>
                      </div>
                    )}

                    {/* Value Proposition */}
                    {section.type === 'valueProposition' && (
                      <div className="lp-prev-section-block" style={{ background: section.styles?.bgColor || 'var(--lp-light)', color: section.styles?.textColor || 'var(--lp-text)', padding: '40px 24px' }}>
                        <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, margin: '0 0 4px' }}>{section.data?.label || 'Nuestras Ventajas'}</p>
                        <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem' }}>{section.data?.title || '¿Por qué elegirnos?'}</h3>
                        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: '0 0 16px' }}>{section.data?.description || ''}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
                          {(section.data?.points || []).slice(0, 4).map((p, i) => (
                            <div key={i} style={{ background: section.styles?.cardBgColor || '#f8fafc', borderRadius: 8, padding: 12, textAlign: 'center', border: `1px solid ${section.styles?.cardBorderColor || '#e5e7eb'}` }}>
                              <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{p.icon || '✨'}</div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>{p.title || ''}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Product Highlight */}
                    {section.type === 'productHighlight' && (
                      <div className="lp-prev-section-block" style={{ background: section.styles?.bgColor || 'var(--lp-light)', color: section.styles?.textColor || 'var(--lp-text)', padding: '40px 24px' }}>
                        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexDirection: section.data?.layout === 'image-right' ? 'row-reverse' : 'row' }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.6, margin: '0 0 4px' }}>{section.data?.label || ''}</p>
                            <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem' }}>{section.data?.title || 'Producto Destacado'}</h3>
                            <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: '0 0 12px' }}>{section.data?.description || ''}</p>
                            <span style={{ display: 'inline-block', padding: '6px 16px', borderRadius: 6, background: section.styles?.ctaBgColor || 'var(--lp-accent)', color: section.styles?.ctaTextColor || 'var(--lp-light)', fontSize: '0.75rem', fontWeight: 600 }}>{section.data?.ctaText || 'Ver Más'}</span>
                          </div>
                          {section.data?.image && (
                            <div style={{ flex: '0 0 35%' }}>
                              <img src={section.data.image} alt="" style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8 }} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Trust Banner */}
                    {section.type === 'trustBanner' && (
                      <div className="lp-prev-section-block" style={{ background: section.styles?.bgColor || 'var(--lp-accent)', color: section.styles?.textColor || 'var(--lp-light)', padding: '30px 24px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>{section.data?.title || 'Valorado por clientes'}</h3>
                        <p style={{ fontSize: '0.8rem', opacity: 0.85, margin: 0 }}>{section.data?.subtitle || ''}</p>
                      </div>
                    )}

                    {/* Featured Product */}
                    {section.type === 'featuredProduct' && (
                      <div className="lp-prev-section-block" style={{ background: section.styles?.bgColor || 'var(--lp-light)', color: section.styles?.textColor || 'var(--lp-text)', padding: '40px 24px' }}>
                        <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', opacity: 0.6, margin: '0 0 4px' }}>{section.data?.label || 'El mejor producto'}</p>
                        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>{section.data?.productName || 'Producto'}</h3>
                        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: '0 0 12px' }}>{section.data?.description || ''}</p>
                        {section.data?.salePrice > 0 && (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                            {section.data?.originalPrice > section.data?.salePrice && (
                              <span style={{ fontSize: '0.8rem', textDecoration: 'line-through', opacity: 0.5 }}>${Number(section.data.originalPrice).toFixed(2)}</span>
                            )}
                            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: section.styles?.priceSaleColor || 'var(--lp-accent)' }}>${Number(section.data.salePrice).toFixed(2)}</span>
                            {section.data?.badgeText && (
                              <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: 4, background: '#ff6b35', color: '#fff', fontWeight: 600 }}>{section.data.badgeText}</span>
                            )}
                          </div>
                        )}
                        {(section.data?.specs || []).slice(0, 3).map((spec, i) => (
                          <div key={i} style={{ display: 'flex', gap: 6, fontSize: '0.75rem', marginBottom: 2 }}>
                            <span style={{ opacity: 0.6 }}>{spec.key}:</span>
                            <span>{spec.value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* How It Works */}
                    {section.type === 'howItWorks' && (
                      <div className="lp-prev-section-block" style={{ background: section.styles?.bgColor || 'var(--lp-light)', color: section.styles?.textColor || 'var(--lp-text)', padding: '40px 24px' }}>
                        <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', textAlign: 'center' }}>{section.data?.title || '¿Cómo Funciona?'}</h3>
                        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {(section.data?.steps || []).slice(0, 3).map((step, i) => (
                            <div key={i} style={{ flex: 1, minWidth: 120, maxWidth: 180, textAlign: 'center', padding: 12, borderRadius: 8, background: section.styles?.stepCardBg || '#f8fafc', border: `1px solid ${section.styles?.stepCardBorder || '#e5e7eb'}` }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: section.styles?.stepNumberBg || 'var(--lp-accent)', color: section.styles?.stepNumberColor || '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, margin: '0 auto 6px' }}>{step.number || i + 1}</div>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 2 }}>{step.title || ''}</div>
                              <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>{step.description || ''}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Product Showcase */}
                    {section.type === 'productShowcase' && (
                      <div className="lp-prev-section-block" style={{ background: section.styles?.bgColor || 'var(--lp-light)', color: section.styles?.textColor || 'var(--lp-text)', padding: '40px 24px' }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', textAlign: 'center' }}>{section.data?.title || 'Productos Destacados'}</h3>
                        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: '0 0 16px', textAlign: 'center' }}>{section.data?.subtitle || ''}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                          {(section.data?.products || []).slice(0, 4).map((p, i) => (
                            <div key={i} style={{ background: section.styles?.cardBgColor || '#fff', borderRadius: 8, padding: 10, border: `1px solid ${section.styles?.cardBorderColor || '#e5e7eb'}`, boxShadow: section.styles?.cardShadow || 'none' }}>
                              {p.image && <img src={p.image} alt="" style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 4, marginBottom: 6 }} />}
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 2 }}>{p.name || 'Producto'}</div>
                              <div style={{ fontSize: '0.65rem', opacity: 0.6, marginBottom: 4 }}>{p.category || ''}</div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: section.styles?.ctaBgColor || 'var(--lp-accent)' }}>${Number(p.salePrice || 0).toFixed(2)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Testimonials */}
                    {section.type === 'testimonials' && (
                      <div className="lp-prev-section-block" style={{ background: section.styles?.bgColor || 'var(--lp-light)', color: section.styles?.textColor || 'var(--lp-text)', padding: '40px 24px' }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem', textAlign: 'center' }}>{section.data?.title || 'Testimonios'}</h3>
                        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: '0 0 16px', textAlign: 'center' }}>{section.data?.subtitle || ''}</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                          {(section.data?.items || []).slice(0, 3).map((item, i) => (
                            <div key={i} style={{ background: section.styles?.cardBgColor || '#fff', borderRadius: 8, padding: 12, border: `1px solid ${section.styles?.cardBorderColor || '#e5e7eb'}` }}>
                              <div style={{ fontSize: '0.7rem', fontStyle: 'italic', marginBottom: 8, opacity: 0.85, lineHeight: 1.4 }}>"{item.quote || ''}"</div>
                              <div style={{ fontSize: '0.7rem', fontWeight: 600 }}>- {item.author || ''}</div>
                              {item.rating && (
                                <div style={{ fontSize: '0.7rem', color: section.styles?.starColor || '#f59e0b', marginTop: 4 }}>{'★'.repeat(Math.min(item.rating, 5))}{'☆'.repeat(Math.max(0, 5 - item.rating))}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lead Capture */}
                    {section.type === 'leadCapture' && (
                      <div className="lp-prev-section-block" style={{ background: section.styles?.bgColor || 'var(--lp-dark)', color: section.styles?.textColor || 'var(--lp-light)', padding: '40px 24px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem' }}>{section.data?.title || '¡Obtén descuento!'}</h3>
                        <p style={{ fontSize: '0.8rem', opacity: 0.85, margin: '0 0 16px' }}>{section.data?.description || ''}</p>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                          <input type="email" placeholder="Tu correo" readOnly
                            style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '0.8rem' }} />
                          <span style={{ padding: '8px 16px', borderRadius: 6, background: section.styles?.submitBgColor || 'var(--lp-accent)', color: section.styles?.submitTextColor || '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'default' }}>{section.data?.submitText || 'Enviar'}</span>
                        </div>
                      </div>
                    )}

                    {/* Final CTA */}
                    {section.type === 'finalCta' && (
                      <div className="lp-prev-section-block" style={{ background: section.styles?.bgColor || 'var(--lp-dark)', color: section.styles?.textColor || 'var(--lp-light)', padding: '50px 24px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: '1.3rem' }}>{section.data?.title || '¿Qué esperas?'}</h3>
                        <p style={{ fontSize: '0.85rem', opacity: 0.85, margin: '0 0 20px' }}>{section.data?.subtitle || ''}</p>
                        <span style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 6, background: section.styles?.ctaBgColor || 'var(--lp-accent)', color: section.styles?.ctaTextColor || 'var(--lp-light)', fontSize: '0.85rem', fontWeight: 700 }}>{section.data?.ctaText || 'Ir a la Tienda'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPageAdmin;
