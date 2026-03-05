// LandingPageAdmin.jsx - Panel de administración para la landing page
// Permite configurar: activar/desactivar, estilos globales, secciones (contenido, orden, toggle)

import React, { useState, useCallback, useEffect } from 'react';
import { DEFAULT_LANDING_PAGE_CONFIG, cloneLandingPageConfig } from '../../utils/landingPageDefaults';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { LANDING_TEMPLATE_OPTIONS, applyLandingTemplatePreset } from '../../utils/landingPageTemplates';
import toast from 'react-hot-toast';

/* ═══════════════ CONSTANTES ═══════════════ */

/** Nombres legibles para cada tipo de sección */
const SECTION_LABELS = {
  hero: '🎯 Hero (Encabezado)',
  valueProposition: '💎 Propuesta de Valor',
  productHighlight: '📸 Producto Destacado',
  trustBanner: '🏆 Banner de Confianza',
  featuredProduct: '⭐ Producto Estrella',
  howItWorks: '📋 Cómo Funciona',
  productShowcase: '🛍️ Vitrina de Productos',
  testimonials: '💬 Testimonios',
  leadCapture: '📧 Captura de Leads',
  finalCta: '🚀 CTA Final',
};

/* ═══════════════ HELPERS ═══════════════ */

/** Actualiza un campo anidado en la configuración */
const updateNestedField = (config, sectionId, path, value) => {
  const next = cloneLandingPageConfig(config);
  const sectionIdx = next.sections.findIndex(s => s.id === sectionId);
  if (sectionIdx < 0) return next;

  // path = 'data.title' or 'styles.bgColor'
  const parts = path.split('.');
  let target = next.sections[sectionIdx];
  for (let i = 0; i < parts.length - 1; i++) {
    target = target[parts[i]];
  }
  target[parts[parts.length - 1]] = value;
  return next;
};

/** Normaliza un producto del catálogo al formato usado por la landing */
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

/** Input color con preview */
const ColorInput = ({ label, value, onChange }) => {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  const isHexColor = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(normalizedValue);

  return (
    <div className="form-group" style={{ flex: '1 1 200px' }}>
      <label>{label}</label>
      <div className="color-input-wrapper">
        <input type="color" value={isHexColor ? normalizedValue : '#000000'} onChange={(e) => onChange(e.target.value)} />
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)}
          style={{ marginLeft: 8, flex: 1, padding: '4px 8px', fontSize: '0.85rem', border: '1px solid #ddd', borderRadius: 4 }} />
      </div>
    </div>
  );
};

/** Input texto simple */
const TextInput = ({ label, value, onChange, placeholder, type = 'text' }) => (
  <div className="form-group">
    <label>{label}</label>
    <input type={type} value={value ?? ''} onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      placeholder={placeholder} className="form-control" />
  </div>
);

/** Textarea */
const TextArea = ({ label, value, onChange, rows = 3 }) => (
  <div className="form-group">
    <label>{label}</label>
    <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} rows={rows} className="form-control" />
  </div>
);

/** Input de imagen (URL + upload de archivo) */
const ImageInput = ({ label, value, onChange, onUpload, isUploading = false }) => (
  <div className="form-group">
    <label>{label}</label>
    <input
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder="https://..."
      className="form-control"
    />
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && onUpload) onUpload(file);
          e.target.value = '';
        }}
        disabled={isUploading}
      />
      {isUploading && <small style={{ opacity: 0.8 }}>Subiendo imagen...</small>}
    </div>
    {value && (
      <div style={{ marginTop: 8 }}>
        <img src={value} alt="preview" style={{ width: 45, height: 45, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd' }} />
      </div>
    )}
  </div>
);

/* ═══════════════ EDITORES POR TIPO DE SECCIÓN ═══════════════ */

/** Editor genérico de estilos (colores de la sección) */
const StylesEditor = ({ styles, onStyleChange }) => {
  if (!styles) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <p className="section-description" style={{ marginBottom: 8 }}>Colores de la sección:</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {Object.entries(styles).map(([key, val]) => {
          // Solo mostrar inputs de color para valores que parecen colores
          const isColor = typeof val === 'string' && (val.startsWith('#') || val.startsWith('rgb'));
          if (!isColor) return null;
          // Formatear label: camelCase → palabras
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          return <ColorInput key={key} label={label} value={val} onChange={(v) => onStyleChange(key, v)} />;
        })}
      </div>
      {/* Campos no-color (shadows, gradients, etc.) */}
      {Object.entries(styles).map(([key, val]) => {
        if (typeof val === 'number') {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          return (
            <TextInput key={key} label={label} value={val} type="number"
              onChange={(v) => onStyleChange(key, v)} />
          );
        }
        const isColor = typeof val === 'string' && (val.startsWith('#') || val.startsWith('rgb'));
        if (typeof val === 'string' && !isColor && val !== '') {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          return (
            <TextInput key={key} label={label} value={val}
              onChange={(v) => onStyleChange(key, v)} />
          );
        }
        return null;
      })}
    </div>
  );
};

