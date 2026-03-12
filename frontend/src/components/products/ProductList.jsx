import { useState, useMemo, Fragment, useCallback } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../common/LoadingSpinner';
import RichTextEditor from '../common/RichTextEditor';
import { stripHtml } from '../../utils/stripHtml';
import './ProductList.css';
import { formatCurrency } from '../../utils/formatCurrency';
import { resolveImageUrl } from '../../utils/resolveImageUrl';
import { DEFAULT_CATEGORY_FILTERS_CONFIG } from '../../config';
import { formatVariantLabel } from '../../utils/cartHelpers';
import {
	PRODUCT_UNIT_OPTIONS,
	normalizeUnitType,
	getUnitOption,
	formatStockWithUnit
} from '../../utils/productUnits';

function blankProduct() {
	return {
		name: '',
		description: '',
		price: '',
		category: '',
		stock: '',
		unitType: 'unidad',
		imageFiles: [],
	};
}

export default function ProductList({ products, onRefresh, isLoading, pagination, currencyCode, onForceRefresh, categoryFilterSettings }) {
	const [newProduct, setNewProduct] = useState(blankProduct());
	const [customCategory, setCustomCategory] = useState('');
	const [editingProduct, setEditingProduct] = useState(null);
	const [newImagesForEdit, setNewImagesForEdit] = useState([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [filters, setFilters] = useState({ search: '', category: 'all', visibility: 'all' });
	const [showAddForm, setShowAddForm] = useState(false);

	// ── Variant management state ─────────────────────────────────────────
	const [variantPanel, setVariantPanel] = useState(null); // product id with open variant panel
	const [variants, setVariants] = useState([]);
	const [attributeTypes, setAttributeTypes] = useState([]);
	const [isLoadingVariants, setIsLoadingVariants] = useState(false);
	const [editingVariant, setEditingVariant] = useState(null); // variant being edited inline
	// New variant form (blank template)
	const blankVariant = { sku: '', price: '', stock: '', image_url: '', imageFile: null, attributes: [{ type: '', value: '' }] };
	const [newVariant, setNewVariant] = useState(blankVariant);

	const confirmAction = (message) => {
		return new Promise((resolve) => {
			toast((t) => (
				<div className="modern-confirm-toast">
					<p>{message}</p>
					<div className="modern-confirm-buttons">
						<button 
							className="cancel-btn"
							onClick={() => {
								toast.dismiss(t.id);
								resolve(false);
							}}
						>
							Cancelar
						</button>
						<button 
							className="confirm-btn"
							onClick={() => {
								toast.dismiss(t.id);
								resolve(true);
							}}
						>
							Confirmar
						</button>
					</div>
				</div>
			), { 
				duration: Infinity,
				position: 'top-center',
				style: {
					minWidth: '350px',
					padding: '24px',
					borderRadius: '16px',
					background: '#fff',
					boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
					marginTop: '30vh',
					border: '1px solid #e5e7eb'
				}
			});
		});
	};

	const categories = useMemo(() => {
		const unique = new Set(
			products
				.map((item) => item.category?.trim())
				.filter((value) => value && value.length > 0)
		);
		return ['all', ...unique];
	}, [products]);

	const categoryOptions = useMemo(() => {
		// Merge categories from settings (admin-configured) with existing product categories
		const config = categoryFilterSettings?.useDefault === false
			? categoryFilterSettings
			: DEFAULT_CATEGORY_FILTERS_CONFIG;
		// Settings categories: use slug (matches product.category in DB), exclude 'todos'
		const settingsSlugs = (config.categories || [])
			.map((c) => c.slug || c.name)
			.filter((s) => s && s.toLowerCase() !== 'todos');
		// Existing product categories from DB
		const productCats = categories.filter((v) => v && v !== 'all');
		// Combine, deduplicate, sort
		const merged = new Set([...settingsSlugs, ...productCats]);
		return [...merged].sort((a, b) => a.localeCompare(b));
	}, [categories, categoryFilterSettings]);

	const filteredProducts = useMemo(() => {
		const searchTerm = filters.search.trim().toLowerCase();
		return products.filter((item) => {
			const matchesCategory = filters.category === 'all' || item.category === filters.category;
			const matchesSearch =
				searchTerm.length === 0 ||
				item.name.toLowerCase().includes(searchTerm) ||
				(item.description ?? '').toLowerCase().includes(searchTerm);
			const matchesVisibility = filters.visibility === 'all'
				|| (filters.visibility === 'visible' && !item.is_hidden)
				|| (filters.visibility === 'hidden' && item.is_hidden);
			return matchesCategory && matchesSearch && matchesVisibility;
		});
	}, [products, filters]);

	const handleFieldChange = (field, value) => {
		if (field === 'category') {
			setCustomCategory('');
		}
		setNewProduct((prev) => ({ ...prev, [field]: value }));
	};

	const handleCustomCategoryChange = (value) => {
		setCustomCategory(value);
		setNewProduct((prev) => ({ ...prev, category: '' }));
	};

	const handleImageChange = (event) => {
		const files = Array.from(event.target.files);
		setNewProduct((prev) => ({ ...prev, imageFiles: files }));
	};

	const resetForm = () => {
		setNewProduct(blankProduct());
		setCustomCategory('');
	};

	const handleCreate = async (event) => {
		event.preventDefault();
		const categoryValue = (customCategory || newProduct.category).trim();
		if (!categoryValue) {
			toast.error('Selecciona o ingresa una categoría.');
			return;
		}
		if (!newProduct.imageFiles || newProduct.imageFiles.length === 0) {
			toast.error('Selecciona al menos una imagen para el producto.');
			return;
		}

		const formData = new FormData();
		formData.append('name', newProduct.name.trim());
		formData.append('description', newProduct.description.trim());
		formData.append('price', newProduct.price);
		formData.append('category', categoryValue);
		formData.append('stock', newProduct.stock);
		formData.append('unitType', normalizeUnitType(newProduct.unitType));
		newProduct.imageFiles.forEach((file) => {
			formData.append('images', file);
		});

		try {
			setIsSubmitting(true);
			const response = await apiFetch(apiUrl('/products'), {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'No se pudo crear el producto.');
			}

			toast.success('Producto creado correctamente.');
			resetForm();
			await onRefresh();
		} catch (error) {
			toast.error(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const startEditing = (product) => {
		// Handle legacy products that have single image vs new products with images array
		let images = product.images || [];
		if (images.length === 0 && product.image) {
			// Convert legacy single image to images array format
			images = [{ id: 'legacy', image_path: product.image }];
		}

		setEditingProduct({
			id: product.id,
			name: product.name,
			description: product.description ?? '',
			price: product.price,
			category: product.category,
			stock: product.stock,
			unitType: normalizeUnitType(product.unit_type || product.unitType),
			isHidden: !!product.is_hidden,
			images: images,
		});
	};

	const handleEditField = (field, value) => {
		setEditingProduct((prev) => (prev ? { ...prev, [field]: value } : prev));
	};

	const handleDeleteImage = async (imageId) => {
		if (!editingProduct) return;

		try {
			const response = await apiFetch(apiUrl(`/products/${editingProduct.id}/images/${imageId}`), {
				method: 'DELETE',
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'Error eliminando imagen');
			}

			const data = await response.json();
			setEditingProduct((prev) => prev ? { ...prev, images: data.images } : null);
			toast.success('Imagen eliminada correctamente');
			await onRefresh();
		} catch (error) {
			toast.error(error.message);
		}
	};

	const handleAddImages = async () => {
		if (!editingProduct || newImagesForEdit.length === 0) return;

		const formData = new FormData();
		newImagesForEdit.forEach((file) => {
			formData.append('images', file);
		});

		try {
			const response = await apiFetch(apiUrl(`/products/${editingProduct.id}/images`), {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'Error agregando imágenes');
			}

			const data = await response.json();
			setEditingProduct((prev) => prev ? { ...prev, images: data } : null);
			setNewImagesForEdit([]);
			toast.success('Imágenes agregadas correctamente');
			await onRefresh();
		} catch (error) {
			toast.error(error.message);
		}
	};

	const handleUpdate = async (event) => {
		event.preventDefault();
		if (!editingProduct) {
			return;
		}

		try {
			setIsSubmitting(true);
			const response = await apiFetch(apiUrl(`/products/${editingProduct.id}`), {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					name: editingProduct.name,
					description: editingProduct.description,
					price: Number(editingProduct.price),
					category: editingProduct.category,
					stock: Number(editingProduct.stock),
					unitType: normalizeUnitType(editingProduct.unitType),
					isHidden: editingProduct.isHidden,
				}),
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'No se pudo actualizar el producto.');
			}

			toast.success('Producto actualizado correctamente.');
			setEditingProduct(null);
			await onRefresh();
		} catch (error) {
			toast.error(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (productId) => {
		const confirmed = await confirmAction('¿Eliminar este producto?');
		if (!confirmed) {
			return;
		}

		try {
			setIsSubmitting(true);
			const response = await apiFetch(apiUrl(`/products/${productId}`), {
				method: 'DELETE',
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'No se pudo eliminar el producto.');
			}

			toast.success('Producto eliminado.');
			if (editingProduct?.id === productId) {
				setEditingProduct(null);
			}
			await onRefresh();
		} catch (error) {
			toast.error(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const cancelEditing = () => {
		setEditingProduct(null);
		setNewImagesForEdit([]);
		setVariantPanel(null);
		setVariants([]);
		setEditingVariant(null);
	};

	// ── Variant CRUD helpers ──────────────────────────────────────────────
	const loadVariants = useCallback(async (productId) => {
		setIsLoadingVariants(true);
		try {
			const res = await apiFetch(apiUrl(`/products/${productId}/variants`));
			if (res.ok) {
				const data = await res.json();
				setVariants(data.variants || []);
				setAttributeTypes(data.attributeTypes || []);
			}
		} catch (err) {
			console.error('Error loading variants:', err);
		} finally {
			setIsLoadingVariants(false);
		}
	}, []);

	const toggleVariantPanel = async (productId) => {
		if (variantPanel === productId) {
			setVariantPanel(null);
			return;
		}
		setVariantPanel(productId);
		setEditingVariant(null);
		setNewVariant({ sku: '', price: '', stock: '', image_url: '', imageFile: null, attributes: [{ type: '', value: '' }] });
		await loadVariants(productId);
	};

	const handleCreateVariant = async (productId) => {
		// Validate attributes have values
		const validAttrs = newVariant.attributes.filter(a => a.type && a.value);
		if (validAttrs.length === 0) {
			toast.error('Agrega al menos un atributo (ej. Color, Talla).');
			return;
		}
		try {
			// Upload image file if selected
			let imageUrl = newVariant.image_url || undefined;
			if (newVariant.imageFile) {
				imageUrl = await uploadVariantImage(productId, newVariant.imageFile);
			}
			const res = await apiFetch(apiUrl(`/products/${productId}/variants`), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sku: newVariant.sku || undefined,
					price: newVariant.price !== '' ? Number(newVariant.price) : undefined,
					stock: Number(newVariant.stock) || 0,
					image_url: imageUrl,
					attributes: validAttrs
				})
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.message || 'Error creando variante');
			}
			toast.success('Variante creada');
			setNewVariant({ sku: '', price: '', stock: '', image_url: '', imageFile: null, attributes: [{ type: '', value: '' }] });
			await loadVariants(productId);
			await onRefresh();
		} catch (err) {
			toast.error(err.message);
		}
	};

	const handleUpdateVariant = async (productId, variantId) => {
		if (!editingVariant) return;
		const validAttrs = editingVariant.attributes.filter(a => a.type && a.value);
		try {
			// Upload new image file if selected
			let imageUrl = editingVariant.image_url || null;
			if (editingVariant.imageFile) {
				imageUrl = await uploadVariantImage(productId, editingVariant.imageFile);
			}
			const res = await apiFetch(apiUrl(`/products/${productId}/variants/${variantId}`), {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sku: editingVariant.sku || undefined,
					price: editingVariant.price !== '' && editingVariant.price != null ? Number(editingVariant.price) : null,
					stock: Number(editingVariant.stock) || 0,
					image_url: imageUrl,
					is_active: editingVariant.is_active,
					attributes: validAttrs.length > 0 ? validAttrs : undefined
				})
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.message || 'Error actualizando variante');
			}
			toast.success('Variante actualizada');
			setEditingVariant(null);
			await loadVariants(productId);
			await onRefresh();
		} catch (err) {
			toast.error(err.message);
		}
	};

	const handleDeleteVariant = async (productId, variantId) => {
		const confirmed = await confirmAction('¿Eliminar esta variante?');
		if (!confirmed) return;
		try {
			const res = await apiFetch(apiUrl(`/products/${productId}/variants/${variantId}`), {
				method: 'DELETE'
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.message || 'Error eliminando variante');
			}
			toast.success('Variante eliminada');
			await loadVariants(productId);
			await onRefresh();
		} catch (err) {
			toast.error(err.message);
		}
	};

	// Attribute row helpers for variant forms
	const updateAttrRow = (list, setList, idx, field, value) => {
		const updated = [...list];
		updated[idx] = { ...updated[idx], [field]: value };
		if (typeof setList === 'function') setList(updated);
		return updated;
	};
	const addAttrRow = (list) => [...list, { type: '', value: '', color_hex: '' }];
	const removeAttrRow = (list, idx) => list.length > 1 ? list.filter((_, i) => i !== idx) : list;
	// Check if an attribute type uses color swatch display
	const isColorType = (typeName) => attributeTypes.some(t => t.name === typeName && t.display_type === 'color_swatch');

	// Upload a single variant image and return the public URL
	const uploadVariantImage = async (productId, file) => {
		const formData = new FormData();
		formData.append('image', file);
		const res = await apiFetch(apiUrl(`/products/${productId}/variants/upload-image`), {
			method: 'POST',
			body: formData,
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.message || 'Error subiendo imagen de variante');
		}
		const data = await res.json();
		return data.image_url;
	};

	// Pre-fill new variant form with parent product data (convert parent to variant)
	const handleConvertParentToVariant = () => {
		if (!editingProduct) return;
		const firstImage = editingProduct.images?.[0];
		const imageUrl = firstImage ? resolveImageUrl(firstImage.image_path) : '';
		setNewVariant({
			sku: '',
			price: editingProduct.price ?? '',
			stock: editingProduct.stock ?? 0,
			image_url: imageUrl,
			imageFile: null,
			attributes: [{ type: '', value: '', color_hex: '' }],
		});
		toast.success('Datos del producto copiados. Asigna los atributos y crea la variante.');
	};

	// Reusable variant management section (used in both desktop + mobile edit forms)
	const renderVariantSection = (productId) => {
		const isOpen = variantPanel === productId;
		return (
			<div className="variant-section">
				<button
					type="button"
					className="variant-toggle-btn"
					onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleVariantPanel(productId); }}
				>
					<span>🧩 Variantes (colores, tallas...)</span>
					<span className="collapsible-icon">{isOpen ? '−' : '+'}</span>
				</button>

				{isOpen && (
					<div className="variant-panel" onClick={(e) => e.stopPropagation()}>
						{isLoadingVariants ? (
							<div className="variant-loading"><LoadingSpinner fullPage={false} /></div>
						) : (
							<>
								{/* Existing variants list */}
								{variants.length > 0 && (
									<div className="variant-list">
										<h4 className="variant-list-title">Variantes existentes ({variants.length})</h4>
										{variants.map((v) => {
											const isEditingThis = editingVariant?.id === v.id;
											return (
												<div key={v.id} className={`variant-row ${!v.is_active ? 'inactive' : ''}`}>
													{isEditingThis ? (
														/* Inline edit mode */
														<div className="variant-edit-inline">
															<div className="variant-edit-fields">
																<label>SKU
																	<input type="text" value={editingVariant.sku || ''} onChange={(e) => setEditingVariant(prev => ({ ...prev, sku: e.target.value }))} placeholder="SKU" />
																</label>
																<label>Precio (override)
																	<input type="number" step="0.01" value={editingVariant.price ?? ''} onChange={(e) => setEditingVariant(prev => ({ ...prev, price: e.target.value }))} placeholder="Precio base" />
																</label>
																<label>Stock
																	<input type="number" value={editingVariant.stock || 0} onChange={(e) => setEditingVariant(prev => ({ ...prev, stock: e.target.value }))} />
																</label>
																<label>Imagen
																	<input type="file" accept="image/*" onChange={(e) => {
																		const file = e.target.files[0] || null;
																		setEditingVariant(prev => ({ ...prev, imageFile: file }));
																	}} />
																	{/* Preview: new file or existing URL */}
																	{(editingVariant.imageFile || editingVariant.image_url) && (
																		<div className="variant-image-preview">
																			<img
																				src={editingVariant.imageFile ? URL.createObjectURL(editingVariant.imageFile) : editingVariant.image_url}
																				alt="Preview"
																				onError={(e) => { e.currentTarget.style.display = 'none'; }}
																			/>
																			<button type="button" className="variant-image-remove" onClick={() => setEditingVariant(prev => ({ ...prev, image_url: '', imageFile: null }))}>✕</button>
																		</div>
																	)}
																</label>
																<label className="variant-active-label">
																	<input type="checkbox" checked={editingVariant.is_active !== false} onChange={(e) => setEditingVariant(prev => ({ ...prev, is_active: e.target.checked }))} />
																	Activa
																</label>
															</div>
															<div className="variant-attrs-edit">
																<span className="variant-attrs-title">Atributos:</span>
																{editingVariant.attributes.map((attr, idx) => (
																	<div key={idx} className="variant-attr-row">
																		<select value={attr.type} onChange={(e) => {
																			const updated = [...editingVariant.attributes];
																			updated[idx] = { ...updated[idx], type: e.target.value };
																			setEditingVariant(prev => ({ ...prev, attributes: updated }));
																		}}>
																			<option value="">Tipo...</option>
																			{attributeTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
																		</select>
																		<input type="text" value={attr.value} placeholder="Valor" onChange={(e) => {
																			const updated = [...editingVariant.attributes];
																			updated[idx] = { ...updated[idx], value: e.target.value };
																			setEditingVariant(prev => ({ ...prev, attributes: updated }));
																		}} />
																		{/* Color picker — only for color_swatch attribute types */}
																		{isColorType(attr.type) && (
																			<input type="color" className="variant-color-picker" value={attr.color_hex || '#000000'} title="Color del botón" onChange={(e) => {
																				const updated = [...editingVariant.attributes];
																				updated[idx] = { ...updated[idx], color_hex: e.target.value };
																				setEditingVariant(prev => ({ ...prev, attributes: updated }));
																			}} />
																		)}
																		{editingVariant.attributes.length > 1 && (
																			<button type="button" className="variant-attr-remove" onClick={() => {
																				setEditingVariant(prev => ({ ...prev, attributes: removeAttrRow(prev.attributes, idx) }));
																			}}>✕</button>
																		)}
																	</div>
																))}
																<button type="button" className="variant-attr-add" onClick={() => {
																	setEditingVariant(prev => ({ ...prev, attributes: addAttrRow(prev.attributes) }));
																}}>+ Atributo</button>
															</div>
															<div className="variant-edit-actions">
																<button type="button" className="admin-btn" onClick={() => handleUpdateVariant(productId, v.id)}>Guardar</button>
																<button type="button" className="admin-btn ghost" onClick={() => setEditingVariant(null)}>Cancelar</button>
															</div>
														</div>
													) : (
														/* Read-only row */
														<>
															<div className="variant-row-info">
																<span className="variant-attrs-label">{formatVariantLabel(v.attributes.map(a => ({ attribute_value: a.value })))}</span>
																{v.sku && <span className="variant-sku">SKU: {v.sku}</span>}
																<span className="variant-price">
																	{v.price != null ? formatCurrency(v.price, currencyCode) : '—'}
																</span>
																<span className={`admin-stock ${v.stock > 0 ? 'in-stock' : 'out-stock'}`}>
																	Stock: {v.stock}
																</span>
																{!v.is_active && <span className="variant-inactive-badge">Inactiva</span>}
															</div>
															<div className="variant-row-actions">
																<button type="button" className="admin-btn ghost" onClick={() => setEditingVariant({ ...v, price: v.price ?? '' })}>✏️</button>
																<button type="button" className="admin-btn danger" onClick={() => handleDeleteVariant(productId, v.id)}>🗑️</button>
															</div>
														</>
													)}
												</div>
											);
										})}
									</div>
								)}

								{/* Add new variant form */}
								<div className="variant-add-form">
									<div className="variant-add-header">
										<h4 className="variant-list-title">Agregar variante</h4>
										{/* Quick button to pre-fill form with parent product data */}
										<button type="button" className="admin-btn ghost variant-convert-btn" onClick={handleConvertParentToVariant}>
											📋 Copiar datos del producto
										</button>
									</div>
									<div className="variant-edit-fields">
										<label>SKU
											<input type="text" value={newVariant.sku} onChange={(e) => setNewVariant(prev => ({ ...prev, sku: e.target.value }))} placeholder="Opcional" />
										</label>
										<label>Precio (override)
											<input type="number" step="0.01" value={newVariant.price} onChange={(e) => setNewVariant(prev => ({ ...prev, price: e.target.value }))} placeholder="Precio base" />
										</label>
										<label>Stock
											<input type="number" value={newVariant.stock} onChange={(e) => setNewVariant(prev => ({ ...prev, stock: e.target.value }))} />
										</label>
										<label>Imagen
											<input type="file" accept="image/*" onChange={(e) => {
												const file = e.target.files[0] || null;
												setNewVariant(prev => ({ ...prev, imageFile: file, image_url: '' }));
											}} />
											{/* Preview: new file or pre-filled URL (from parent conversion) */}
											{(newVariant.imageFile || newVariant.image_url) && (
												<div className="variant-image-preview">
													<img
														src={newVariant.imageFile ? URL.createObjectURL(newVariant.imageFile) : newVariant.image_url}
														alt="Preview"
														onError={(e) => { e.currentTarget.style.display = 'none'; }}
													/>
													<button type="button" className="variant-image-remove" onClick={() => setNewVariant(prev => ({ ...prev, imageFile: null, image_url: '' }))}>✕</button>
												</div>
											)}
										</label>
									</div>
									<div className="variant-attrs-edit">
										<span className="variant-attrs-title">Atributos:</span>
										{newVariant.attributes.map((attr, idx) => (
											<div key={idx} className="variant-attr-row">
												<select value={attr.type} onChange={(e) => {
													const updated = updateAttrRow(newVariant.attributes, null, idx, 'type', e.target.value);
													setNewVariant(prev => ({ ...prev, attributes: updated }));
												}}>
													<option value="">Tipo...</option>
													{attributeTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
												</select>
												<input type="text" value={attr.value} placeholder="Valor (ej. Rojo, M)" onChange={(e) => {
													const updated = updateAttrRow(newVariant.attributes, null, idx, 'value', e.target.value);
													setNewVariant(prev => ({ ...prev, attributes: updated }));
												}} />
												{/* Color picker — only for color_swatch attribute types */}
												{isColorType(attr.type) && (
													<input type="color" className="variant-color-picker" value={attr.color_hex || '#000000'} title="Color del botón" onChange={(e) => {
														const updated = updateAttrRow(newVariant.attributes, null, idx, 'color_hex', e.target.value);
														setNewVariant(prev => ({ ...prev, attributes: updated }));
													}} />
												)}
												{newVariant.attributes.length > 1 && (
													<button type="button" className="variant-attr-remove" onClick={() => {
														setNewVariant(prev => ({ ...prev, attributes: removeAttrRow(prev.attributes, idx) }));
													}}>✕</button>
												)}
											</div>
										))}
										<button type="button" className="variant-attr-add" onClick={() => {
											setNewVariant(prev => ({ ...prev, attributes: addAttrRow(prev.attributes) }));
										}}>+ Atributo</button>
									</div>
									<button type="button" className="admin-btn" onClick={() => handleCreateVariant(productId)}>
										Crear Variante
									</button>
								</div>
							</>
						)}
					</div>
				)}
			</div>
		);
	};


	return (
		<>
			<section className="admin-section">
				<button
					type="button"
					className="collapsible-header"
					onClick={() => setShowAddForm((prev) => !prev)}
					aria-expanded={showAddForm}
				>
					<span>Agregar producto</span>
					<span className="collapsible-icon">{showAddForm ? '−' : '+'}</span>
				</button>
				{showAddForm && (
					<form className="admin-form" onSubmit={handleCreate}>
						<div className="form-row">
							<label>Nombre
								<input
									type="text"
									value={newProduct.name}
									onChange={(event) => handleFieldChange('name', event.target.value)}
									required
								/>
							</label>
							<label>Categoría
								<select
									value={newProduct.category}
									onChange={(event) => handleFieldChange('category', event.target.value)}
									required={!customCategory}
								>
									<option value="">Selecciona una categoría</option>
									{categoryOptions.map((option) => (
										<option key={option} value={option}>
											{option}
										</option>
									))}
								</select>
							</label>
							<label>Nueva categoría (opcional)
								<input
									type="text"
									value={customCategory}
									onChange={(event) => handleCustomCategoryChange(event.target.value)}
									placeholder="Escribe para crear una nueva categoría"
								/>
							</label>
						</div>
						<div className="form-row">
							<label>Precio
								<input
									type="number"
									step="0.01"
									className="compact-input"
									value={newProduct.price}
									onChange={(event) => handleFieldChange('price', event.target.value)}
									required
								/>
							</label>
							<label>Stock
								<input
									type="number"
									className="compact-input"
									value={newProduct.stock}
									onChange={(event) => handleFieldChange('stock', event.target.value)}
									required
								/>
							</label>
							<label>Tipo de variante
								<select
									value={newProduct.unitType}
									onChange={(event) => handleFieldChange('unitType', normalizeUnitType(event.target.value))}
								>
									{PRODUCT_UNIT_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>{option.label}</option>
									))}
								</select>
							</label>
						</div>
						<label>Descripción
							<RichTextEditor
								value={newProduct.description}
								onChange={(html) => handleFieldChange('description', html)}
								placeholder="Descripcion del producto..."
								minHeight={140}
							/>
						</label>
						<label>Imágenes
							<input type="file" accept="image/*" multiple onChange={handleImageChange} />
						</label>
						<button type="submit" className="admin-submit" disabled={isSubmitting}>
							{isSubmitting ? 'Guardando...' : 'Crear producto'}
						</button>
					</form>
				)}
			</section>

			<section className="admin-section">
				<div className="admin-section-header">
					<h3>Listado actual</h3>
					<span>
						{filteredProducts.length} / {products.length} productos
						{onForceRefresh && (
							<button
								type="button"
								className="admin-btn ghost refresh-btn"
								onClick={() => onForceRefresh()}
								disabled={isLoading}
								title="Actualizar datos"
							>
								🔄
							</button>
						)}
					</span>
				</div>

				<div className="admin-filter-bar">
					<div className="filter-field">
						<label htmlFor="admin-search">Buscar</label>
						<input
							id="admin-search"
							type="search"
							placeholder="Buscar por nombre o descripción"
							value={filters.search}
							onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
						/>
					</div>
					<div className="filter-field">
						<label htmlFor="admin-category">Categoría</label>
						<select
							id="admin-category"
							value={filters.category}
							onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
						>
							{categories.map((category) => (
								<option key={category} value={category}>
									{category === 'all' ? 'Todas las categorías' : category}
								</option>
							))}
						</select>
					</div>
					<div className="filter-field">
						<label htmlFor="admin-visibility">Visibilidad</label>
						<select
							id="admin-visibility"
							value={filters.visibility}
							onChange={(event) => setFilters((prev) => ({ ...prev, visibility: event.target.value }))}
						>
							<option value="all">Todos</option>
							<option value="visible">Visibles</option>
							<option value="hidden">Ocultos</option>
						</select>
					</div>
				</div>

				{isLoading ? (
					<div className="admin-empty"><LoadingSpinner /></div>
				) : filteredProducts.length === 0 ? (
					<div className="admin-empty">No hay productos que coincidan con el filtro actual.</div>
				) : (
					<div className="admin-list-wrapper">
						<div className="admin-table-container desktop-only">
							<table className="admin-table">
							<thead>
								<tr>
									<th>Imagen</th>
									<th>Nombre</th>
									<th>Categoría</th>
									<th>Descripción</th>
									<th>Precio</th>
									<th>Stock</th>
									<th>Variante</th>
									<th>Acciones</th>
								</tr>
							</thead>
							<tbody>
								{filteredProducts.map((product) => {
									const isEditing = editingProduct?.id === product.id;
									const handleRowClick = () => {
										if (!isEditing) startEditing(product);
									};
									return (
										<Fragment key={product.id}>
											<tr className={`${isEditing ? 'editing-row' : ''} admin-table-row-clickable`} onClick={handleRowClick}>
												<td className="admin-table-image" data-label="Imagen">
													{(product.images || []).length > 0 ? (
														<div className="image-gallery">
															<img
																src={resolveImageUrl(product.images[0].image_path)}
																alt={product.name}
																onError={(event) => {
																	event.currentTarget.src = '/images/placeholder.svg';
																}}
															/>
															{(product.images || []).length > 1 && (
																<span className="image-count">+{(product.images || []).length - 1}</span>
															)}
														</div>
													) : (
														<img
															src={resolveImageUrl(product.image)}
															alt={product.name}
														/>
													)}
												</td>
												<td className="admin-table-name" data-label="Nombre">
													{product.name}
													{product.has_variants && <span className="variant-badge" title="Tiene variantes">🧩</span>}
													{product.is_hidden && <span className="hidden-badge" title="Oculto en la tienda">👁️‍🗨️</span>}
												</td>
												<td data-label="Categoría">
													<span className="admin-chip">{product.category}</span>
												</td>
												<td className="admin-table-description" data-label="Descripción">
														{stripHtml(product.description) || 'Sin descripción'}
												</td>
												<td className="admin-table-price" data-label="Precio">{formatCurrency(product.price, currencyCode)}</td>
												<td data-label="Stock">
													<span className={`admin-stock ${product.stock > 0 ? 'in-stock' : 'out-stock'}`}>
														{formatStockWithUnit(product.stock, product.unit_type)}
													</span>
												</td>
												<td data-label="Variante">
													<span className="admin-chip">{getUnitOption(product.unit_type)?.label || 'Unidad (ud)'}</span>
												</td>
												<td className="admin-table-actions" data-label="Acciones">
													<span className="admin-chip">Tap para editar</span>
												</td>
											</tr>
											{isEditing && (
												<tr key={`${product.id}-edit`} className="edit-form-row">
													<td colSpan="8">
														<form className="admin-edit-form" onSubmit={handleUpdate}>
															<div className="edit-form-content">
																<div className="form-row">
																	<label>
																		Nombre
																		<input
																			type="text"
																			value={editingProduct.name}
																			onChange={(event) => handleEditField('name', event.target.value)}
																			required
																		/>
																	</label>
																	<label>
																		Categoría
																		<select
																			value={categoryOptions.includes(editingProduct.category) ? editingProduct.category : '__custom__'}
																			onChange={(event) => {
																				if (event.target.value !== '__custom__') handleEditField('category', event.target.value);
																			}}
																			required={!editingProduct.category}
																		>
																			<option value="">Selecciona una categoría</option>
																			{categoryOptions.map((option) => (
																				<option key={option} value={option}>{option}</option>
																			))}
																			{editingProduct.category && !categoryOptions.includes(editingProduct.category) && (
																				<option value="__custom__">{editingProduct.category} (personalizada)</option>
																			)}
																		</select>
																	</label>
																</div>
																<div className="form-row">
																	<label>
																		Precio
																		<input
																			type="number"
																			step="0.01"
																			className="compact-input"
																			value={editingProduct.price}
																			onChange={(event) => handleEditField('price', event.target.value)}
																			max={99999}
																			inputMode="decimal"
																			required
																		/>
																	</label>
																	<label>
																		Stock
																		<input
																			type="number"
																			className="compact-input"
																			value={editingProduct.stock}
																			onChange={(event) => handleEditField('stock', event.target.value)}
																			max={99999}
																			inputMode="numeric"
																			required
																		/>
																	</label>
																	<label>
																		Tipo de variante
																		<select
																			value={editingProduct.unitType}
																			onChange={(event) => handleEditField('unitType', normalizeUnitType(event.target.value))}
																		>
																			{PRODUCT_UNIT_OPTIONS.map((option) => (
																				<option key={option.value} value={option.value}>{option.label}</option>
																			))}
																		</select>
																	</label>
																</div>
																<div className="images-section">
																	<label>Imágenes actuales</label>
																	<div className="current-images">
																		{(editingProduct.images || []).map((img) => (
																			<div key={img.id} className="image-item">
																				<img
																					src={resolveImageUrl(img.image_path)}
																					alt="Producto"
																					onError={(event) => {
																						event.currentTarget.src = '/images/placeholder.svg';
																					}}
																				/>
																				{img.id !== 'legacy' && (
																					<button
																						type="button"
																						className="delete-image-btn"
																						onClick={() => handleDeleteImage(img.id)}
																					>
																						✕
																					</button>
																				)}
																			</div>
																		))}
																	</div>
																	<label>Agregar nuevas imágenes</label>
																	<input
																		type="file"
																		accept="image/*"
																		multiple
																		onChange={(event) => setNewImagesForEdit(Array.from(event.target.files))}
																	/>
																	{newImagesForEdit.length > 0 && (
																		<button
																			type="button"
																			className="admin-btn"
																			onClick={handleAddImages}
																		>
																			Agregar {newImagesForEdit.length} imagen(es)
																		</button>
																	)}
																</div>
																{/* Variant manager */}
																{renderVariantSection(editingProduct.id)}
																<label>
																	Descripción
																	<RichTextEditor
																		value={editingProduct.description}
																		onChange={(html) => handleEditField('description', html)}
																		placeholder="Descripcion del producto..."
																		minHeight={140}
																	/>
																</label>
																<div className="admin-card-actions">
																	<button
																		type="button"
																		className="admin-btn danger"
																		onClick={(event) => {
																			event.stopPropagation();
																			handleDelete(editingProduct.id);
																		}}
																	>
																		Eliminar
																	</button>
																	<button
																		type="button"
																		className="admin-btn hide-toggle-btn"
																		onClick={(event) => {
																			event.stopPropagation();
																			handleEditField('isHidden', !editingProduct.isHidden);
																		}}
																	>
																		{editingProduct.isHidden ? 'Mostrar' : 'Ocultar'}
																	</button>
																	<div className="admin-actions-right">
																		<button type="button" onClick={cancelEditing} className="admin-btn ghost">
																			Cancelar
																		</button>
																		<button type="submit" className="admin-btn" disabled={isSubmitting}>
																			{isSubmitting ? 'Guardando...' : 'Guardar'}
																		</button>
																	</div>
																</div>
															</div>
														</form>
													</td>
												</tr>
											)}
										</Fragment>
									);
								})}
							</tbody>
						</table>
						</div>

						{/* Mobile list view */}
						<div className="mobile-only">
							{filteredProducts.map((product) => {
								const isEditing = editingProduct?.id === product.id;
								const isExpanded = isEditing;
							const mainImage = (() => {
								const firstImage = (product.images || [])[0];
								if (firstImage?.image_path) return resolveImageUrl(firstImage.image_path);
								if (product.image) return resolveImageUrl(product.image);
								return '/images/placeholder.svg';
							})();

								return (
									<div
										key={product.id}
										className={`mobile-product-card ${isExpanded ? 'expanded' : ''}`}
										onClick={() => { if (!isEditing) startEditing(product); }}
										role="button"
										tabIndex={0}
									>
										<div className="mobile-product-header">
											<div className="mobile-product-main">
												<img src={mainImage} alt={product.name} onError={(event) => { event.currentTarget.src = '/images/placeholder.svg'; }} />
												<div className="mobile-product-info">
													<div className="mobile-product-title">
														{product.name}
														{product.has_variants && <span className="variant-badge" title="Tiene variantes">🧩</span>}
														{product.is_hidden && <span className="hidden-badge" title="Oculto en la tienda">👁️‍🗨️</span>}
													</div>
													<div className="mobile-product-subtitle">
														<span className="mobile-product-category">{product.category}</span>
														<span className={`mobile-product-stock ${product.stock > 0 ? 'in-stock' : 'out-stock'}`}>
																		Stock: {formatStockWithUnit(product.stock, product.unit_type)}
														</span>
																	<span className="mobile-product-category">{getUnitOption(product.unit_type)?.label || 'Unidad (ud)'}</span>
													</div>
												</div>
											</div>
											<span className="mobile-product-price">{formatCurrency(product.price, currencyCode)}</span>
										</div>

									{isEditing && (
										<form className="admin-edit-form mobile-edit-form" onSubmit={handleUpdate}>
											<div className="edit-form-content">
												<div className="form-row">
													<label>
														Nombre
														<input
															type="text"
															value={editingProduct.name}
															onChange={(event) => handleEditField('name', event.target.value)}
															required
														/>
													</label>
													<label>
														Categoría
														<select
															value={categoryOptions.includes(editingProduct.category) ? editingProduct.category : '__custom__'}
															onChange={(event) => {
																if (event.target.value !== '__custom__') handleEditField('category', event.target.value);
															}}
															required={!editingProduct.category}
														>
															<option value="">Selecciona una categoría</option>
															{categoryOptions.map((option) => (
																<option key={option} value={option}>{option}</option>
															))}
															{editingProduct.category && !categoryOptions.includes(editingProduct.category) && (
																<option value="__custom__">{editingProduct.category} (personalizada)</option>
															)}
														</select>
													</label>
												</div>
												<div className="form-row">
													<label>
														Precio
														<input
															type="number"
															step="0.01"
															className="compact-input"
															value={editingProduct.price}
															onChange={(event) => handleEditField('price', event.target.value)}
															max={99999}
															inputMode="decimal"
															required
														/>
													</label>
													<label>
														Stock
														<input
															type="number"
															className="compact-input"
															value={editingProduct.stock}
															onChange={(event) => handleEditField('stock', event.target.value)}
															max={99999}
															inputMode="numeric"
															required
														/>
													</label>
													<label>
														Tipo de variante
														<select
															value={editingProduct.unitType}
															onChange={(event) => handleEditField('unitType', normalizeUnitType(event.target.value))}
														>
															{PRODUCT_UNIT_OPTIONS.map((option) => (
																<option key={option.value} value={option.value}>{option.label}</option>
															))}
														</select>
													</label>
												</div>
												<div className="images-section">
													<label>Imágenes actuales</label>
													<div className="current-images">
														{(editingProduct.images || []).map((img) => (
															<div key={img.id} className="image-item">
																<img
																	src={resolveImageUrl(img.image_path)}
																	alt="Producto"
																	onError={(event) => {
																		event.currentTarget.src = '/images/placeholder.svg';
																	}}
																/>
																{img.id !== 'legacy' && (
																	<button
																		type="button"
																		className="delete-image-btn"
																		onClick={() => handleDeleteImage(img.id)}
																	>
																		✕
																	</button>
																)}
															</div>
														))}
													</div>
													<label>Agregar nuevas imágenes</label>
													<input
														type="file"
														accept="image/*"
														multiple
														onChange={(event) => setNewImagesForEdit(Array.from(event.target.files))}
													/>
													{newImagesForEdit.length > 0 && (
														<button
															type="button"
															className="admin-btn"
															onClick={handleAddImages}
														>
															Agregar {newImagesForEdit.length} imagen(es)
														</button>
													)}
												</div>
												{/* Variant manager */}
												{renderVariantSection(editingProduct.id)}
												<label>
													Descripción
													<RichTextEditor
														value={editingProduct.description}
														onChange={(html) => handleEditField('description', html)}
														placeholder="Descripcion del producto..."
														minHeight={140}
													/>
												</label>
												<div className="admin-card-actions">
													<button
														type="button"
														className="admin-btn danger"
														onClick={(event) => {
															event.stopPropagation();
															handleDelete(editingProduct.id);
														}}
													>
														Eliminar
													</button>
													<button
														type="button"
														className="admin-btn hide-toggle-btn"
														onClick={(event) => {
															event.stopPropagation();
															handleEditField('isHidden', !editingProduct.isHidden);
														}}
													>
														{editingProduct.isHidden ? '👁️ Mostrar' : '🙈 Ocultar'}
													</button>
													<div className="admin-actions-right">
														<button type="button" onClick={cancelEditing} className="admin-btn ghost">
															Cancelar
														</button>
														<button type="submit" className="admin-btn" disabled={isSubmitting}>
															{isSubmitting ? 'Guardando...' : 'Guardar'}
														</button>
													</div>
												</div>
											</div>
										</form>
									)}
								</div>
							);
							})}
						</div>
					</div>
				)}

				{pagination && (
					<div className="pagination-controls">
						<button 
							className="admin-btn ghost"
							disabled={pagination.page === 1}
							onClick={() => onRefresh(filters.category, pagination.page - 1)}
						>
							&laquo; Anterior
						</button>
						<span>Página {pagination.page} de {pagination.totalPages}</span>
						<button 
							className="admin-btn ghost"
							disabled={pagination.page === pagination.totalPages}
							onClick={() => onRefresh(filters.category, pagination.page + 1)}
						>
							Siguiente &raquo;
						</button>
					</div>
				)}
			</section>
		</>
	);
}