import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { apiFetch, apiUrl } from '../../services/apiClient';
import LoadingSpinner from '../common/LoadingSpinner';
import Invoice from '../common/Invoice';
import { formatCurrency } from '../../utils/formatCurrency';

const ONLINE_ORDER_STEPS = [
	{ id: 'all', label: 'Todos', icon: '📋' },
	{ id: 'pending_payment', label: 'Pendiente Pago', icon: '⏳' },
	{ id: 'paid', label: 'Pagado', icon: '💰' },
	{ id: 'to_ship', label: 'Para Enviar', icon: '📦' },
	{ id: 'shipped', label: 'Enviado', icon: '🚚' },
	{ id: 'delivered', label: 'Entregado', icon: '✅' },
	{ id: 'return', label: 'Devolución', icon: '↩️' },
	{ id: 'refund', label: 'Reembolso', icon: '💸' },
	{ id: 'cancelled', label: 'Cancelado', icon: '❌' }
];

const COD_ORDER_STEPS = [
	{ id: 'all', label: 'Todos', icon: '📋' },
	{ id: 'to_ship', label: 'Para Enviar', icon: '📦' },
	{ id: 'shipped', label: 'Enviado', icon: '🚚' },
	{ id: 'delivered', label: 'Entregado', icon: '✅' },
	{ id: 'paid', label: 'Pagado', icon: '💰' },
	{ id: 'return', label: 'Devolución', icon: '↩️' },
	{ id: 'refund', label: 'Reembolso', icon: '💸' },
	{ id: 'cancelled', label: 'Cancelado', icon: '❌' }
];