/** Editor para Hero */
const HeroEditor = ({ data, onDataChange, onImageUpload, isImageUploading, availableProducts = [], productsLoading = false }) => {
  const handleSelectHeroProduct = (productId) => {
    const selected = availableProducts.find((p) => String(p.id) === String(productId));
    if (!selected) {
      onDataChange('productId', null);
      return;
    }

    const mapped = mapCatalogProductToLanding(selected);
    onDataChange('productId', mapped.productId);
    onDataChange('title', mapped.productName || mapped.name || data.title);
    onDataChange('subtitle', mapped.description || data.subtitle);
    onDataChange('image', mapped.image || data.image);
    onDataChange('ctaLink', mapped.ctaLink || data.ctaLink);
    onDataChange('ctaText', data.ctaText || mapped.ctaText || 'Ver Producto');
  };

  return (
    <>
      <div className="settings-grid">
        <div className="form-group">
          <label>Seleccionar producto del catálogo (opcional)</label>
          <select
            value={data.productId ?? ''}
            onChange={(e) => handleSelectHeroProduct(e.target.value)}
            className="form-control"
            disabled={productsLoading}
          >
            <option value="">{productsLoading ? 'Cargando productos...' : 'Ninguno (manual)'}</option>
            {availableProducts.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </div>
        <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
        <TextInput label="Subtítulo" value={data.subtitle} onChange={(v) => onDataChange('subtitle', v)} />
        <TextInput label="Texto del botón CTA" value={data.ctaText} onChange={(v) => onDataChange('ctaText', v)} />
        <TextInput label="Enlace del CTA" value={data.ctaLink} onChange={(v) => onDataChange('ctaLink', v)} placeholder="/" />
        <ImageInput
          label="Imagen"
          value={data.image}
          onChange={(v) => onDataChange('image', v)}
          onUpload={(file) => onImageUpload && onImageUpload('image', file)}
          isUploading={isImageUploading ? isImageUploading('image') : false}
        />
        <TextInput label="Texto del badge" value={data.badgeText} onChange={(v) => onDataChange('badgeText', v)} />
        <div className="form-group">
          <label>Layout</label>
          <select value={data.layout || 'text-left'} onChange={(e) => onDataChange('layout', e.target.value)} className="form-control">
            <option value="text-left">Texto izquierda</option>
            <option value="text-right">Texto derecha</option>
          </select>
        </div>
      </div>
    </>
  );
};

/** Editor para Value Proposition */
const ValuePropositionEditor = ({ data, onDataChange, onArrayChange }) => (
  <>
    <div className="settings-grid">
      <TextInput label="Label superior" value={data.label} onChange={(v) => onDataChange('label', v)} />
      <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
      <TextArea label="Descripción" value={data.description} onChange={(v) => onDataChange('description', v)} />
    </div>
    <h4 style={{ marginTop: 16 }}>Puntos ({(data.points || []).length})</h4>
    {(data.points || []).map((point, i) => (
      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: 8, background: '#f8f9fa', borderRadius: 6 }}>
        <input type="text" value={point.icon || ''} onChange={(e) => onArrayChange('points', i, 'icon', e.target.value)}
          style={{ width: 40, textAlign: 'center' }} placeholder="🔥" />
        <input type="text" value={point.title || ''} onChange={(e) => onArrayChange('points', i, 'title', e.target.value)}
          style={{ flex: 1 }} placeholder="Título" className="form-control" />
        <input type="text" value={point.description || ''} onChange={(e) => onArrayChange('points', i, 'description', e.target.value)}
          style={{ flex: 2 }} placeholder="Descripción (opcional)" className="form-control" />
        <button type="button" onClick={() => {
          const next = [...(data.points || [])];
          next.splice(i, 1);
          onDataChange('points', next);
        }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button>
      </div>
    ))}
    <button type="button" onClick={() => onDataChange('points', [...(data.points || []), { icon: '✨', title: '', description: '' }])}
      style={{ marginTop: 4, padding: '4px 12px', fontSize: '0.85rem', cursor: 'pointer' }}>+ Agregar punto</button>
  </>
);

