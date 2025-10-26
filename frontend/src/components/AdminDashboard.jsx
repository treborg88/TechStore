import { useMemo, useState, useEffect } from 'react';
import { API_URL, BASE_URL } from '../config';

function blankProduct() {
	return {
		name: '',
		description: '',
		price: '',
		category: '',
		stock: '',
		imageFile: null,
	};
}

export default function AdminDashboard({ products, onRefresh, isLoading }) {
	const [newProduct, setNewProduct] = useState(blankProduct());
	const [customCategory, setCustomCategory] = useState('');
	const [editingProduct, setEditingProduct] = useState(null);
	const [message, setMessage] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [filters, setFilters] = useState({ search: '', category: 'all' });
	const [showAddForm, setShowAddForm] = useState(false);
	
	// User management states
	const [users, setUsers] = useState([]);
	const [isLoadingUsers, setIsLoadingUsers] = useState(false);
	const [userFilters, setUserFilters] = useState({ search: '', role: 'all', status: 'all' });
	const [activeTab, setActiveTab] = useState('products'); // 'products', 'users', 'orders'
	
	// Orders management states
	const [orders, setOrders] = useState([]);
	const [isLoadingOrders, setIsLoadingOrders] = useState(false);
	const [orderFilters, setOrderFilters] = useState({ search: '', status: 'all' });
	const [selectedOrder, setSelectedOrder] = useState(null);

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

	const filteredUsers = useMemo(() => {
		const searchTerm = userFilters.search.trim().toLowerCase();
		return users.filter((user) => {
			const matchesRole = userFilters.role === 'all' || user.role === userFilters.role;
			const matchesStatus = userFilters.status === 'all' || 
				(userFilters.status === 'active' ? user.is_active : !user.is_active);
			const matchesSearch =
				searchTerm.length === 0 ||
				user.name.toLowerCase().includes(searchTerm) ||
				user.email.toLowerCase().includes(searchTerm);
			return matchesRole && matchesStatus && matchesSearch;
		});
	}, [users, userFilters]);

	const filteredOrders = useMemo(() => {
		const searchTerm = orderFilters.search.trim().toLowerCase();
		return orders.filter((order) => {
			const matchesStatus = orderFilters.status === 'all' || order.status === orderFilters.status;
			const matchesSearch =
				searchTerm.length === 0 ||
				order.id.toString().includes(searchTerm) ||
				order.customer_name.toLowerCase().includes(searchTerm) ||
				order.customer_email.toLowerCase().includes(searchTerm);
			return matchesStatus && matchesSearch;
		});
	}, [orders, orderFilters]);

	// Load users on component mount
	useEffect(() => {
		if (activeTab === 'users') {
			loadUsers();
		} else if (activeTab === 'orders') {
			loadOrders();
		}
	}, [activeTab]);

	const loadUsers = async () => {
		try {
			setIsLoadingUsers(true);
			setMessage(''); // Limpiar mensajes anteriores
			const token = localStorage.getItem('authToken');
			
			if (!token) {
				throw new Error('No hay token de autenticación. Por favor, inicia sesión nuevamente.');
			}

			console.log('Cargando usuarios con token:', token.substring(0, 20) + '...');
			const response = await fetch(`${API_URL}/users`, {
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				}
			});

			console.log('Respuesta del servidor:', response.status, response.statusText);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				if (response.status === 403) {
					throw new Error('Acceso denegado. Solo los administradores pueden ver esta sección. Por favor, cierra sesión y vuelve a iniciar sesión.');
				}
				throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			console.log('Usuarios cargados:', data.length);
			setUsers(data);
		} catch (error) {
			console.error('Error cargando usuarios:', error);
			setMessage(error.message);
		} finally {
			setIsLoadingUsers(false);
		}
	};

	const handleRoleChange = async (userId, newRole) => {
		if (!window.confirm(`¿Cambiar el rol de este usuario a "${newRole}"?`)) {
			return;
		}

		try {
			setIsSubmitting(true);
			const token = localStorage.getItem('authToken');
			const response = await fetch(`${API_URL}/users/${userId}/role`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ role: newRole })
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'Error al actualizar el rol');
			}

			setMessage('Rol actualizado correctamente');
			await loadUsers();
		} catch (error) {
			setMessage(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleStatusToggle = async (userId, currentStatus) => {
		const newStatus = !currentStatus;
		const action = newStatus ? 'activar' : 'desactivar';

		if (!window.confirm(`¿Deseas ${action} este usuario?`)) {
			return;
		}

		try {
			setIsSubmitting(true);
			const token = localStorage.getItem('authToken');
			const response = await fetch(`${API_URL}/users/${userId}/status`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ is_active: newStatus })
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'Error al actualizar el estado');
			}

			setMessage(`Usuario ${action} correctamente`);
			await loadUsers();
		} catch (error) {
			setMessage(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const loadOrders = async () => {
		try {
			setIsLoadingOrders(true);
			setMessage('');
			const token = localStorage.getItem('authToken');
			
			if (!token) {
				throw new Error('No hay token de autenticación');
			}

			const response = await fetch(`${API_URL}/orders`, {
				headers: {
					'Authorization': `Bearer ${token}`,
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Error al cargar órdenes');
			}

			const data = await response.json();
			setOrders(data);
		} catch (error) {
			console.error('Error cargando órdenes:', error);
			setMessage(error.message);
		} finally {
			setIsLoadingOrders(false);
		}
	};

	const handleOrderStatusChange = async (orderId, newStatus) => {
		if (!window.confirm(`¿Cambiar el estado de la orden a "${newStatus}"?`)) {
			return;
		}

		try {
			setIsSubmitting(true);
			const token = localStorage.getItem('authToken');
			const response = await fetch(`${API_URL}/orders/${orderId}/status`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${token}`
				},
				body: JSON.stringify({ status: newStatus })
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'Error al actualizar el estado');
			}

			setMessage('Estado de orden actualizado correctamente');
			await loadOrders();
		} catch (error) {
			setMessage(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const viewOrderDetails = async (orderId) => {
		try {
			const token = localStorage.getItem('authToken');
			const response = await fetch(`${API_URL}/orders/${orderId}`, {
				headers: {
					'Authorization': `Bearer ${token}`
				}
			});

			if (!response.ok) {
				throw new Error('Error al cargar detalles de la orden');
			}

			const data = await response.json();
			
			// Extraer teléfono de la dirección si existe
			let phone = 'N/A';
			let cleanAddress = data.shipping_address;
			
			if (data.shipping_address) {
				// Buscar patrón "Tel: " o "Teléfono: "
				const phoneMatch = data.shipping_address.match(/Tel(?:éfono)?:\s*([^\n.]+)/i);
				if (phoneMatch) {
					phone = phoneMatch[1].trim();
					// Limpiar el teléfono de la dirección
					cleanAddress = data.shipping_address.replace(/\.\s*Tel(?:éfono)?:[^\n.]+/gi, '').trim();
				}
			}
			
			setSelectedOrder({
				...data,
				phone: phone,
				clean_address: cleanAddress
			});
		} catch (error) {
			setMessage(error.message);
		}
	};

	const closeOrderDetails = () => {
		setSelectedOrder(null);
	};

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
		const file = event.target.files?.[0] ?? null;
		setNewProduct((prev) => ({ ...prev, imageFile: file }));
	};

	const resetForm = () => {
		setNewProduct(blankProduct());
		setCustomCategory('');
	};

	const handleCreate = async (event) => {
		event.preventDefault();
		const categoryValue = (customCategory || newProduct.category).trim();
		if (!categoryValue) {
			setMessage('Selecciona o ingresa una categoría.');
			return;
		}
		if (!newProduct.imageFile) {
			setMessage('Selecciona una imagen para el producto.');
			return;
		}

		const formData = new FormData();
		formData.append('name', newProduct.name.trim());
		formData.append('description', newProduct.description.trim());
		formData.append('price', newProduct.price);
		formData.append('category', categoryValue);
		formData.append('stock', newProduct.stock);
		formData.append('image', newProduct.imageFile);

		try {
			setIsSubmitting(true);
			const response = await fetch(`${API_URL}/products`, {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'No se pudo crear el producto.');
			}

			setMessage('Producto creado correctamente.');
			resetForm();
			await onRefresh();
		} catch (error) {
			setMessage(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const startEditing = (product) => {
		setEditingProduct({
			id: product.id,
			name: product.name,
			description: product.description ?? '',
			price: product.price,
			category: product.category,
			stock: product.stock,
		});
	};

	const handleEditField = (field, value) => {
		setEditingProduct((prev) => (prev ? { ...prev, [field]: value } : prev));
	};

	const cancelEditing = () => {
		setEditingProduct(null);
	};

	const handleUpdate = async (event) => {
		event.preventDefault();
		if (!editingProduct) {
			return;
		}

		try {
			setIsSubmitting(true);
			const response = await fetch(`${API_URL}/products/${editingProduct.id}`, {
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

			setMessage('Producto actualizado correctamente.');
			setEditingProduct(null);
			await onRefresh();
		} catch (error) {
			setMessage(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDelete = async (productId) => {
		if (!window.confirm('¿Eliminar este producto?')) {
			return;
		}

		try {
			setIsSubmitting(true);
			const response = await fetch(`${API_URL}/products/${productId}`, {
				method: 'DELETE',
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'No se pudo eliminar el producto.');
			}

			setMessage('Producto eliminado.');
			if (editingProduct?.id === productId) {
				setEditingProduct(null);
			}
			await onRefresh();
		} catch (error) {
			setMessage(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="admin-dashboard">
			{message && (
				<div className="admin-header">
					<div className="admin-message">{message}</div>
				</div>
			)}

			{/* Tabs Navigation */}
			<div className="admin-tabs">
				<button
					type="button"
					className={`admin-tab ${activeTab === 'products' ? 'active' : ''}`}
					onClick={() => setActiveTab('products')}
				>
					📦 Productos
				</button>
				<button
					type="button"
					className={`admin-tab ${activeTab === 'orders' ? 'active' : ''}`}
					onClick={() => setActiveTab('orders')}
				>
					📋 Órdenes
				</button>
				<button
					type="button"
					className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
					onClick={() => setActiveTab('users')}
				>
					👥 Administrar Accesos
				</button>
			</div>

			{/* Products Tab */}
			{activeTab === 'products' && (
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
										value={newProduct.description}
										onChange={(event) => handleFieldChange('description', event.target.value)}
									/>
								</label>
								<label>Imagen
									<input type="file" accept="image/*" onChange={handleImageChange} />
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
					</span>
				</div>

				<div className="admin-filter-bar">
					<div className="filter-field">
						<label htmlFor="admin-search">Buscar</label>
						<input
							id="admin-search"
							type="search"
							placeholder="Nombre o descripción"
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
					<div className="admin-empty">Cargando productos...</div>
				) : filteredProducts.length === 0 ? (
					<div className="admin-empty">No hay productos que coincidan con el filtro actual.</div>
				) : (
					<div className="admin-table-container">
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
									return (
										<>
											<tr key={product.id} className={isEditing ? 'editing-row' : ''}>
												<td className="admin-table-image">
													<img
														src={product.image ? `${BASE_URL}${product.image}` : '/images/sin imagen.jpeg'}
														alt={product.name}
														onError={(event) => {
															event.currentTarget.src = '/images/sin imagen.jpeg';
														}}
													/>
												</td>
												<td className="admin-table-name">{product.name}</td>
												<td>
													<span className="admin-chip">{product.category}</span>
												</td>
												<td className="admin-table-description">
													{product.description || 'Sin descripción'}
												</td>
												<td className="admin-table-price">${product.price}</td>
												<td>
													<span className={`admin-stock ${product.stock > 0 ? 'in-stock' : 'out-stock'}`}>
														{product.stock}
													</span>
												</td>
												<td className="admin-table-actions">
													<button
														type="button"
														className="admin-btn ghost"
														onClick={() => startEditing(product)}
													>
														Editar
													</button>
													<button
														type="button"
														className="admin-btn danger"
														onClick={() => handleDelete(product.id)}
													>
														Eliminar
													</button>
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
																<label>
																	Descripción
																	<textarea
																		rows="3"
																		value={editingProduct.description}
																		onChange={(event) => handleEditField('description', event.target.value)}
																	/>
																</label>
																<div className="form-row">
																	<label>
																		Precio
																		<input
																			type="number"
																			step="0.01"
																			className="compact-input"
																			value={editingProduct.price}
																			onChange={(event) => handleEditField('price', event.target.value)}
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
																			required
																		/>
																	</label>
																</div>
																<div className="admin-card-actions">
																	<button type="button" onClick={cancelEditing} className="admin-btn ghost">
																		Cancelar
																	</button>
																	<button type="submit" className="admin-btn" disabled={isSubmitting}>
																		{isSubmitting ? 'Guardando...' : 'Guardar'}
																	</button>
																</div>
															</div>
														</form>
													</td>
												</tr>
											)}
										</>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>
				</>
			)}

			{/* Orders Tab */}
			{activeTab === 'orders' && (
				<section className="admin-section">
					<div className="admin-section-header">
						<h3>Gestión de Órdenes</h3>
						<span>
							{filteredOrders.length} / {orders.length} órdenes
						</span>
					</div>

					<div className="admin-filter-bar">
						<div className="filter-field">
							<label htmlFor="order-search">Buscar</label>
							<input
								id="order-search"
								type="search"
								placeholder="ID, cliente o email"
								value={orderFilters.search}
								onChange={(event) => setOrderFilters((prev) => ({ ...prev, search: event.target.value }))}
							/>
						</div>
						<div className="filter-field">
							<label htmlFor="order-status">Estado</label>
							<select
								id="order-status"
								value={orderFilters.status}
								onChange={(event) => setOrderFilters((prev) => ({ ...prev, status: event.target.value }))}
							>
								<option value="all">Todos los estados</option>
								<option value="pending">Pendiente</option>
								<option value="processing">Procesando</option>
								<option value="shipped">Enviado</option>
								<option value="delivered">Entregado</option>
								<option value="cancelled">Cancelado</option>
							</select>
						</div>
					</div>

					{isLoadingOrders ? (
						<div className="admin-empty">Cargando órdenes...</div>
					) : filteredOrders.length === 0 ? (
						<div className="admin-empty">No hay órdenes que coincidan con el filtro actual.</div>
					) : (
						<div className="admin-table-container">
							<table className="admin-table">
								<thead>
									<tr>
										<th>ID</th>
										<th>Cliente</th>
										<th>Email</th>
										<th>Total</th>
										<th>Pago</th>
										<th>Estado</th>
										<th>Fecha</th>
										<th>Acciones</th>
									</tr>
								</thead>
								<tbody>
									{filteredOrders.map((order) => (
										<tr key={order.id}>
											<td>#{order.id}</td>
											<td className="admin-table-name">{order.customer_name}</td>
											<td>{order.customer_email}</td>
											<td className="admin-table-price">${order.total.toFixed(2)}</td>
											<td>
												<span className={`admin-chip payment-${order.payment_method || 'cash'}`}>
													{(order.payment_method === 'cash' || !order.payment_method) && '💵 Efectivo'}
													{order.payment_method === 'transfer' && '🏦 Transferencia'}
													{order.payment_method === 'online' && '💳 Online'}
													{order.payment_method === 'card' && '💳 Tarjeta'}
												</span>
											</td>
											<td>
												<span className={`admin-chip status-${order.status}`}>
													{order.status === 'pending' && '⏳ Pendiente'}
													{order.status === 'processing' && '⚙️ Procesando'}
													{order.status === 'shipped' && '🚚 Enviado'}
													{order.status === 'delivered' && '✅ Entregado'}
													{order.status === 'cancelled' && '❌ Cancelado'}
												</span>
											</td>
											<td>{new Date(order.created_at).toLocaleString()}</td>
											<td className="admin-table-actions">
												<button
													type="button"
													className="admin-btn ghost"
													onClick={() => viewOrderDetails(order.id)}
												>
													Ver
												</button>
												<select
													value={order.status}
													onChange={(e) => handleOrderStatusChange(order.id, e.target.value)}
													className="admin-role-select"
													disabled={isSubmitting}
												>
													<option value="pending">Pendiente</option>
													<option value="processing">Procesando</option>
													<option value="shipped">Enviado</option>
													<option value="delivered">Entregado</option>
													<option value="cancelled">Cancelado</option>
												</select>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}

					{/* Order Details Modal */}
					{selectedOrder && (
						<div className="order-modal-overlay" onClick={closeOrderDetails}>
							<div className="order-modal" onClick={(e) => e.stopPropagation()}>
								<div className="order-modal-header">
									<h3>Detalles de Orden #{selectedOrder.id}</h3>
									<button className="close-modal" onClick={closeOrderDetails}>✕</button>
								</div>
								<div className="order-modal-body">
									<div className="order-info">
										<p><strong>Cliente:</strong> {selectedOrder.customer_name || 'N/A'}</p>
										<p><strong>Email:</strong> {selectedOrder.customer_email || 'N/A'}</p>
										<p><strong>Teléfono:</strong> {selectedOrder.phone || 'N/A'}</p>
										<p><strong>Estado:</strong> {selectedOrder.status}</p>
										<p><strong>Total:</strong> ${selectedOrder.total.toFixed(2)}</p>
										<p>
											<strong>Método de Pago:</strong>{' '}
											<span className={`admin-chip payment-${selectedOrder.payment_method || 'cash'}`}>
												{(selectedOrder.payment_method === 'cash' || !selectedOrder.payment_method) && '💵 Pago Contra Entrega'}
												{selectedOrder.payment_method === 'transfer' && '🏦 Transferencia Bancaria'}
												{selectedOrder.payment_method === 'online' && '💳 Pago en Línea'}
												{selectedOrder.payment_method === 'card' && '💳 Tarjeta de Crédito/Débito'}
											</span>
										</p>
										<p><strong>Fecha:</strong> {new Date(selectedOrder.created_at).toLocaleString()}</p>
										<p><strong>Dirección de envío:</strong> {selectedOrder.clean_address || selectedOrder.shipping_address}</p>
									</div>
									<h4>Productos</h4>
									<div className="order-items">
										{selectedOrder.items && selectedOrder.items.map((item) => (
											<div key={item.id} className="order-item">
												<img src={`${BASE_URL}${item.image}`} alt={item.name} />
												<div className="order-item-info">
													<p className="order-item-name">{item.name}</p>
													<p className="order-item-details">
														Cantidad: {item.quantity} × ${item.price.toFixed(2)}
													</p>
												</div>
												<p className="order-item-total">
													${(item.quantity * item.price).toFixed(2)}
												</p>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					)}
				</section>
			)}

			{/* Users Tab */}
			{activeTab === 'users' && (
				<section className="admin-section">
					<div className="admin-section-header">
						<h3>Gestión de Usuarios y Accesos</h3>
						<span>
							{filteredUsers.length} / {users.length} usuarios
						</span>
					</div>

					{message && message.includes('Acceso denegado') && (
						<div className="admin-help-box">
							<h4>⚠️ Acceso Restringido</h4>
							<p>{message}</p>
							<p><strong>Nota:</strong> Si acabas de ser promovido a administrador, necesitas cerrar sesión y volver a iniciar sesión para que los cambios surtan efecto.</p>
						</div>
					)}

					<div className="admin-filter-bar">
						<div className="filter-field">
							<label htmlFor="user-search">Buscar</label>
							<input
								id="user-search"
								type="search"
								placeholder="Nombre o email"
								value={userFilters.search}
								onChange={(event) => setUserFilters((prev) => ({ ...prev, search: event.target.value }))}
							/>
						</div>
						<div className="filter-field">
							<label htmlFor="user-role">Rol</label>
							<select
								id="user-role"
								value={userFilters.role}
								onChange={(event) => setUserFilters((prev) => ({ ...prev, role: event.target.value }))}
							>
								<option value="all">Todos los roles</option>
								<option value="admin">Administradores</option>
								<option value="customer">Clientes</option>
							</select>
						</div>
						<div className="filter-field">
							<label htmlFor="user-status">Estado</label>
							<select
								id="user-status"
								value={userFilters.status}
								onChange={(event) => setUserFilters((prev) => ({ ...prev, status: event.target.value }))}
							>
								<option value="all">Todos</option>
								<option value="active">Activos</option>
								<option value="inactive">Inactivos</option>
							</select>
						</div>
					</div>

					{isLoadingUsers ? (
						<div className="admin-empty">Cargando usuarios...</div>
					) : filteredUsers.length === 0 ? (
						<div className="admin-empty">No hay usuarios que coincidan con el filtro actual.</div>
					) : (
						<div className="admin-table-container">
							<table className="admin-table">
								<thead>
									<tr>
										<th>ID</th>
										<th>Nombre</th>
										<th>Email</th>
										<th>Rol</th>
										<th>Estado</th>
										<th>Registro</th>
										<th>Último Acceso</th>
										<th>Acciones</th>
									</tr>
								</thead>
								<tbody>
									{filteredUsers.map((user) => (
										<tr key={user.id}>
											<td>{user.id}</td>
											<td className="admin-table-name">{user.name}</td>
											<td>{user.email}</td>
											<td>
												<span className={`admin-chip ${user.role === 'admin' ? 'role-admin' : 'role-customer'}`}>
													{user.role === 'admin' ? '👑 Admin' : '👤 Cliente'}
												</span>
											</td>
											<td>
												<span className={`admin-stock ${user.is_active ? 'in-stock' : 'out-stock'}`}>
													{user.is_active ? '✓ Activo' : '✗ Inactivo'}
												</span>
											</td>
											<td>{new Date(user.created_at).toLocaleDateString()}</td>
											<td>
												{user.last_login 
													? new Date(user.last_login).toLocaleString()
													: 'Nunca'
												}
											</td>
											<td className="admin-table-actions">
												<select
													value={user.role}
													onChange={(e) => handleRoleChange(user.id, e.target.value)}
													className="admin-role-select"
													disabled={isSubmitting}
												>
													<option value="customer">Cliente</option>
													<option value="admin">Admin</option>
												</select>
												<button
													type="button"
													className={`admin-btn ${user.is_active ? 'danger' : 'ghost'}`}
													onClick={() => handleStatusToggle(user.id, user.is_active)}
													disabled={isSubmitting}
												>
													{user.is_active ? 'Desactivar' : 'Activar'}
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>
			)}
		</div>
	);
}
