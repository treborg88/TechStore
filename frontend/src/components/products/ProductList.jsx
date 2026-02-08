import { useState, useMemo, useEffect, Fragment } from 'react';
import { BASE_URL } from '../../config';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../common/LoadingSpinner';
import './ProductList.css';
import { formatCurrency } from '../../utils/formatCurrency';

function blankProduct() {
	return {
		name: '',
		description: '',
		price: '',
		category: '',
		stock: '',
		imageFiles: [],
	};
}

export default function ProductList({ products, onRefresh, isLoading, pagination, currencyCode, onForceRefresh }) {
	const [newProduct, setNewProduct] = useState(blankProduct());
	const [customCategory, setCustomCategory] = useState('');
	const [editingProduct, setEditingProduct] = useState(null);
	const [newImagesForEdit, setNewImagesForEdit] = useState([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [filters, setFilters] = useState({ search: '', category: 'all' });
	const [showAddForm, setShowAddForm] = useState(false);

	const handleAutoResize = (event) => {
		const target = event.currentTarget;
		if (!(target instanceof HTMLTextAreaElement)) return;
		target.style.height = 'auto';
		target.style.height = `${target.scrollHeight}px`;
	};

	useEffect(() => {
		requestAnimationFrame(() => {
			document.querySelectorAll('.auto-resize').forEach((el) => {
				if (el instanceof HTMLTextAreaElement) {
					el.style.height = 'auto';
					el.style.height = `${el.scrollHeight}px`;
				}
			});
		});
	}, [editingProduct, showAddForm]);

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
		const usable = categories.filter((value) => value && value !== 'all');
		return [...usable].sort((a, b) => a.localeCompare(b));
	}, [categories]);

	const filteredProducts = useMemo(() => {
		const searchTerm = filters.search.trim().toLowerCase();
		return products.filter((item) => {
			const matchesCategory = filters.category === 'all' || item.category === filters.category;
			const matchesSearch =
				searchTerm.length === 0 ||
				item.name.toLowerCase().includes(searchTerm) ||
				(item.description ?? '').toLowerCase().includes(searchTerm);
			return matchesCategory && matchesSearch;
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

	const handleUpdate = async () => {
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
						</div>
						<label>Descripción
							<textarea
								rows="3"
								className="auto-resize"
								value={newProduct.description}
								onChange={(event) => handleFieldChange('description', event.target.value)}
								onInput={handleAutoResize}
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
								onClick={onForceRefresh}
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
																src={product.images[0].image_path ? (
																	product.images[0].image_path.startsWith('http') 
																		? product.images[0].image_path 
																		: (product.images[0].image_path.startsWith('/images/') 
																			? `${BASE_URL}${product.images[0].image_path}` 
																			: `${BASE_URL}/images/${product.images[0].image_path}`)
																) : '/images/sin imagen.jpeg'}
																alt={product.name}
																onError={(event) => {
																	event.currentTarget.src = '/images/sin imagen.jpeg';
																}}
															/>
															{(product.images || []).length > 1 && (
																<span className="image-count">+{(product.images || []).length - 1}</span>
															)}
														</div>
													) : (
														<img
															src={product.image ? (
																product.image.startsWith('http') 
																	? product.image 
																	: (product.image.startsWith('/images/') 
																		? `${BASE_URL}${product.image}` 
																		: `${BASE_URL}/images/${product.image}`)
															) : '/images/sin imagen.jpeg'}
															alt={product.name}
														/>
													)}
												</td>
												<td className="admin-table-name" data-label="Nombre">{product.name}</td>
												<td data-label="Categoría">
													<span className="admin-chip">{product.category}</span>
												</td>
												<td className="admin-table-description" data-label="Descripción">
													{product.description || 'Sin descripción'}
												</td>
												<td className="admin-table-price" data-label="Precio">{formatCurrency(product.price, currencyCode)}</td>
												<td data-label="Stock">
													<span className={`admin-stock ${product.stock > 0 ? 'in-stock' : 'out-stock'}`}>
														{product.stock}
													</span>
												</td>
												<td className="admin-table-actions" data-label="Acciones">
													<span className="admin-chip">Tap para editar</span>
												</td>
											</tr>
											{isEditing && (
												<tr key={`${product.id}-edit`} className="edit-form-row">
													<td colSpan="7">
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
																		<input
																			type="text"
																			value={editingProduct.category}
																			onChange={(event) => handleEditField('category', event.target.value)}
																			required
																		/>
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
																</div>
																<div className="images-section">
																	<label>Imágenes actuales</label>
																	<div className="current-images">
																		{(editingProduct.images || []).map((img) => (
																			<div key={img.id} className="image-item">
																				<img
																					src={img.image_path.startsWith('http') ? img.image_path : `${BASE_URL}${img.image_path}`}
																					alt="Producto"
																					onError={(event) => {
																						event.currentTarget.src = '/images/sin imagen.jpeg';
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
																<label>
																	Descripción
																	<textarea
																		rows="3"
																		className="auto-resize"
																		value={editingProduct.description}
																		onChange={(event) => handleEditField('description', event.target.value)}
																		onInput={handleAutoResize}
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
								if (firstImage?.image_path) {
									if (firstImage.image_path.startsWith('http')) return firstImage.image_path;
									if (firstImage.image_path.startsWith('/images/')) return `${BASE_URL}${firstImage.image_path}`;
									return `${BASE_URL}/images/${firstImage.image_path}`;
								}
								if (product.image) {
									if (product.image.startsWith('http')) return product.image;
									if (product.image.startsWith('/images/')) return `${BASE_URL}${product.image}`;
									return `${BASE_URL}/images/${product.image}`;
								}
								return '/images/sin imagen.jpeg';
							})();

								return (
									<div
										key={product.id}
										className={`mobile-product-card ${isExpanded ? 'expanded' : ''}`}
										onClick={() => startEditing(product)}
										role="button"
										tabIndex={0}
									>
										<div className="mobile-product-header">
											<div className="mobile-product-main">
												<img src={mainImage} alt={product.name} onError={(event) => { event.currentTarget.src = '/images/sin imagen.jpeg'; }} />
												<div className="mobile-product-info">
													<div className="mobile-product-title">{product.name}</div>
													<div className="mobile-product-subtitle">
														<span className="mobile-product-category">{product.category}</span>
														<span className={`mobile-product-stock ${product.stock > 0 ? 'in-stock' : 'out-stock'}`}>
															Stock: {product.stock}
														</span>
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
														<input
															type="text"
															value={editingProduct.category}
															onChange={(event) => handleEditField('category', event.target.value)}
															required
														/>
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
												</div>
												<div className="images-section">
													<label>Imágenes actuales</label>
													<div className="current-images">
														{(editingProduct.images || []).map((img) => (
															<div key={img.id} className="image-item">
																<img
																	src={img.image_path.startsWith('http') ? img.image_path : `${BASE_URL}${img.image_path}`}
																	alt="Producto"
																	onError={(event) => {
																		event.currentTarget.src = '/images/sin imagen.jpeg';
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
												<label>
													Descripción
													<textarea
														rows="3"
														className="auto-resize"
														value={editingProduct.description}
														onChange={(event) => handleEditField('description', event.target.value)}
														onInput={handleAutoResize}
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