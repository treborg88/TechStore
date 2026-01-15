import { useMemo, useState, useEffect } from 'react';
import { apiFetch, apiUrl } from '../services/apiClient';
import { toast } from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';
import OrderList from './OrderList';
import ProductList from './ProductList';
import UserList from './UserList';
import SettingsManager from './SettingsManager';

export default function AdminDashboard({ products, onRefresh, isLoading, pagination }) {
	// Tab state
	const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'products', 'users', 'orders'
	
	// Orders management states
	const [orders, setOrders] = useState([]);
	const [isLoadingOrders, setIsLoadingOrders] = useState(false);
	const [focusOrderId, setFocusOrderId] = useState(null);
    const [orderFilters, setOrderFilters] = useState({ search: '', status: 'all', type: 'all', paymentType: 'all' });
    const [ordersPagination, setOrdersPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
	
	// User stats (lifted from UserList)
	const [userStats, setUserStats] = useState({ total: 0 });

	// Analytics states
	const [salesPeriod, setSalesPeriod] = useState('week'); // 'day', 'week', 'month', 'year'
	const [topProductsLimit, setTopProductsLimit] = useState(5);

	// Load data based on active tab
	useEffect(() => {
		if (activeTab === 'orders' || activeTab === 'overview') {
			loadOrders(1);
		}
	}, [activeTab]);

    // Reload orders when filters change
    useEffect(() => {
        if (activeTab === 'orders') {
            const timeoutId = setTimeout(() => {
                loadOrders(1);
            }, 500); // Debounce search
            return () => clearTimeout(timeoutId);
        }
    }, [orderFilters]);

	// Calculate stats for overview
	const stats = useMemo(() => {
		const totalRevenue = orders
			.filter(o => o.status !== 'cancelled' && o.status !== 'refund')
			.reduce((sum, o) => sum + o.total, 0);
		
		const pendingOrders = orders.filter(o => 
			o.status === 'pending' || 
			o.status === 'pending_payment' || 
			o.status === 'paid' || 
			o.status === 'to_ship'
		).length;
		const lowStockProducts = products.filter(p => p.stock < 5).length;

		return {
			revenue: totalRevenue,
			totalOrders: orders.length,
			pendingOrders,
			totalProducts: products.length,
			lowStockProducts,
			totalUsers: userStats.total,
			activeUsers: 'N/A' // Active users count not available with pagination
		};
	}, [orders, products, userStats]);

	// Analytics: Sales by period
	const salesByPeriod = useMemo(() => {
		const now = new Date();
		const periods = [];
		const periodCount = salesPeriod === 'day' ? 7 : salesPeriod === 'week' ? 8 : salesPeriod === 'month' ? 6 : 12;

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

			const periodOrders = orders.filter(order => {
				if (order.status === 'cancelled' || order.status === 'refund') return false;
				const orderDate = new Date(order.created_at);
				
				if (salesPeriod === 'day') {
					return orderDate.toDateString() === periodDate.toDateString();
				} else if (salesPeriod === 'week') {
					const weekStart = new Date(periodDate);
					weekStart.setDate(periodDate.getDate() - periodDate.getDay());
					const weekEnd = new Date(weekStart);
					weekEnd.setDate(weekStart.getDate() + 6);
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
	}, [orders, salesPeriod]);

	// Analytics: Top selling products
	const topSellingProducts = useMemo(() => {
		const productSales = {};
		
		orders.forEach(order => {
			if (order.status === 'cancelled' || order.status === 'refund') return;
			(order.items || []).forEach(item => {
				if (!productSales[item.product_id]) {
					productSales[item.product_id] = {
						productId: item.product_id,
						name: item.product_name || 'Producto desconocido',
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
				const maxRevenue = productSales[Object.keys(productSales)[0]]?.revenue || 1;
				return {
					...product,
					percentage: (product.revenue / Object.values(productSales).reduce((sum, p) => sum + p.revenue, 0)) * 100,
					rank: index + 1
				};
			});
	}, [orders, topProductsLimit]);

	// Recent orders for overview
	const recentOrders = useMemo(() => {
		return [...orders]
			.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
			.slice(0, 5);
	}, [orders]);

	const loadOrders = async (page = 1) => {
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
	};

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
						<span>Vista completa de tu negocio</span>
					</div>
					
					{/* KPI Cards */}
					<div className="stats-grid">
						<div className="stat-card revenue">
							<div className="stat-icon">💰</div>
							<div className="stat-info">
								<h4>Ingresos Totales</h4>
								<p className="stat-value">${stats.revenue.toFixed(2)}</p>
								<span className="stat-sub">En {stats.totalOrders} órdenes</span>
							</div>
						</div>

						<div className="stat-card orders">
							<div className="stat-icon">🛍️</div>
							<div className="stat-info">
								<h4>Órdenes Pendientes</h4>
								<p className="stat-value">{stats.pendingOrders}</p>
								<span className="stat-sub">De {stats.totalOrders} totales</span>
							</div>
						</div>

						<div className="stat-card products">
							<div className="stat-icon">📦</div>
							<div className="stat-info">
								<h4>Productos</h4>
								<p className="stat-value">{stats.totalProducts}</p>
								<span className="stat-sub">{stats.lowStockProducts} con stock bajo</span>
							</div>
						</div>

						<div className="stat-card users">
							<div className="stat-icon">👥</div>
							<div className="stat-info">
								<h4>Usuarios</h4>
								<p className="stat-value">{stats.totalUsers}</p>
								<span className="stat-sub">Registrados</span>
							</div>
						</div>
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
										<div key={index} className="bar-wrapper">
											<div className="bar-label-top">${period.revenue.toFixed(0)}</div>
											<div className="bar-column">
												<div 
													className="bar-fill"
													style={{ height: `${period.percentage}%` }}
													title={`${period.label}: $${period.revenue.toFixed(2)} (${period.orders} órdenes)`}
												/>
											</div>
											<div className="bar-label">{period.label}</div>
										</div>
									))}
								</div>
								<div className="chart-summary">
									<span>Total del período: <strong>${salesByPeriod.reduce((sum, p) => sum + p.revenue, 0).toFixed(2)}</strong></span>
									<span>Promedio: <strong>${(salesByPeriod.reduce((sum, p) => sum + p.revenue, 0) / salesByPeriod.length).toFixed(2)}</strong></span>
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
											<div className="product-info">
												<div className="product-name">{product.name}</div>
												<div className="product-stats">
													<span className="quantity">{product.quantity} vendidos</span>
													<span className="revenue">${product.revenue.toFixed(2)}</span>
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
												<span className="order-total">${order.total.toFixed(2)}</span>
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
				/>
			)}

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
                    onPageChange={(page) => loadOrders(page)}
				/>
			)}

			{/* Users Tab */}
			{activeTab === 'users' && (
				<UserList onStatsUpdate={setUserStats} />
			)}
		</div>
	);
}