/** Editor para Product Highlight */
const ProductHighlightEditor = ({ data, onDataChange, onImageUpload, isImageUploading, availableProducts = [], productsLoading = false }) => {
  const handleSelectHighlightProduct = (productId) => {
    const selected = availableProducts.find((p) => String(p.id) === String(productId));
    if (!selected) {
      onDataChange('productId', null);
      return;
    }

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
    <div className="settings-grid">
      <div className="form-group">
        <label>Seleccionar producto del catálogo (opcional)</label>
        <select
          value={data.productId ?? ''}
          onChange={(e) => handleSelectHighlightProduct(e.target.value)}
          className="form-control"
          disabled={productsLoading}
        >
          <option value="">{productsLoading ? 'Cargando productos...' : 'Ninguno (manual)'}</option>
          {availableProducts.map((product) => (
            <option key={product.id} value={product.id}>{product.name}</option>
          ))}
        </select>
      </div>
      <TextInput label="Label" value={data.label} onChange={(v) => onDataChange('label', v)} />
      <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
      <TextArea label="Descripción" value={data.description} onChange={(v) => onDataChange('description', v)} />
      <TextInput label="Texto CTA" value={data.ctaText} onChange={(v) => onDataChange('ctaText', v)} />
      <TextInput label="Enlace CTA" value={data.ctaLink} onChange={(v) => onDataChange('ctaLink', v)} />
      <ImageInput
        label="Imagen"
        value={data.image}
        onChange={(v) => onDataChange('image', v)}
        onUpload={(file) => onImageUpload && onImageUpload('image', file)}
        isUploading={isImageUploading ? isImageUploading('image') : false}
      />
      <div className="form-group">
        <label>Layout</label>
        <select value={data.layout || 'image-left'} onChange={(e) => onDataChange('layout', e.target.value)} className="form-control">
          <option value="image-left">Imagen izquierda</option>
          <option value="image-right">Imagen derecha</option>
        </select>
      </div>
    </div>
  );
};

/** Editor para Trust Banner */
const TrustBannerEditor = ({ data, onDataChange }) => (
  <div className="settings-grid">
    <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
    <TextInput label="Subtítulo" value={data.subtitle} onChange={(v) => onDataChange('subtitle', v)} />
  </div>
);

