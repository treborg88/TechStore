// OrderTracker.jsx - Página de rastreo de órdenes
// Un solo archivo minimalista siguiendo el patrón de Contact.jsx

import { useState, useEffect, useMemo } from 'react';
import { apiFetch, apiUrl } from '../services/apiClient';
import { formatCurrency } from '../utils/formatCurrency';
import Invoice from '../components/common/Invoice';
import { API_URL } from '../config';
import '../components/orders/OrderTracker.css';

// Configuración de estados
const STATUS_MAP = {
  pending_payment: { text: 'Pendiente de Pago', icon: '⏳' },
  paid: { text: 'Pagado', icon: '💰' },
  to_ship: { text: 'Para Enviar', icon: '📦' },
  shipped: { text: 'Enviado', icon: '🚚' },
  delivered: { text: 'Entregado', icon: '✅' },
  return: { text: 'Devolución', icon: '↩️' },
  refund: { text: 'Reembolso', icon: '💸' },
  cancelled: { text: 'Cancelado', icon: '❌' },
  pending: { text: 'Pendiente', icon: '⏳' },
  processing: { text: 'Procesando', icon: '⚙️' }
};

const COMPLETED_STATUSES = ['delivered', 'cancelled', 'refund'];
const ORDERS_PER_PAGE = 10;

