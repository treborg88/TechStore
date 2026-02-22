import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../common/LoadingSpinner';
import OrderList from '../orders/OrderList';
import ProductList from '../products/ProductList';
import UserList from './UserList';
import SettingsManager from './SettingsManager';
import { formatCurrency } from '../../utils/formatCurrency';
import { playNotificationSound } from '../../utils/notificationSound';
import { resolveImageUrl } from '../../utils/resolveImageUrl';

export default function AdminDashboard({ products, onRefresh, isLoading, pagination, currencyCode, siteName = 'Mi Tienda Online', siteIcon = '🛍️' }) {
	// Tab state
	const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'products', 'users', 'orders'
	
	// Orders management states (paginated — for Orders tab)
	const [orders, setOrders] = useState([]);
	const [isLoadingOrders, setIsLoadingOrders] = useState(false);
	const [focusOrderId, setFocusOrderId] = useState(null);
    const [orderFilters, setOrderFilters] = useState({ search: '', status: 'all', type: 'all', paymentType: 'all' });
    const [ordersPagination, setOrdersPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

	// All orders for analytics (overview tab)
	const [allOrders, setAllOrders] = useState([]);

	// Order counts by status (for stepper badges)
	const [orderCounts, setOrderCounts] = useState({});
	
	// User stats (lifted from UserList)
	const [userStats, setUserStats] = useState({ total: 0 });

	// New order alert: toggle + polling state
	const [orderAlertEnabled, setOrderAlertEnabled] = useState(() => {
		return localStorage.getItem('admin_order_alert') === 'true';
	});
	const prevOrderTotalRef = useRef(null);

	// Analytics states
	const [salesPeriod, setSalesPeriod] = useState('week'); // 'day', 'week', 'month', 'year'
	const [topProductsLimit, setTopProductsLimit] = useState(5);
	const [selectedBar, setSelectedBar] = useState(null); // Index of clicked bar

	const loadOrders = useCallback(async (page = 1) => {
		try {
			setIsLoadingOrders(true);
            const queryParams = new URLSearchParams({
                page: page,
                limit: ordersPagination.limit,
                search: orderFilters.search,
                status: orderFilters.status,
                paymentType: orderFilters.paymentType,
                type: orderFilters.type
            });

            // Cache key for orders
            const cacheKey = `orders_cache_${page}_${JSON.stringify(orderFilters)}`;
            const cachedData = localStorage.getItem(cacheKey);

            if (cachedData) {
                const parsedCache = JSON.parse(cachedData);
                const now = new Date().getTime();
                // 1 minute cache for orders
                if (now - parsedCache.timestamp < 60 * 1000) {
                    setOrders(parsedCache.data);
                    setOrdersPagination(parsedCache.pagination);
                    setIsLoadingOrders(false);
                }
            }

			const response = await apiFetch(apiUrl(`/orders?${queryParams}`), {
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || 'Error al cargar órdenes');
			}

			const result = await response.json();
			setOrders(result.data);
            setOrdersPagination(prev => ({
                ...prev,
                page: result.page,
                total: result.total,
                totalPages: result.totalPages
            }));

            // Update cache
            localStorage.setItem(cacheKey, JSON.stringify({
                timestamp: new Date().getTime(),
                data: result.data,
                pagination: {
                    page: result.page,
                    total: result.total,
                    totalPages: result.totalPages
                }
            }));

		} catch (error) {
			console.error('Error cargando órdenes:', error);
			toast.error(error.message);
		} finally {
			setIsLoadingOrders(false);
		}
	}, [ordersPagination.limit, orderFilters]);

	// Fetch order counts grouped by status (lightweight query for badges)
	const loadOrderCounts = useCallback(async () => {
		try {
			const response = await apiFetch(apiUrl('/orders/counts'));
			if (!response.ok) throw new Error('Error al cargar conteos');
			const counts = await response.json();
			setOrderCounts(counts);
		} catch (error) {
			console.error('Error cargando conteos de órdenes:', error);
		}
	}, []);

	// Fetch all orders for analytics (overview) — runs once on mount
	const loadAllOrders = useCallback(async () => {
		try {
			const cacheKey = 'all_orders_analytics_cache';
			const cachedData = localStorage.getItem(cacheKey);
			if (cachedData) {
				const parsed = JSON.parse(cachedData);
				// 2-minute cache for full analytics data
				if (Date.now() - parsed.timestamp < 2 * 60 * 1000) {
					setAllOrders(parsed.data);
					return;
				}
			}
			const response = await apiFetch(apiUrl('/orders?page=1&limit=1000&status=all&type=all&paymentType=all&search=&includeItems=true'));
			if (!response.ok) throw new Error('Error al cargar datos analíticos');
			const result = await response.json();
			setAllOrders(result.data);
			localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: result.data }));
		} catch (error) {
			console.error('Error cargando datos analíticos:', error);
		}
	}, []);

	// Load data based on active tab
	useEffect(() => {
		if (activeTab === 'orders') {
			loadOrders(1);
			loadOrderCounts();
		}
		if (activeTab === 'overview') {
			loadAllOrders();
			loadOrders(1);
			loadOrderCounts();
		}
	}, [activeTab, loadOrders, loadAllOrders, loadOrderCounts]);

    // Reload orders when filters change
    useEffect(() => {
        if (activeTab === 'orders') {
            const timeoutId = setTimeout(() => {
                loadOrders(1);
            }, 500); // Debounce search
            return () => clearTimeout(timeoutId);
        }
    }, [orderFilters, activeTab, loadOrders]);

	// Persist alert toggle in localStorage
	useEffect(() => {
		localStorage.setItem('admin_order_alert', orderAlertEnabled);
	}, [orderAlertEnabled]);

	// Polling: check for new orders every 30s when alert is enabled
	useEffect(() => {
		if (!orderAlertEnabled) return;

		const pollNewOrders = async () => {
			try {
				const response = await apiFetch(apiUrl('/orders/counts'));
				if (!response.ok) return;
				const counts = await response.json();
				const currentTotal = Object.values(counts).reduce((s, v) => s + v, 0);

				// Compare with previous total; skip first load to avoid false alert
				if (prevOrderTotalRef.current !== null && currentTotal > prevOrderTotalRef.current) {
					const newCount = currentTotal - prevOrderTotalRef.current;
					playNotificationSound();
					toast(`🔔 ${newCount === 1 ? 'Nueva orden recibida' : `${newCount} nuevas órdenes`}`, {
						duration: 5000,
						style: { background: '#fef2f2', color: '#991b1b', border: '1px solid #fca5a5' }
					});
					// Refresh counts and orders list if on orders/overview tab
					setOrderCounts(counts);
					if (activeTab === 'orders' || activeTab === 'overview') {
						loadOrders(1);
					}
				} else {
					// Silent update of badge counts
					setOrderCounts(counts);
				}
				prevOrderTotalRef.current = currentTotal;
			} catch {
				// Silently ignore polling errors
			}
		};

		// Initial baseline load
		pollNewOrders();
		const intervalId = setInterval(pollNewOrders, 30000);
		return () => clearInterval(intervalId);
	}, [orderAlertEnabled, activeTab, loadOrders]);

	// Calculate stats for overview (uses allOrders for accurate totals)
	const stats = useMemo(() => {
		const src = allOrders.length > 0 ? allOrders : orders;
		const totalRevenue = src
			.filter(o => o.status !== 'cancelled' && o.status !== 'refund')
			.reduce((sum, o) => sum + o.total, 0);
		
		const pendingOrders = src.filter(o => 
			o.status === 'pending' || 
			o.status === 'pending_payment' || 
			o.status === 'paid' || 
			o.status === 'to_ship'
		).length;
		const lowStockProducts = products.filter(p => p.stock < 5).length;

		return {
			revenue: totalRevenue,
			totalOrders: src.length,
			pendingOrders,
			totalProducts: products.length,
			lowStockProducts,
			totalUsers: userStats.total,
			activeUsers: 'N/A'
		};
	}, [allOrders, orders, products, userStats]);

	// Analytics: Sales by period (uses allOrders for full dataset)
	const salesByPeriod = useMemo(() => {
		const src = allOrders.length > 0 ? allOrders : orders;
		const now = new Date();
		const periods = [];
		const periodCount = 7;

		// Generate period labels and data
		for (let i = periodCount - 1; i >= 0; i--) {
			const periodDate = new Date(now);
			let label = '';
			
			if (salesPeriod === 'day') {
				periodDate.setDate(now.getDate() - i);
				label = periodDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
			} else if (salesPeriod === 'week') {
				periodDate.setDate(now.getDate() - (i * 7));
				const weekStart = new Date(periodDate);
				weekStart.setDate(periodDate.getDate() - periodDate.getDay());
				label = `${weekStart.getDate()}/${weekStart.getMonth() + 1}`;
			} else if (salesPeriod === 'month') {
				periodDate.setMonth(now.getMonth() - i);
				label = periodDate.toLocaleDateString('es-ES', { month: 'short' });
			} else if (salesPeriod === 'year') {
				periodDate.setFullYear(now.getFullYear() - i);
				label = periodDate.getFullYear().toString();
			}

			const periodOrders = src.filter(order => {
				if (order.status === 'cancelled' || order.status === 'refund') return false;
				const orderDate = new Date(order.created_at);
				
				if (salesPeriod === 'day') {
					return orderDate.toDateString() === periodDate.toDateString();
				} else if (salesPeriod === 'week') {
					// Normalize boundaries to full-day range to avoid time-of-day mismatches
					const weekStart = new Date(periodDate);
					weekStart.setDate(periodDate.getDate() - periodDate.getDay());
					weekStart.setHours(0, 0, 0, 0);
					const weekEnd = new Date(weekStart);
					weekEnd.setDate(weekStart.getDate() + 6);
					weekEnd.setHours(23, 59, 59, 999);
					return orderDate >= weekStart && orderDate <= weekEnd;
				} else if (salesPeriod === 'month') {
					return orderDate.getMonth() === periodDate.getMonth() && 
						   orderDate.getFullYear() === periodDate.getFullYear();
				} else if (salesPeriod === 'year') {
					return orderDate.getFullYear() === periodDate.getFullYear();
				}
				return false;
			});

			const revenue = periodOrders.reduce((sum, o) => sum + o.total, 0);
			periods.push({ label, revenue, orders: periodOrders.length });
		}

		const maxRevenue = Math.max(...periods.map(p => p.revenue), 1);
		return periods.map(p => ({ ...p, percentage: (p.revenue / maxRevenue) * 100 }));
	}, [allOrders, orders, salesPeriod]);

	// Analytics: Top selling products (uses allOrders for full dataset)
	const topSellingProducts = useMemo(() => {
		const src = allOrders.length > 0 ? allOrders : orders;
		const productSales = {};
		
		src.forEach(order => {
			if (order.status === 'cancelled' || order.status === 'refund') return;
			(order.items || []).forEach(item => {
				if (!productSales[item.product_id]) {
					productSales[item.product_id] = {
						productId: item.product_id,
						name: item.product_name || item.name || 'Producto desconocido',
						image: item.image || null,
						quantity: 0,
						revenue: 0
					};
				}
				productSales[item.product_id].quantity += item.quantity;
				productSales[item.product_id].revenue += item.price * item.quantity;
			});
		});

		return Object.values(productSales)
			.sort((a, b) => b.revenue - a.revenue)
			.slice(0, topProductsLimit)
			.map((product, index) => {
				const totalRevenue = Object.values(productSales).reduce((sum, p) => sum + p.revenue, 0) || 1;
				// Cross-reference with products prop for reliable image URL
				const catalogProduct = products.find(p => p.id === product.productId);
				const resolvedImage = catalogProduct?.images?.[0]?.image_path
					|| catalogProduct?.image
					|| product.image
					|| null;
				return {
					...product,
					image: resolvedImage,
					percentage: (product.revenue / totalRevenue) * 100,
					rank: index + 1
				};
			});
	}, [allOrders, orders, topProductsLimit, products]);

	// Recent orders for overview (uses allOrders for full dataset)
	const recentOrders = useMemo(() => {
		const src = allOrders.length > 0 ? allOrders : orders;
		return [...src]
			.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
			.slice(0, 5);
	}, [allOrders, orders]);

	return (
		<div className="admin-dashboard">
			{/* Tabs Navigation */}
			<div className="admin-tabs">
				<button
					type="button"
					className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
					onClick={() => setActiveTab('overview')}
				>
					📊 Resumen
				</button>
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

			{/* Overview Tab */}
			{activeTab === 'overview' && (
				<section className="admin-section overview-section">
					<div className="admin-section-header">
						<h3>📊 Panel General</h3>
						<span>
							Vista completa de tu negocio
							{/* Refresh overview: clears analytics cache and reloads */}
							<button
								type="button"
								className="admin-btn ghost refresh-btn"
								onClick={() => {
									localStorage.removeItem('all_orders_analytics_cache');
									loadAllOrders();
									toast.success('Datos actualizados');
								}}
								title="Actualizar datos"
							>
								🔄
							</button>
						</span>
					</div>
					
					{/* KPI Cards */}
					<div className="stats-grid">
						{/* Clickable stat cards — navigate to respective tabs */}
						<button type="button" className="stat-card revenue" onClick={() => setActiveTab('orders')}>
							<div className="stat-icon">💰</div>
							<div className="stat-info">
								<h4>Ingresos Totales</h4>
								<p className="stat-value">{formatCurrency(stats.revenue, currencyCode)}</p>
								<span className="stat-sub">En {stats.totalOrders} órdenes</span>
							</div>
						</button>

						<button type="button" className="stat-card orders" onClick={() => setActiveTab('orders')}>
							<div className="stat-icon">🛍️</div>
							<div className="stat-info">
								<h4>Órdenes Pendientes</h4>
								<p className="stat-value">{stats.pendingOrders}</p>
								<span className="stat-sub">De {stats.totalOrders} totales</span>
							</div>
						</button>

						<button type="button" className="stat-card products" onClick={() => setActiveTab('products')}>
							<div className="stat-icon">📦</div>
							<div className="stat-info">
								<h4>Productos</h4>
								<p className="stat-value">{stats.totalProducts}</p>
								<span className="stat-sub">{stats.lowStockProducts} con stock bajo</span>
							</div>
						</button>

						<button type="button" className="stat-card users" onClick={() => setActiveTab('users')}>
							<div className="stat-icon">👥</div>
							<div className="stat-info">
								<h4>Usuarios</h4>
								<p className="stat-value">{stats.totalUsers}</p>
								<span className="stat-sub">Registrados</span>
							</div>
						</button>
					</div>

					{/* Analytics Section */}
					<div className="analytics-container">
						{/* Sales Chart */}
						<div className="analytics-card sales-chart-card">
							<div className="analytics-header">
								<h4>📈 Ventas por Período</h4>
								<div className="period-selector">
									<button 
										className={`period-btn ${salesPeriod === 'day' ? 'active' : ''}`}
										onClick={() => setSalesPeriod('day')}
									>
										Día
									</button>
									<button 
										className={`period-btn ${salesPeriod === 'week' ? 'active' : ''}`}
										onClick={() => setSalesPeriod('week')}
									>
										Semana
									</button>
									<button 
										className={`period-btn ${salesPeriod === 'month' ? 'active' : ''}`}
										onClick={() => setSalesPeriod('month')}
									>
										Mes
									</button>
									<button 
										className={`period-btn ${salesPeriod === 'year' ? 'active' : ''}`}
										onClick={() => setSalesPeriod('year')}
									>
										Año
									</button>
								</div>
							</div>
							<div className="chart-container">
								<div className="bar-chart">
									{salesByPeriod.map((period, index) => (
										<div key={index} className={`bar-wrapper ${selectedBar === index ? 'active' : ''}`}>
											{/* Tooltip: visible only for the selected bar */}
											{selectedBar === index && (
												<div className="bar-tooltip">
													{formatCurrency(period.revenue, currencyCode)}
													<span className="bar-tooltip-orders">({period.orders} órdenes)</span>
												</div>
											)}
											<div className="bar-column">
												<div 
													className="bar-fill"
													style={{ height: `${period.percentage}%` }}
													onClick={() => setSelectedBar(selectedBar === index ? null : index)}
												/>
											</div>
											<div className="bar-label">{period.label}</div>
										</div>
									))}
								</div>
								<div className="chart-summary">
									<span>Total del período: <strong>{formatCurrency(salesByPeriod.reduce((sum, p) => sum + p.revenue, 0), currencyCode)}</strong></span>
									<span>Promedio: <strong>{formatCurrency(salesByPeriod.reduce((sum, p) => sum + p.revenue, 0) / salesByPeriod.length, currencyCode)}</strong></span>
								</div>
							</div>
						</div>

						{/* Top Products */}
						<div className="analytics-card top-products-card">
							<div className="analytics-header">
								<h4>🏆 Productos Más Vendidos</h4>
								<select 
									className="limit-selector"
									value={topProductsLimit}
									onChange={(e) => setTopProductsLimit(Number(e.target.value))}
								>
									<option value={5}>Top 5</option>
									<option value={10}>Top 10</option>
									<option value={15}>Top 15</option>
								</select>
							</div>
							<div className="top-products-list">
								{topSellingProducts.length > 0 ? (
									topSellingProducts.map((product) => (
										<div key={product.productId} className="top-product-item">
											<div className="product-rank">#{product.rank}</div>
											{/* Product thumbnail */}
											{resolveImageUrl(product.image) ? (
												<img
													className="top-product-thumb"
													src={resolveImageUrl(product.image)}
													alt={product.name}
													onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling.style.display = 'flex'; }}
												/>
											) : null}
											<div className="top-product-thumb placeholder" style={{ display: resolveImageUrl(product.image) ? 'none' : 'flex' }}>📦</div>
											<div className="product-info">
												<div className="product-name">{product.name}</div>
												<div className="product-stats">
													<span className="quantity">{product.quantity} vendidos</span>
													<span className="revenue">{formatCurrency(product.revenue, currencyCode)}</span>
												</div>
												<div className="progress-bar">
													<div 
														className="progress-fill"
														style={{ width: `${product.percentage}%` }}
													/>
												</div>
											</div>
										</div>
									))
								) : (
									<div className="empty-state">No hay datos de ventas aún</div>
								)}
							</div>
						</div>
					</div>

					{/* Widgets Grid */}
					<div className="admin-dashboard-widgets">
						{/* Stock Alerts */}
						<div className="dashboard-widget">
							<h4>⚠️ Alertas de Stock</h4>
							{stats.lowStockProducts > 0 ? (
								<ul className="alert-list">
									{products
										.filter(p => p.stock < 5)
										.slice(0, 5)
										.map(p => (
											<li key={p.id} className="alert-item">
												<span className="alert-product-name">{p.name}</span>
												<span className="stock-badge critical">{p.stock} unid.</span>
											</li>
										))
									}
									{stats.lowStockProducts > 5 && (
										<li className="more-items">
											<button 
												className="view-all-btn"
												onClick={() => setActiveTab('products')}
											>
												Ver todos los {stats.lowStockProducts} productos con stock bajo →
											</button>
										</li>
									)}
								</ul>
							) : (
								<p className="empty-widget">✓ Todo el inventario está saludable</p>
							)}
						</div>

						{/* Recent Orders */}
						<div className="dashboard-widget">
							<h4>🕐 Órdenes Recientes</h4>
							{recentOrders.length > 0 ? (
								<ul className="recent-orders-list">
									{recentOrders.map(order => (
										<li 
											key={order.id} 
											className="recent-order-item"
											onClick={() => {
												setActiveTab('orders');
												setFocusOrderId(order.id);
											}}
										>
											<div className="order-header">
												<span className="order-number">{order.order_number || `#${order.id}`}</span>
												<span className={`order-status status-${order.status}`}>
													{order.status === 'pending_payment' && '⏳'}
													{order.status === 'paid' && '💰'}
													{order.status === 'to_ship' && '📦'}
													{order.status === 'shipped' && '🚚'}
													{order.status === 'delivered' && '✅'}
												</span>
											</div>
											<div className="order-details">
												<span className="customer-name">{order.customer_name}</span>
												<span className="order-total">{formatCurrency(order.total, currencyCode)}</span>
											</div>
											<div className="order-date">
												{new Date(order.created_at).toLocaleDateString('es-ES', { 
													day: 'numeric', 
													month: 'short',
													hour: '2-digit',
													minute: '2-digit'
												})}
											</div>
										</li>
									))}
								</ul>
							) : (
								<p className="empty-widget">No hay órdenes aún</p>
							)}
						</div>
					</div>
				</section>
			)}

			{/* Products Tab */}
			{activeTab === 'products' && (
				<ProductList 
					products={products} 
					onRefresh={onRefresh} 
					isLoading={isLoading} 
					pagination={pagination} 
					currencyCode={currencyCode}
					onForceRefresh={() => onRefresh('todos', 1, { force: true })}
				/>)}


			{/* Orders Tab */}
			{activeTab === 'orders' && (
				<OrderList 
					orders={orders} 
					isLoading={isLoadingOrders} 
					onRefresh={() => loadOrders(ordersPagination.page)} 
					focusOrderId={focusOrderId}
					onClearFocusOrderId={() => setFocusOrderId(null)}
					filters={orderFilters}
					onFilterChange={setOrderFilters}
					pagination={ordersPagination}
					currencyCode={currencyCode}
					onPageChange={(page) => loadOrders(page)}
					siteName={siteName}
					siteIcon={siteIcon}
					orderCounts={orderCounts}
					orderAlertEnabled={orderAlertEnabled}
					onToggleOrderAlert={setOrderAlertEnabled}
					onForceRefresh={() => {
						// Clear all orders cache keys
						Object.keys(localStorage).filter(k => k.startsWith('orders_cache_')).forEach(k => localStorage.removeItem(k));
						loadOrders(ordersPagination.page);
						loadOrderCounts();
					}}
				/>
			)}

			{/* Users Tab */}
			{activeTab === 'users' && (
				<UserList onStatsUpdate={setUserStats} />
			)}
		</div>
	);
}