export default function OrderList({ 
    orders, 
    isLoading, 
    onRefresh, 
    focusOrderId, 
    onClearFocusOrderId,
    filters,
    onFilterChange,
    pagination,
	onPageChange,
	currencyCode
}) {
	// const [orderFilters, setOrderFilters] = useState({ search: '', status: 'all', type: 'all', paymentType: 'all' }); // Moved to parent
    const orderFilters = filters || { search: '', status: 'all', type: 'all', paymentType: 'all' };
    const setOrderFilters = onFilterChange || (() => {});

	const [siteName] = useState(localStorage.getItem('siteName') || 'TechStore');
	const [siteIcon] = useState(localStorage.getItem('siteIcon') || '🛍️');
	
	const [selectedOrder, setSelectedOrder] = useState(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	
	// Tracking Modal State
	const [showTrackingModal, setShowTrackingModal] = useState(false);
	const [trackingData, setTrackingData] = useState({ orderId: null, carrier: '', trackingNumber: '' });

	// Internal Notes State
	const [internalNotes, setInternalNotes] = useState('');

	// Bulk Actions State
	const [selectedOrderIds, setSelectedOrderIds] = useState([]);

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

	const handleSelectOrder = (orderId) => {
		setSelectedOrderIds(prev => {
			if (prev.includes(orderId)) {
				return prev.filter(id => id !== orderId);
			} else {
				return [...prev, orderId];
			}
		});
	};

	const handleSelectAll = (ordersToList) => {
		const allIds = ordersToList.map(o => o.id);
		const allSelected = allIds.every(id => selectedOrderIds.includes(id));

		if (allSelected) {
			setSelectedOrderIds(prev => prev.filter(id => !allIds.includes(id)));
		} else {
			const newIds = allIds.filter(id => !selectedOrderIds.includes(id));
			setSelectedOrderIds(prev => [...prev, ...newIds]);
		}
	};

	const handleBulkStatusChange = async (newStatus) => {
		if (selectedOrderIds.length === 0) return;
		
		const confirmed = await confirmAction(`¿Estás seguro de cambiar el estado de ${selectedOrderIds.length} órdenes a "${newStatus}"?`);
		if (!confirmed) {
			return;
		}

		setIsSubmitting(true);
		let successCount = 0;
		let errorCount = 0;

		try {
			// Execute in parallel
			await Promise.all(selectedOrderIds.map(async (orderId) => {
				try {
					const response = await apiFetch(apiUrl(`/orders/${orderId}`), {
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ status: newStatus })
					});

					if (response.ok) {
						successCount++;
					} else {
						errorCount++;
					}
				} catch {
					errorCount++;
				}
			}));

			if (successCount > 0) {
				toast.success(`${successCount} órdenes actualizadas correctamente`);
			}
			if (errorCount > 0) {
				toast.error(`Falló la actualización de ${errorCount} órdenes`);
			}

			setSelectedOrderIds([]);
			await onRefresh();

		} catch {
			toast.error('Error en la actualización masiva');
		} finally {
			setIsSubmitting(false);
		}
	};

	useEffect(() => {
		if (focusOrderId) {
			const order = orders.find(o => o.id === focusOrderId);
			if (order) {
				// Fetch full details to ensure we have notes/items
				const fetchDetails = async () => {
					try {
						const response = await apiFetch(apiUrl(`/orders/${order.id}`));
						if (response.ok) {
							const data = await response.json();
							setSelectedOrder(data);
							setInternalNotes(data.internal_notes || '');
						} else {
							// Fallback to basic order data if fetch fails
							setSelectedOrder(order);
							setInternalNotes(order.internal_notes || '');
						}
					} catch {
						setSelectedOrder(order);
					}
				};
				fetchDetails();
				
				if (onClearFocusOrderId) onClearFocusOrderId();
			}
		}
	}, [focusOrderId, orders, onClearFocusOrderId]);

	const filteredOrders = orders;

	const handleOrderStatusChange = async (orderId, newStatus, extraData = {}) => {
		// If changing to shipped, open tracking modal first (unless we already have the data)
		if (newStatus === 'shipped' && !extraData.carrier && !extraData.trackingNumber) {
			setTrackingData({ orderId, carrier: '', trackingNumber: '' });
			setShowTrackingModal(true);
			return;
		}

		if (!extraData.carrier) {
			const confirmed = await confirmAction(`¿Cambiar el estado de la orden a "${newStatus}"?`);
			if (!confirmed) return;
		}

		try {
			setIsSubmitting(true);
			
			const body = { status: newStatus, ...extraData };

			const response = await apiFetch(apiUrl(`/orders/${orderId}`), {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(body)
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'Error al actualizar el estado');
			}

			toast.success('Orden actualizada correctamente');
			await onRefresh();
			
			// Update selectedOrder if it's currently open
			if (selectedOrder && selectedOrder.id === orderId) {
				setSelectedOrder(prev => ({ ...prev, status: newStatus, ...extraData }));
			}
			
			setShowTrackingModal(false);
		} catch (error) {
			toast.error(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSaveNotes = async () => {
		if (!selectedOrder) return;

		try {
			setIsSubmitting(true);
			const response = await apiFetch(apiUrl(`/orders/${selectedOrder.id}`), {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ internal_notes: internalNotes })
			});

			if (!response.ok) {
				throw new Error('Error al guardar notas');
			}

			toast.success('Notas guardadas');
			setSelectedOrder(prev => ({ ...prev, internal_notes: internalNotes }));
			await onRefresh();
		} catch (error) {
			toast.error(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteOrder = async (orderId) => {
		const confirmed = await confirmAction(`¿Estás seguro de que deseas eliminar la orden #${orderId}? Esta acción no se puede deshacer.`);
		if (!confirmed) {
			return;
		}

		try {
			setIsSubmitting(true);
			const response = await apiFetch(apiUrl(`/orders/${orderId}`), {
				method: 'DELETE',
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || 'Error al eliminar la orden');
			}

			toast.success('Orden eliminada correctamente');
			await onRefresh();
		} catch (error) {
			toast.error(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const viewOrderDetails = async (orderId) => {
		try {
			const response = await apiFetch(apiUrl(`/orders/${orderId}`));

			if (!response.ok) {
				throw new Error('Error al cargar detalles de la orden');
			}

			const data = await response.json();
			setSelectedOrder(data);
			setInternalNotes(data.internal_notes || '');
		} catch (error) {
			toast.error(error.message);
		}
	};

	const closeOrderDetails = () => {
		setSelectedOrder(null);
		setInternalNotes('');
	};

	const renderOrderTable = (ordersToList) => {
		const allIds = ordersToList.map(o => o.id);
		const isAllSelected = allIds.length > 0 && allIds.every(id => selectedOrderIds.includes(id));
		const isIndeterminate = allIds.some(id => selectedOrderIds.includes(id)) && !isAllSelected;

		return (
		<div className="admin-table-container">
			{selectedOrderIds.length > 0 && (
				<div className="bulk-actions-toolbar" style={{ 
					padding: '8px 12px', 
					backgroundColor: '#e6f7ff', 
					borderBottom: '1px solid #91d5ff',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					marginBottom: '0'
				}}>
					<span style={{ fontWeight: 'bold', color: '#096dd9', fontSize: '0.9em' }}>
						{selectedOrderIds.length} orden{selectedOrderIds.length !== 1 ? 'es' : ''} seleccionada{selectedOrderIds.length !== 1 ? 's' : ''}
					</span>
					<div style={{ display: 'flex', gap: '5px' }}>
						<button className="admin-btn primary sm" onClick={() => handleBulkStatusChange('to_ship')} title="Marcar como Para Enviar">📦 Prep</button>
						<button className="admin-btn primary sm" onClick={() => handleBulkStatusChange('shipped')} title="Marcar como Enviado">🚚 Env</button>
						<button className="admin-btn success sm" onClick={() => handleBulkStatusChange('delivered')} title="Marcar como Entregado">✅ Entr</button>
						<button className="admin-btn success sm" onClick={() => handleBulkStatusChange('paid')} title="Marcar como Pagado">💰 Pag</button>
					</div>
				</div>
			)}
			<table className="admin-table">
				<thead>
					<tr>
						<th style={{ width: '40px', textAlign: 'center' }}>
							<input 
								type="checkbox" 
								checked={isAllSelected}
								ref={input => { if (input) input.indeterminate = isIndeterminate; }}
								onChange={() => handleSelectAll(ordersToList)}
								style={{ cursor: 'pointer', width: '18px', height: '18px' }}
							/>
						</th>
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
					{ordersToList.map((order) => {
						const isCOD = order.payment_method === 'cash';
						let nextAction = null;

						if (isCOD) {
							if (order.status === 'to_ship') nextAction = { status: 'shipped', label: 'Marcar como Enviado', icon: '🚚', class: 'primary' };
							else if (order.status === 'shipped') nextAction = { status: 'delivered', label: 'Marcar como Entregado', icon: '✅', class: 'success' };
							else if (order.status === 'delivered') nextAction = { status: 'paid', label: 'Marcar como Pagado', icon: '💰', class: 'success' };
						} else {
							if (order.status === 'pending_payment') nextAction = { status: 'paid', label: 'Marcar como Pagado', icon: '💰', class: 'success' };
							else if (order.status === 'paid') nextAction = { status: 'to_ship', label: 'Pasar a Preparación', icon: '📦', class: 'primary' };
							else if (order.status === 'to_ship') nextAction = { status: 'shipped', label: 'Marcar como Enviado', icon: '🚚', class: 'primary' };
							else if (order.status === 'shipped') nextAction = { status: 'delivered', label: 'Marcar como Entregado', icon: '✅', class: 'success' };
						}

						return (
							<tr 
								key={order.id}
								onClick={() => viewOrderDetails(order.id)}
								style={{ 
									cursor: 'pointer', 
									backgroundColor: selectedOrderIds.includes(order.id) ? '#f0f9ff' : undefined 
								}}
								className="admin-table-row-clickable"
							>
								<td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
									<input 
										type="checkbox" 
										checked={selectedOrderIds.includes(order.id)}
										onChange={() => handleSelectOrder(order.id)}
										style={{ cursor: 'pointer', width: '18px', height: '18px' }}
									/>
								</td>
								<td data-label="ID">{order.order_number || `#${order.id}`}</td>
								<td className="admin-table-name" data-label="Cliente">
									<span 
										title={order.user_id ? "Usuario Registrado" : "Usuario Invitado"}
										style={{ 
											marginRight: '5px', 
											fontSize: '0.80em',
											color: order.user_id ? 'transparent' : 'inherit',
											textShadow: order.user_id ? '0 0 0 #0b913cff' : 'none'
										}}
									>
										👤
									</span>
									{order.customer_name}
								</td>
								<td data-label="Email">{order.customer_email}</td>
								<td className="admin-table-price" data-label="Total">{formatCurrency(order.total, currencyCode)}</td>
								<td data-label="Pago">
									<span className={`admin-chip payment-${order.payment_method || 'cash'}`}>
										{(order.payment_method === 'cash' || !order.payment_method) && '💵 Efectivo'}
										{order.payment_method === 'transfer' && '🏦 Transferencia'}
										{order.payment_method === 'online' && '💳 Online'}
										{order.payment_method === 'card' && '💳 Tarjeta'}
									</span>
								</td>
								<td data-label="Estado">
									<span className={`admin-chip status-${order.status}`}>
										{order.status === 'pending_payment' && '⏳ Pendiente de Pago'}
										{order.status === 'paid' && '💰 Pagado'}
										{order.status === 'to_ship' && '📦 Para Enviar'}
										{order.status === 'shipped' && '🚚 Enviado'}
										{order.status === 'delivered' && '✅ Entregado'}
										{order.status === 'return' && '↩️ Devolución'}
										{order.status === 'refund' && '💸 Reembolso'}
										{order.status === 'cancelled' && '❌ Cancelado'}
										{order.status === 'pending' && '⏳ Pendiente'}
										{order.status === 'processing' && '⚙️ Procesando'}
									</span>
								</td>
								<td data-label="Fecha">{new Date(order.created_at).toLocaleDateString()}</td>
								<td className="admin-table-actions" data-label="Acciones">
									<div className="action-buttons-group" onClick={(e) => e.stopPropagation()}>
										<div className="action-buttons-before">
											{nextAction && (
												<button 
													className={`admin-btn ${nextAction.class} sm`} 
													onClick={() => handleOrderStatusChange(order.id, nextAction.status)}
													title={nextAction.label}
												>
													{nextAction.icon}
												</button>
											)}
											
											{order.status === 'delivered' && (
												<button 
													className="admin-btn warning sm" 
													onClick={() => handleOrderStatusChange(order.id, 'return')}
													title="Marcar como Devolución"
												>
													↩️
												</button>
											)}
											{order.status === 'return' && (
												<button 
													className="admin-btn danger sm" 
													onClick={() => handleOrderStatusChange(order.id, 'refund')}
													title="Procesar Reembolso"
												>
													💸
												</button>
											)}
										</div>
										
										<select
											value={order.status}
											onChange={(e) => handleOrderStatusChange(order.id, e.target.value)}
											className="admin-status-select sm"
											disabled={isSubmitting}
										>
											<option value="pending_payment">Pendiente Pago</option>
											<option value="paid">Pagado</option>
											<option value="to_ship">Para Enviar</option>
											<option value="shipped">Enviado</option>
											<option value="delivered">Entregado</option>
											<option value="return">Devolución</option>
											<option value="refund">Reembolso</option>
											<option value="cancelled">Cancelado</option>
										</select>

										<div className="action-buttons-after">
											{(order.status === 'pending_payment' || order.status === 'paid' || order.status === 'to_ship') && (
												<button 
													className="admin-btn ghost sm" 
													onClick={() => handleOrderStatusChange(order.id, 'cancelled')}
													title="Cancelar Orden"
													style={{ color: '#ef4444' }}
												>
													❌
												</button>
											)}

											{order.status === 'cancelled' && (
												<button
													type="button"
													className="admin-btn danger sm"
													onClick={() => handleDeleteOrder(order.id)}
													disabled={isSubmitting}
													title="Eliminar"
												>
													🗑️
												</button>
											)}
										</div>
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
	};

	const renderOrderCards = (ordersToList) => (
		<div className="mobile-order-list">
			{ordersToList.map((order) => (
				<div
					key={order.id}
					className="mobile-order-card"
					onClick={() => viewOrderDetails(order.id)}
					role="button"
					tabIndex={0}
					onKeyDown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							viewOrderDetails(order.id);
						}
					}}
				>
					<div className="mobile-order-header">
						<div className="mobile-order-id">{order.order_number || `#${order.id}`}</div>
						<span className={`admin-chip status-${order.status}`}>
							{order.status === 'pending_payment' && '⏳ Pendiente de Pago'}
							{order.status === 'paid' && '💰 Pagado'}
							{order.status === 'to_ship' && '📦 Para Enviar'}
							{order.status === 'shipped' && '🚚 Enviado'}
							{order.status === 'delivered' && '✅ Entregado'}
							{order.status === 'return' && '↩️ Devolución'}
							{order.status === 'refund' && '💸 Reembolso'}
							{order.status === 'cancelled' && '❌ Cancelado'}
							{order.status === 'pending' && '⏳ Pendiente'}
							{order.status === 'processing' && '⚙️ Procesando'}
						</span>
					</div>

					<div className="mobile-order-row">
						<span className="mobile-order-label">Cliente</span>
						<span className="mobile-order-value">{order.customer_name}</span>
					</div>

					<div className="mobile-order-row">
						<span className="mobile-order-label">Fecha</span>
						<span className="mobile-order-value">{new Date(order.created_at).toLocaleDateString()}</span>
					</div>

					<div className="mobile-order-row">
						<span className="mobile-order-label">Total</span>
						<span className="mobile-order-value">{formatCurrency(order.total, currencyCode)}</span>
					</div>

					<div className="mobile-order-row">
						<span className="mobile-order-label">Pago</span>
						<span className="mobile-order-value">
							<span className={`admin-chip payment-${order.payment_method || 'cash'}`}>
								{(order.payment_method === 'cash' || !order.payment_method) && '💵 Efectivo'}
								{order.payment_method === 'transfer' && '🏦 Transferencia'}
								{order.payment_method === 'online' && '💳 Online'}
								{order.payment_method === 'card' && '💳 Tarjeta'}
							</span>
						</span>
					</div>

					<div className="mobile-order-hint">Toca para ver y actualizar</div>
				</div>
			))}
		</div>
	);

	const renderResponsiveOrders = (ordersToList) => (
		<>
			<div className="orders-desktop">
				{renderOrderTable(ordersToList)}
			</div>
			<div className="orders-mobile">
				{renderOrderCards(ordersToList)}
			</div>
		</>
	);

	return (
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
					<label htmlFor="order-payment-type">Tipo de Pago</label>
					<select
						id="order-payment-type"
						value={orderFilters.paymentType}
						onChange={(event) => setOrderFilters((prev) => ({ ...prev, paymentType: event.target.value, status: 'all' }))}
					>
						<option value="all">Todas</option>
						<option value="online">Pago en línea</option>
						<option value="cod">Contra entrega</option>
					</select>
				</div>
				<div className="filter-field">
					<label htmlFor="order-type">Tipo Usuario</label>
					<select
						id="order-type"
						value={orderFilters.type}
						onChange={(event) => setOrderFilters((prev) => ({ ...prev, type: event.target.value }))}
					>
						<option value="all">Todos</option>
						<option value="registered">Registrados</option>
						<option value="guest">Invitados</option>
					</select>
				</div>
				<div className="filter-field full-width">
					<label>Filtrar por Estado</label>
					<div className="admin-filter-stepper">
						{(orderFilters.paymentType === 'cod' ? COD_ORDER_STEPS : ONLINE_ORDER_STEPS).map((step, index) => {
							const steps = orderFilters.paymentType === 'cod' ? COD_ORDER_STEPS : ONLINE_ORDER_STEPS;
							const currentIdx = steps.findIndex(s => s.id === orderFilters.status);
							const isHighlighted = orderFilters.status !== 'all' && index > 0 && index < currentIdx;
							const isActive = orderFilters.status === step.id;
							
							return (
								<div 
									key={step.id} 
									className={`filter-step ${isHighlighted ? 'highlighted' : ''} ${isActive ? 'active' : ''}`}
									onClick={() => setOrderFilters((prev) => ({ ...prev, status: step.id }))}
								>
									<span className="step-icon">{step.icon}</span>
									<span className="step-label">{step.label}</span>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{isLoading ? (
				<div className="admin-empty"><LoadingSpinner /></div>
			) : filteredOrders.length === 0 ? (
				<div className="admin-empty">No hay órdenes que coincidan con el filtro actual.</div>
			) : (
				orderFilters.paymentType === 'all' ? (
					<div className="orders-split-view">
						<details open className="order-group">
							<summary style={{padding: '10px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: '#f5f5f5', borderRadius: '5px', marginBottom: '10px'}}>
								Pago en línea ({filteredOrders.filter(o => o.payment_method !== 'cash').length})
							</summary>
							{renderResponsiveOrders(filteredOrders.filter(o => o.payment_method !== 'cash'))}
						</details>
						<details open className="order-group" style={{marginTop: '20px'}}>
							<summary style={{padding: '10px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: '#f5f5f5', borderRadius: '5px', marginBottom: '10px'}}>
								Contra entrega ({filteredOrders.filter(o => o.payment_method === 'cash').length})
							</summary>
							{renderResponsiveOrders(filteredOrders.filter(o => o.payment_method === 'cash'))}
						</details>
					</div>
				) : (
					renderResponsiveOrders(filteredOrders)
				)
			)}

            {pagination && (
				<div className="pagination-controls">
					<button 
						className="admin-btn ghost"
						disabled={pagination.page === 1}
						onClick={() => onPageChange(pagination.page - 1)}
					>
						&laquo; Anterior
					</button>
					<span>Página {pagination.page} de {pagination.totalPages}</span>
					<button 
						className="admin-btn ghost"
						disabled={pagination.page === pagination.totalPages}
						onClick={() => onPageChange(pagination.page + 1)}
					>
						Siguiente &raquo;
					</button>
				</div>
			)}

			{/* Order Details Modal */}
			{selectedOrder && (
				<div className="order-modal-overlay" onClick={closeOrderDetails}>
					<div className="order-modal" onClick={(e) => e.stopPropagation()}>
						<div className="order-modal-header">
							<h3>Detalles de Orden {selectedOrder.order_number || `#${selectedOrder.id}`}</h3>
							<button className="close-modal" onClick={closeOrderDetails}>✕</button>
						</div>
						<div className="order-modal-body">
							<div className="order-details-split">
								<div className="order-invoice-section">
									<Invoice 
										order={selectedOrder}
										customerInfo={{
											firstName: selectedOrder.customer_name?.split(' ')[0] || '',
											lastName: selectedOrder.customer_name?.split(' ').slice(1).join(' ') || '',
											email: selectedOrder.customer_email,
											address: selectedOrder.shipping_street,
											sector: selectedOrder.shipping_sector,
											city: selectedOrder.shipping_city,
											phone: selectedOrder.customer_phone,
											paymentMethod: selectedOrder.payment_method
										}}
										items={selectedOrder.items || []}
										onClose={closeOrderDetails}
										showSuccess={false}
										onStatusChange={(newStatus) => handleOrderStatusChange(selectedOrder.id, newStatus)}
										siteName={siteName}
										siteIcon={siteIcon}
										currencyCode={currencyCode}
									/>
								</div>
								<div className="order-admin-notes-section" style={{borderLeft: '1px solid #eee', paddingLeft: '20px', minWidth: '300px'}}>
									<h4>Notas Internas (Admin)</h4>
									<p style={{fontSize: '0.85em', color: '#666', marginBottom: '10px'}}>
										Estas notas son solo visibles para administradores.
									</p>
									<textarea
										value={internalNotes}
										onChange={(e) => setInternalNotes(e.target.value)}
										placeholder="Escribe notas sobre el pedido aquí..."
										rows="10"
										style={{width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '10px'}}
									/>
									<button 
										className="admin-btn primary" 
										onClick={handleSaveNotes}
										disabled={isSubmitting}
										style={{width: '100%'}}
									>
										{isSubmitting ? 'Guardando...' : 'Guardar Notas'}
									</button>

									{selectedOrder.carrier && (
										<div className="shipping-info-display" style={{marginTop: '20px', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '4px'}}>
											<h4>Datos de Envío</h4>
											<p><strong>Transportista:</strong> {selectedOrder.carrier}</p>
											<p><strong>Tracking:</strong> {selectedOrder.tracking_number}</p>
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Tracking Info Modal */}
			{showTrackingModal && (
				<div className="order-modal-overlay">
					<div className="order-modal" style={{maxWidth: '400px'}} onClick={(e) => e.stopPropagation()}>
						<div className="order-modal-header">
							<h3>Información de Envío</h3>
							<button className="close-modal" onClick={() => setShowTrackingModal(false)}>✕</button>
						</div>
						<div className="order-modal-body">
							<p style={{marginBottom: '15px'}}>Por favor ingresa los datos del envío para marcar la orden como Enviada.</p>
							<div className="form-group" style={{marginBottom: '15px'}}>
								<label style={{display: 'block', marginBottom: '5px'}}>Empresa de Transporte</label>
								<input 
									type="text" 
									className="admin-input"
									value={trackingData.carrier}
									onChange={(e) => setTrackingData(prev => ({ ...prev, carrier: e.target.value }))}
									placeholder="Ej. DHL, FedEx, Mensajero Local"
									style={{width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px'}}
								/>
							</div>
							<div className="form-group" style={{marginBottom: '20px'}}>
								<label style={{display: 'block', marginBottom: '5px'}}>Número de Guía / Tracking</label>
								<input 
									type="text" 
									className="admin-input"
									value={trackingData.trackingNumber}
									onChange={(e) => setTrackingData(prev => ({ ...prev, trackingNumber: e.target.value }))}
									placeholder="Ej. 1234567890"
									style={{width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px'}}
								/>
							</div>
							<div className="modal-actions" style={{display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
								<button 
									className="admin-btn ghost" 
									onClick={() => setShowTrackingModal(false)}
								>
									Cancelar
								</button>
								<button 
									className="admin-btn primary" 
									onClick={() => handleOrderStatusChange(trackingData.orderId, 'shipped', { 
										carrier: trackingData.carrier, 
										tracking_number: trackingData.trackingNumber 
									})}
									disabled={!trackingData.carrier || !trackingData.trackingNumber}
								>
									Confirmar Envío
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