/** Editor para Featured Product */
const FeaturedProductEditor = ({ data, onDataChange, onArrayChange, availableProducts = [], productsLoading = false, onImageUpload, isImageUploading }) => {
  const patchFeaturedProduct = (patch) => {
    Object.entries(patch).forEach(([key, value]) => {
      onDataChange(key, value);
    });
  };

  const handleSelectFeaturedProduct = (productId) => {
    const selected = availableProducts.find((p) => String(p.id) === String(productId));
    if (!selected) {
      onDataChange('productId', null);
      return;
    }

    const mapped = mapCatalogProductToLanding(selected);
    patchFeaturedProduct({
      productId: mapped.productId,
      productName: mapped.productName,
      description: mapped.description,
      image: mapped.image,
      originalPrice: mapped.originalPrice,
      salePrice: mapped.salePrice,
      ctaText: data.ctaText || mapped.ctaText || 'Ver Producto',
      ctaLink: mapped.ctaLink
    });
  };

  return (
    <>
      <div className="settings-grid">
        <TextInput label="Label" value={data.label} onChange={(v) => onDataChange('label', v)} />
        <div className="form-group">
          <label>Seleccionar producto del catálogo</label>
          <select
            value={data.productId ?? ''}
            onChange={(e) => handleSelectFeaturedProduct(e.target.value)}
            className="form-control"
            disabled={productsLoading}
          >
            <option value="">{productsLoading ? 'Cargando productos...' : 'Seleccionar producto...'}</option>
            {availableProducts.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </div>
        <TextInput label="Nombre del producto" value={data.productName} onChange={(v) => onDataChange('productName', v)} />
        <TextArea label="Descripción" value={data.description} onChange={(v) => onDataChange('description', v)} />
        <ImageInput
          label="Imagen"
          value={data.image}
          onChange={(v) => onDataChange('image', v)}
          onUpload={(file) => onImageUpload && onImageUpload('image', file)}
          isUploading={isImageUploading ? isImageUploading('image') : false}
        />
        <TextInput label="Precio original" value={data.originalPrice} type="number" onChange={(v) => onDataChange('originalPrice', v)} />
        <TextInput label="Precio de venta" value={data.salePrice} type="number" onChange={(v) => onDataChange('salePrice', v)} />
        <TextInput label="Badge" value={data.badgeText} onChange={(v) => onDataChange('badgeText', v)} />
        <TextInput label="Texto CTA" value={data.ctaText} onChange={(v) => onDataChange('ctaText', v)} />
        <TextInput label="Enlace CTA" value={data.ctaLink} onChange={(v) => onDataChange('ctaLink', v)} />
      </div>
    <h4 style={{ marginTop: 16 }}>Especificaciones ({(data.specs || []).length})</h4>
    {(data.specs || []).map((spec, i) => (
      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: 8, background: '#f8f9fa', borderRadius: 6 }}>
        <input type="text" value={spec.key || ''} onChange={(e) => onArrayChange('specs', i, 'key', e.target.value)}
          style={{ flex: 1 }} placeholder="Propiedad" className="form-control" />
        <input type="text" value={spec.value || ''} onChange={(e) => onArrayChange('specs', i, 'value', e.target.value)}
          style={{ flex: 1 }} placeholder="Valor" className="form-control" />
        <button type="button" onClick={() => {
          const next = [...(data.specs || [])];
          next.splice(i, 1);
          onDataChange('specs', next);
        }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button>
      </div>
    ))}
    <button type="button" onClick={() => onDataChange('specs', [...(data.specs || []), { key: '', value: '' }])}
      style={{ marginTop: 4, padding: '4px 12px', fontSize: '0.85rem', cursor: 'pointer' }}>+ Agregar especificación</button>
    </>
  );
};

/** Editor para How It Works */
const HowItWorksEditor = ({ data, onDataChange, onArrayChange }) => (
  <>
    <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
    <h4 style={{ marginTop: 16 }}>Pasos ({(data.steps || []).length})</h4>
    {(data.steps || []).map((step, i) => (
      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: 8, background: '#f8f9fa', borderRadius: 6 }}>
        <input type="text" value={step.number || ''} onChange={(e) => onArrayChange('steps', i, 'number', e.target.value)}
          style={{ width: 40, textAlign: 'center' }} placeholder="#" className="form-control" />
        <input type="text" value={step.title || ''} onChange={(e) => onArrayChange('steps', i, 'title', e.target.value)}
          style={{ flex: 1 }} placeholder="Título" className="form-control" />
        <input type="text" value={step.description || ''} onChange={(e) => onArrayChange('steps', i, 'description', e.target.value)}
          style={{ flex: 2 }} placeholder="Descripción" className="form-control" />
        <button type="button" onClick={() => {
          const next = [...(data.steps || [])];
          next.splice(i, 1);
          onDataChange('steps', next);
        }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button>
      </div>
    ))}
    <button type="button" onClick={() => onDataChange('steps', [...(data.steps || []), { number: String((data.steps || []).length + 1), title: '', description: '' }])}
      style={{ marginTop: 4, padding: '4px 12px', fontSize: '0.85rem', cursor: 'pointer' }}>+ Agregar paso</button>
  </>
);