export default function OrderTracker({ user, currencyCode = 'USD', siteName = 'Mi Tienda Online', siteIcon = '🛒' }) {
  // Estado principal
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('id');
  const [filter, setFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isSearchResult, setIsSearchResult] = useState(false);

  // Cargar órdenes del usuario al montar
  useEffect(() => {
    if (user) loadUserOrders();
  }, [user]);

  // Cargar órdenes del usuario logueado
  const loadUserOrders = async () => {
    setLoading(true);
    setError('');
    setIsSearchResult(false);
    try {
      const res = await apiFetch(apiUrl('/orders/my'));
      if (res.ok) setOrders(await res.json());
    } catch {
      setError('Error al cargar órdenes');
    } finally {
      setLoading(false);
    }
  };

  // Buscar orden
  const handleSearch = async (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return setError('Ingresa un valor de búsqueda');
    
    // Validar código completo (formato W-YYMMDD-XXXXX) o email
    if (searchType === 'id') {
      const isValidFormat = /^[A-Z]-\d{6}-\d{5}$/.test(query);
      if (!isValidFormat) {
        return setError(`Número de orden inválido "${query}". El formato correcto debe ser W-YYMMDD-XXXXX (ejemplo: W-240115-00001)`);
      }
    } else if (searchType === 'email') {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query);
      if (!isEmail) {
        return setError('Ingresa un correo electrónico válido');
      }
    }

    setLoading(true);
    setError('');
    setIsSearchResult(true);
    
    try {
      const endpoint = searchType === 'id' 
        ? `/orders/track/${encodeURIComponent(query)}`
        : `/orders/track/email/${encodeURIComponent(query)}`;
      
      const res = await apiFetch(apiUrl(endpoint));
      
      if (!res.ok) {
        setOrders([]);
        return setError(res.status === 404 ? 'No se encontraron órdenes' : 'Error al buscar');
      }
      
      const data = await res.json();
      setOrders(searchType === 'id' ? [data] : data);
      setPage(1);
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // Limpiar búsqueda
  const clearSearch = () => {
    setSearchQuery('');
    setError('');
    setIsSearchResult(false);
    setPage(1);
    if (user) loadUserOrders();
    else setOrders([]);
  };

  // Filtrar y paginar órdenes
  const filteredOrders = useMemo(() => {
    if (isSearchResult) return orders;
    if (filter === 'completed') return orders.filter(o => COMPLETED_STATUSES.includes(o.status));
    if (filter === 'active') return orders.filter(o => !COMPLETED_STATUSES.includes(o.status));
    return orders;
  }, [orders, filter, isSearchResult]);

  const totalPages = Math.ceil(filteredOrders.length / ORDERS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice((page - 1) * ORDERS_PER_PAGE, page * ORDERS_PER_PAGE);

  // Formatear fecha
  const formatDate = (date) => new Date(date).toLocaleDateString('es-ES', { 
    year: 'numeric', month: 'short', day: 'numeric' 
  });

  // Obtener URL de imagen
  const getImageUrl = (img) => {
    if (!img) return 'https://placehold.co/60x60?text=?';
    if (img.startsWith('http')) return img;
    return `${API_URL.replace('/api', '')}${img.startsWith('/') ? img : `/images/${img}`}`;
  };

  return (
    <main className="tracker-page">
      {/* Hero */}
      <section className="tracker-hero">
        <div className="container tracker-hero-content">
          <div>
            <p className="tracker-kicker">Seguimiento en tiempo real</p>
            <h1>Rastrea Tu Pedido</h1>
            <p className="tracker-subtitle">
              {user ? 'Consulta tus órdenes o busca por número de pedido' : 'Ingresa el código completo de tu orden'}
            </p>
          </div>
          <div className="tracker-hero-card">
            <h3>📍 Estado de Envíos</h3>
            <p>Información actualizada al instante</p>
            <div className="tracker-hero-stats">
              <div><span>🕐</span><small>24/7</small></div>
              <div><span>⚡</span><small>Tiempo real</small></div>
              <div><span>📦</span><small>{user ? filteredOrders.length : '100%'}</small></div>
            </div>
          </div>
        </div>
      </section>

      {/* Contenido */}
      <section className="tracker-content">
        <div className="container">
          {/* Búsqueda */}
          <div className="tracker-card">
            <form onSubmit={handleSearch} className="tracker-search">
              <div className="search-types">
                <button type="button" className={searchType === 'id' ? 'active' : ''} 
                  onClick={() => { setSearchType('id'); setSearchQuery(''); }}>
                  🔢 Por Número
                </button>
                <button type="button" className={searchType === 'email' ? 'active' : ''} 
                  onClick={() => { setSearchType('email'); setSearchQuery(''); }}>
                  📧 Por Email
                </button>
              </div>
              <div className="search-input-row">
                <input
                  type={searchType === 'email' ? 'email' : 'text'}
                  placeholder={searchType === 'id' ? 'Código completo: W-YYMMDD-XXXXX' : 'tu@email.com'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={loading}
                />
                <button type="submit" disabled={loading} title="Buscar orden">
                  {loading ? '⏳' : '🔍'}
                </button>
                {isSearchResult && <button type="button" onClick={clearSearch} className="clear-btn">✕</button>}
              </div>
              {error && <p className="search-error">⚠️ {error}</p>}
            </form>
          </div>

          {/* Filtros (solo usuarios logueados) */}
          {user && !isSearchResult && (
            <div className="tracker-filters">
              <span>{filteredOrders.length} {filteredOrders.length === 1 ? 'orden' : 'órdenes'}</span>
              <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }}>
                <option value="active">🔄 Activas</option>
                <option value="all">📋 Todas</option>
                <option value="completed">✅ Completadas</option>
              </select>
            </div>
          )}

          {/* Lista de órdenes */}
          {loading ? (
            <div className="tracker-loading">⏳ Cargando...</div>
          ) : paginatedOrders.length > 0 ? (
            <>
              <div className="orders-list">
                {paginatedOrders.map((order) => (
                  <div key={order.id} className="order-row" onClick={() => setSelectedOrder(order)}>
                    <span className={`status-dot status-${order.status}`} title={STATUS_MAP[order.status]?.text}></span>
                    <div className="order-main">
                      <strong>{order.order_number || `#${order.id}`}</strong>
                      <small>{formatDate(order.created_at)}</small>
                    </div>
                    <span className="order-total">{formatCurrency(order.total, currencyCode)}</span>
                    <span className="order-arrow">›</span>
                  </div>
                ))}
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="tracker-pagination">
                  <button onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Anterior</button>
                  <span>{page} de {totalPages}</span>
                  <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Siguiente →</button>
                </div>
              )}
            </>
          ) : (
            <div className="tracker-empty">
              <p>📭</p>
              <h4>No hay órdenes</h4>
              <p>{!user && !isSearchResult ? 'Ingresa un código para buscar' : 'No se encontraron resultados'}</p>
            </div>
          )}
        </div>
      </section>

      {/* Modal de detalles */}
      {selectedOrder && (
        <div className="order-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="order-modal invoice-mode" onClick={(e) => e.stopPropagation()}>
            {/* Back button header */}
            <div className="modal-back-header">
              <button 
                className="modal-back-btn" 
                onClick={() => setSelectedOrder(null)}
                title="Volver"
                aria-label="Cerrar detalles de orden"
              >
                ← Volver
              </button>
            </div>
            <div style={{ height: '100%', overflowY: 'auto' }}>
              
                <Invoice 
                    order={selectedOrder}
                    
                    customerInfo={{
                        firstName: selectedOrder.customer_name ? selectedOrder.customer_name.split(' ')[0] : '',
                        lastName: selectedOrder.customer_name ? selectedOrder.customer_name.split(' ').slice(1).join(' ') : '',
                        email: selectedOrder.customer_email || selectedOrder.email,
                        address: selectedOrder.shipping_street || selectedOrder.shipping_address,
                        sector: selectedOrder.shipping_sector,
                        city: selectedOrder.shipping_city,
                        phone: selectedOrder.customer_phone || selectedOrder.phone,
                        paymentMethod: selectedOrder.payment_method
                        
                    }}
                    items={selectedOrder.items || []}
                    onClose={() => setSelectedOrder(null)}
                    showSuccess={false}
                    siteName={siteName}
                    siteIcon={siteIcon}
                    currencyCode={currencyCode}
                    
                />
                
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