/** Editor para Product Showcase */
const ProductShowcaseEditor = ({ data, onDataChange, availableProducts = [], productsLoading = false, onProductImageUpload, isImageUploading }) => {
  // Handler para actualizar un producto individual del showcase
  const updateProduct = (index, field, value) => {
    const next = [...(data.products || [])];
    next[index] = { ...next[index], [field]: value };
    onDataChange('products', next);
  };

  // Aplica varios cambios del producto en una sola actualización para evitar pisar estado en lote.
  const patchProduct = (index, patch) => {
    const next = [...(data.products || [])];
    next[index] = { ...next[index], ...patch };
    onDataChange('products', next);
  };

  // Handler para actualizar features de un producto
  const updateProductFeature = (prodIdx, featIdx, value) => {
    const next = [...(data.products || [])];
    const features = [...(next[prodIdx].features || [])];
    features[featIdx] = value;
    next[prodIdx] = { ...next[prodIdx], features };
    onDataChange('products', next);
  };

  const selectCatalogProduct = (index, productId) => {
    const selected = availableProducts.find((p) => String(p.id) === String(productId));
    if (!selected) {
      updateProduct(index, 'productId', null);
      return;
    }

    const mapped = mapCatalogProductToLanding(selected);
    patchProduct(index, {
      productId: mapped.productId,
      name: mapped.name,
      category: mapped.category,
      description: mapped.description,
      image: mapped.image,
      originalPrice: mapped.originalPrice,
      salePrice: mapped.salePrice,
      ctaText: mapped.ctaText,
      ctaLink: mapped.ctaLink,
      features: mapped.features
    });
  };

  return (
    <>
      <div className="settings-grid">
        <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
        <TextInput label="Subtítulo" value={data.subtitle} onChange={(v) => onDataChange('subtitle', v)} />
      </div>
      <h4 style={{ marginTop: 16 }}>Productos ({(data.products || []).length})</h4>
      {(data.products || []).map((product, i) => (
        <details key={i} style={{ marginBottom: 12, border: '1px solid #e9ecef', borderRadius: 8, padding: 12, background: '#fafafa' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem' }}>
            {product.name || `Producto ${i + 1}`}
            <button type="button" onClick={(e) => { e.preventDefault(); const next = [...(data.products || [])]; next.splice(i, 1); onDataChange('products', next); }}
              style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>🗑️</button>
          </summary>
          <div className="settings-grid" style={{ marginTop: 12 }}>
            <div className="form-group">
              <label>Seleccionar producto del catálogo</label>
              <select
                value={product.productId ?? ''}
                onChange={(e) => selectCatalogProduct(i, e.target.value)}
                className="form-control"
                disabled={productsLoading}
              >
                <option value="">{productsLoading ? 'Cargando productos...' : 'Seleccionar producto...'}</option>
                {availableProducts.map((catalogProduct) => (
                  <option key={catalogProduct.id} value={catalogProduct.id}>{catalogProduct.name}</option>
                ))}
              </select>
            </div>
            <TextInput label="Nombre" value={product.name} onChange={(v) => updateProduct(i, 'name', v)} />
            <TextInput label="Categoría" value={product.category} onChange={(v) => updateProduct(i, 'category', v)} />
            <TextArea label="Descripción" value={product.description} onChange={(v) => updateProduct(i, 'description', v)} rows={2} />
            <ImageInput
              label="Imagen"
              value={product.image}
              onChange={(v) => updateProduct(i, 'image', v)}
              onUpload={(file) => onProductImageUpload && onProductImageUpload(i, file)}
              isUploading={isImageUploading ? isImageUploading(`products.${i}.image`) : false}
            />
            <TextInput label="Precio original" value={product.originalPrice} type="number" onChange={(v) => updateProduct(i, 'originalPrice', v)} />
            <TextInput label="Precio de venta" value={product.salePrice} type="number" onChange={(v) => updateProduct(i, 'salePrice', v)} />
            <TextInput label="Badge" value={product.badgeText} onChange={(v) => updateProduct(i, 'badgeText', v)} />
            <TextInput label="Texto CTA" value={product.ctaText} onChange={(v) => updateProduct(i, 'ctaText', v)} />
            <TextInput label="Enlace CTA" value={product.ctaLink} onChange={(v) => updateProduct(i, 'ctaLink', v)} />
          </div>
          <h5 style={{ marginTop: 12 }}>Características</h5>
          {(product.features || []).map((feat, j) => (
            <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <input type="text" value={feat || ''} onChange={(e) => updateProductFeature(i, j, e.target.value)}
                style={{ flex: 1 }} placeholder="Característica" className="form-control" />
              <button type="button" onClick={() => { const feats = [...(product.features || [])]; feats.splice(j, 1); updateProduct(i, 'features', feats); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
            </div>
          ))}
          <button type="button" onClick={() => updateProduct(i, 'features', [...(product.features || []), ''])}
            style={{ marginTop: 4, padding: '2px 8px', fontSize: '0.8rem', cursor: 'pointer' }}>+ Característica</button>
        </details>
      ))}
      <button type="button" onClick={() => onDataChange('products', [...(data.products || []), {
        name: '', description: '', category: '', image: '', features: [],
        originalPrice: 0, salePrice: 0, badgeText: '', badgeColor: '#ff6b35', ctaText: 'Ver Producto', ctaLink: '/'
      }])} style={{ marginTop: 4, padding: '4px 12px', fontSize: '0.85rem', cursor: 'pointer' }}>+ Agregar producto</button>
    </>
  );
};

/** Editor para Testimonials */
const TestimonialsEditor = ({ data, onDataChange, onArrayChange }) => (
  <>
    <div className="settings-grid">
      <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
      <TextInput label="Subtítulo" value={data.subtitle} onChange={(v) => onDataChange('subtitle', v)} />
    </div>
    <h4 style={{ marginTop: 16 }}>Testimonios ({(data.items || []).length})</h4>
    {(data.items || []).map((item, i) => (
      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, padding: 8, background: '#f8f9fa', borderRadius: 6, flexWrap: 'wrap' }}>
        <textarea value={item.quote || ''} onChange={(e) => onArrayChange('items', i, 'quote', e.target.value)}
          style={{ flex: '2 1 200px', minHeight: 50 }} placeholder="Cita..." className="form-control" />
        <input type="text" value={item.author || ''} onChange={(e) => onArrayChange('items', i, 'author', e.target.value)}
          style={{ flex: '1 1 120px' }} placeholder="Autor" className="form-control" />
        <input type="number" value={item.rating ?? 5} min={1} max={5} onChange={(e) => onArrayChange('items', i, 'rating', Number(e.target.value))}
          style={{ width: 60 }} className="form-control" />
        <button type="button" onClick={() => {
          const next = [...(data.items || [])];
          next.splice(i, 1);
          onDataChange('items', next);
        }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>🗑️</button>
      </div>
    ))}
    <button type="button" onClick={() => onDataChange('items', [...(data.items || []), { quote: '', author: '', avatar: '', rating: 5 }])}
      style={{ marginTop: 4, padding: '4px 12px', fontSize: '0.85rem', cursor: 'pointer' }}>+ Agregar testimonio</button>
  </>
);

/** Editor para Lead Capture */
const LeadCaptureEditor = ({ data, onDataChange }) => (
  <div className="settings-grid">
    <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
    <TextArea label="Descripción" value={data.description} onChange={(v) => onDataChange('description', v)} />
    <TextArea label="Texto About" value={data.aboutText} onChange={(v) => onDataChange('aboutText', v)} />
    <TextInput label="Texto del botón" value={data.submitText} onChange={(v) => onDataChange('submitText', v)} />
    <TextInput label="Mensaje de éxito" value={data.successMessage} onChange={(v) => onDataChange('successMessage', v)} />
  </div>
);

/** Editor para Final CTA */
const FinalCtaEditor = ({ data, onDataChange }) => (
  <div className="settings-grid">
    <TextInput label="Título" value={data.title} onChange={(v) => onDataChange('title', v)} />
    <TextInput label="Subtítulo" value={data.subtitle} onChange={(v) => onDataChange('subtitle', v)} />
    <TextInput label="Texto CTA" value={data.ctaText} onChange={(v) => onDataChange('ctaText', v)} />
    <TextInput label="Enlace CTA" value={data.ctaLink} onChange={(v) => onDataChange('ctaLink', v)} />
  </div>
);

/** Mapa de editores por tipo de sección */
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

/* ═══════════════ COMPONENTE PRINCIPAL ═══════════════ */

function LandingPageAdmin({ settings, setSettings }) {
  const [openSections, setOpenSections] = useState({});
  const [availableProducts, setAvailableProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [imageUploadingKey, setImageUploadingKey] = useState('');

  // Extraer y clonar la configuración actual de la landing page
  const config = settings.landingPageConfig || cloneLandingPageConfig(null);

  // Cargar productos disponibles para poder seleccionarlos en la landing
  useEffect(() => {
    let mounted = true;

    const fetchAvailableProducts = async () => {
      setProductsLoading(true);
      try {
        let page = 1;
        let totalPages = 1;
        const allProducts = [];

        do {
          const res = await apiFetch(apiUrl(`/products?page=${page}&limit=100`));
          if (!res.ok) break;

          const payload = await res.json();
          const pageData = Array.isArray(payload?.data)
            ? payload.data
            : (Array.isArray(payload) ? payload : []);

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
        console.error('Error cargando productos para landing:', err);
      } finally {
        if (mounted) setProductsLoading(false);
      }
    };

    fetchAvailableProducts();
    return () => { mounted = false; };
  }, []);

  // Handler genérico para actualizar la configuración completa
  const updateConfig = useCallback((updater) => {
    setSettings(prev => ({
      ...prev,
      landingPageConfig: typeof updater === 'function'
        ? updater(prev.landingPageConfig || cloneLandingPageConfig(null))
        : updater
    }));
  }, [setSettings]);

  // Toggle sección colapsable
  const toggleSection = (id) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Mover sección arriba o abajo
  const moveSection = (index, direction) => {
    updateConfig(prev => {
      const next = cloneLandingPageConfig(prev);
      const newIdx = index + direction;
      if (newIdx < 0 || newIdx >= next.sections.length) return next;
      // Swap de secciones
      [next.sections[index], next.sections[newIdx]] = [next.sections[newIdx], next.sections[index]];
      return next;
    });
  };

  // Toggle habilitado/deshabilitado de una sección
  const toggleSectionEnabled = (sectionId) => {
    updateConfig(prev => {
      const next = cloneLandingPageConfig(prev);
      const section = next.sections.find(s => s.id === sectionId);
      if (section) section.enabled = !section.enabled;
      return next;
    });
  };

  // Actualizar campo de data de una sección
  const updateSectionData = (sectionId, field, value) => {
    updateConfig(prev => updateNestedField(prev, sectionId, `data.${field}`, value));
  };

  // Actualizar campo de styles de una sección
  const updateSectionStyle = (sectionId, field, value) => {
    updateConfig(prev => updateNestedField(prev, sectionId, `styles.${field}`, value));
  };

  // Actualizar un item dentro de un array de data (points, steps, specs, items)
  const updateSectionArrayItem = (sectionId, arrayField, index, field, value) => {
    updateConfig(prev => {
      const next = cloneLandingPageConfig(prev);
      const section = next.sections.find(s => s.id === sectionId);
      if (!section || !Array.isArray(section.data[arrayField])) return next;
      section.data[arrayField][index] = { ...section.data[arrayField][index], [field]: value };
      return next;
    });
  };

  const uploadImageToSettingsStorage = useCallback(async (file) => {
    const formData = new FormData();
    formData.append('image', file);

    const response = await apiFetch(apiUrl('/settings/upload'), {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Error al subir imagen');
    }

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
      console.error('Error subiendo imagen de landing:', err);
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
      console.error('Error subiendo imagen de landing:', err);
      toast.error('No se pudo subir la imagen', { id: uploadToast });
    } finally {
      setImageUploadingKey('');
    }
  }, [updateSectionArrayItem, uploadImageToSettingsStorage]);

  return (
    <div>
      {/* ── Control maestro ──────────────────────────── */}
      <section className="settings-section">
        <h3 className="section-header">🚀 Landing Page</h3>
        <p className="section-description">
          Configura una página de destino independiente en <code>{config.route || '/landing'}</code>. Cuando esté activada, los usuarios podrán acceder desde el enlace configurado.
        </p>

        {/* Toggle principal */}
        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <label className="toggle-switch">
            <input type="checkbox" checked={config.enabled || false}
              onChange={() => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), enabled: !prev.enabled }))} />
            <span className="toggle-slider"></span>
          </label>
          <span style={{ fontWeight: 600 }}>{config.enabled ? '✅ Activada' : '❌ Desactivada'}</span>
        </div>

        {/* Título y ruta */}
        <div className="settings-grid">
          <TextInput label="Título de la página" value={config.pageTitle}
            onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), pageTitle: v }))} />
          <TextInput label="Ruta URL" value={config.route}
            onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), route: v }))} placeholder="/landing" />
          <div className="form-group">
            <label>Plantilla visual</label>
            <select
              value={config.templateId || 'modern-minimal'}
              onChange={(e) => {
                const selectedTemplateId = e.target.value;
                updateConfig(prev => applyLandingTemplatePreset(prev, selectedTemplateId));
              }}
              className="form-control"
            >
              {LANDING_TEMPLATE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
            <small style={{ opacity: 0.75 }}>
              Al cambiar plantilla se aplican estilos base que luego puedes personalizar en esta misma configuración.
            </small>
          </div>
        </div>
      </section>

      {/* ── Estilos globales ─────────────────────────── */}
      <section className="settings-section collapsible">
        <button type="button" className="section-toggle" onClick={() => toggleSection('globalStyles')}>
          <span>🎨 Estilos Globales</span>
          <span className="toggle-indicator">{openSections.globalStyles ? '−' : '+'}</span>
        </button>
        {openSections.globalStyles && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            <ColorInput label="Color oscuro" value={config.globalStyles?.darkColor}
              onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, darkColor: v } }))} />
            <ColorInput label="Color claro" value={config.globalStyles?.lightColor}
              onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, lightColor: v } }))} />
            <ColorInput label="Color de acento" value={config.globalStyles?.accentColor}
              onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, accentColor: v } }))} />
            <ColorInput label="Color de texto" value={config.globalStyles?.textColor}
              onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, textColor: v } }))} />
            <ColorInput label="Color de títulos" value={config.globalStyles?.headingColor}
              onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, headingColor: v } }))} />
            <TextInput label="Ancho máximo (px)" value={config.globalStyles?.maxWidth} type="number"
              onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, maxWidth: v } }))} />
            <TextInput label="Padding sección (px)" value={config.globalStyles?.sectionPadding} type="number"
              onChange={(v) => updateConfig(prev => ({ ...cloneLandingPageConfig(prev), globalStyles: { ...prev.globalStyles, sectionPadding: v } }))} />
          </div>
        )}
      </section>

      {/* ── Secciones individuales ───────────────────── */}
      <h3 style={{ margin: '24px 0 12px', fontSize: '1.1rem' }}>Secciones ({config.sections?.length || 0})</h3>
      <p className="section-description" style={{ marginBottom: 16 }}>
        Usa las flechas ↑↓ para reordenar. Activa o desactiva cada sección individualmente.
      </p>

      {(config.sections || []).map((section, index) => {
        const SectionEditor = SECTION_EDITORS[section.type];
        const isOpen = openSections[section.id];
        return (
          <section key={section.id} className="settings-section collapsible" style={{ marginBottom: 8, opacity: section.enabled ? 1 : 0.6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Flechas de reordenamiento */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button type="button" disabled={index === 0}
                  onClick={() => moveSection(index, -1)}
                  style={{ background: 'none', border: '1px solid #ddd', borderRadius: 4, cursor: index === 0 ? 'default' : 'pointer', padding: '0 6px', fontSize: '0.8rem', opacity: index === 0 ? 0.3 : 1 }}>
                  ↑
                </button>
                <button type="button" disabled={index === (config.sections?.length || 0) - 1}
                  onClick={() => moveSection(index, 1)}
                  style={{ background: 'none', border: '1px solid #ddd', borderRadius: 4, cursor: index === (config.sections?.length || 0) - 1 ? 'default' : 'pointer', padding: '0 6px', fontSize: '0.8rem', opacity: index === (config.sections?.length || 0) - 1 ? 0.3 : 1 }}>
                  ↓
                </button>
              </div>

              {/* Toggle activar/desactivar sección */}
              <label className="toggle-switch" style={{ marginRight: 4 }}>
                <input type="checkbox" checked={section.enabled} onChange={() => toggleSectionEnabled(section.id)} />
                <span className="toggle-slider"></span>
              </label>

              {/* Botón expandir/colapsar */}
              <button type="button" className="section-toggle" onClick={() => toggleSection(section.id)} style={{ flex: 1 }}>
                <span>{SECTION_LABELS[section.type] || section.type}</span>
                <span className="toggle-indicator">{isOpen ? '−' : '+'}</span>
              </button>
            </div>

            {isOpen && SectionEditor && (
              <div style={{ marginTop: 16, paddingLeft: 48 }}>
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
                <StylesEditor
                  styles={section.styles}
                  onStyleChange={(field, value) => updateSectionStyle(section.id, field, value)}
                />
              </div>
            )}
          </section>
        );
      })}

      {/* ── Restablecer valores por defecto ──────────── */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e9ecef' }}>
        <button type="button" onClick={() => {
          if (window.confirm('¿Restablecer toda la configuración de la landing page a los valores por defecto?')) {
            updateConfig(cloneLandingPageConfig(null));
          }
        }} style={{ padding: '8px 16px', fontSize: '0.9rem', cursor: 'pointer', background: '#dc3545', color: '#fff', border: 'none', borderRadius: 6 }}>
          🔄 Restablecer valores por defecto
        </button>
      </div>
    </div>
  );
}

export default LandingPageAdmin;
