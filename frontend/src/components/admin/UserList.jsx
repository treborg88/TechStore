import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../common/LoadingSpinner';

// Cache key and TTL for users list (2 minutes)
const USERS_CACHE_KEY = 'admin_users_cache';
const USERS_CACHE_TTL = 2 * 60 * 1000;

export default function UserList({ onStatsUpdate }) {
    const [users, setUsers] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [userFilters, setUserFilters] = useState({ search: '', role: 'all', status: 'all', type: 'all' });
    const [usersPagination, setUsersPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Create user form state
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'customer' });
    const [showPassword, setShowPassword] = useState(false);

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

    const loadUsers = useCallback(async (page = 1, { skipCache = false } = {}) => {
        try {
            setIsLoadingUsers(true);
            const queryParams = new URLSearchParams({
                page: page,
                limit: usersPagination.limit,
                search: userFilters.search,
                role: userFilters.role,
                status: userFilters.status
            });
            const cacheKey = `${USERS_CACHE_KEY}_${queryParams}`;

            // Try reading from cache unless forced refresh
            if (!skipCache) {
                try {
                    const cached = localStorage.getItem(cacheKey);
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        if (Date.now() - parsed.timestamp < USERS_CACHE_TTL) {
                            setUsers(parsed.data);
                            setUsersPagination(prev => ({ ...prev, ...parsed.pagination }));
                            if (onStatsUpdate) onStatsUpdate({ total: parsed.pagination.total });
                            setIsLoadingUsers(false);
                            return;
                        }
                    }
                } catch { /* ignore corrupt cache */ }
            }

            const response = await apiFetch(apiUrl(`/users?${queryParams}`), {
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 403) {
                    throw new Error('Acceso denegado. Solo los administradores pueden ver esta sección.');
                }
                throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            setUsers(result.data);
            const pag = { page: result.page, total: result.total, totalPages: result.totalPages };
            setUsersPagination(prev => ({ ...prev, ...pag }));

            // Persist to cache
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    timestamp: Date.now(), data: result.data, pagination: pag
                }));
            } catch { /* storage full — ignore */ }

            if (onStatsUpdate) onStatsUpdate({ total: result.total });

        } catch (error) {
            console.error('Error cargando usuarios:', error);
            toast.error(error.message);
        } finally {
            setIsLoadingUsers(false);
        }
    }, [usersPagination.limit, userFilters, onStatsUpdate]);

    // Initial load and filter changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadUsers(1);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [userFilters, loadUsers]);

    const handleRoleChange = async (userId, newRole) => {
        const confirmed = await confirmAction(`¿Cambiar el rol de este usuario a "${newRole}"?`);
        if (!confirmed) {
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await apiFetch(apiUrl(`/users/${userId}/role`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: newRole })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Error al actualizar el rol');
            }

            toast.success('Rol actualizado correctamente');
            await loadUsers(usersPagination.page);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStatusToggle = async (userId, currentStatus) => {
        const newStatus = !currentStatus;
        const action = newStatus ? 'activar' : 'desactivar';

        const confirmed = await confirmAction(`¿Deseas ${action} este usuario?`);
        if (!confirmed) {
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await apiFetch(apiUrl(`/users/${userId}/status`), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_active: newStatus })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Error al actualizar el estado');
            }

            toast.success(`Usuario ${action} correctamente`);
            await loadUsers(usersPagination.page);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Create a new user from admin panel
    const handleCreateUser = async (e) => {
        e.preventDefault();
        const { name, email, password, role } = newUser;

        // Client-side validation
        if (!name.trim() || !email.trim() || !password) {
            toast.error('Todos los campos son requeridos');
            return;
        }
        if (password.length < 8) {
            toast.error('La contraseña debe tener al menos 8 caracteres');
            return;
        }

        try {
            setIsSubmitting(true);
            const response = await apiFetch(apiUrl('/users'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role })
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'Error al crear usuario');
            }

            toast.success('Usuario creado exitosamente');
            setNewUser({ name: '', email: '', password: '', role: 'customer' });
            setShowCreateForm(false);
            await loadUsers(1, { skipCache: true });
        } catch (error) {
            toast.error(error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="admin-section">
            <div className="admin-section-header">
                <h3>Gestión de Usuarios y Accesos</h3>
                <span>
                    {users.length} / {usersPagination.total} usuarios
                    {/* Refresh button — forces fresh DB fetch */}
                    <button
                        type="button"
                        className="admin-btn ghost refresh-btn"
                        onClick={() => loadUsers(usersPagination.page, { skipCache: true })}
                        disabled={isLoadingUsers}
                        title="Actualizar datos"
                    >
                        🔄
                    </button>
                </span>
            </div>

            {/* Toggle create-user form */}
            <div className="create-user-toggle">
                <button
                    type="button"
                    className={`admin-btn ${showCreateForm ? 'danger' : 'primary'}`}
                    onClick={() => setShowCreateForm(!showCreateForm)}
                >
                    {showCreateForm ? '✕ Cancelar' : '＋ Nuevo Usuario'}
                </button>
            </div>

            {/* Collapsible create user form */}
            {showCreateForm && (
                <form className="create-user-form" onSubmit={handleCreateUser}>
                    <div className="create-user-grid">
                        <div className="filter-field">
                            <label htmlFor="new-user-name">Nombre *</label>
                            <input
                                id="new-user-name"
                                type="text"
                                placeholder="Nombre completo"
                                value={newUser.name}
                                onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="filter-field">
                            <label htmlFor="new-user-email">Email *</label>
                            <input
                                id="new-user-email"
                                type="email"
                                placeholder="correo@ejemplo.com"
                                value={newUser.email}
                                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="filter-field">
                            <label htmlFor="new-user-password">Contraseña *</label>
                            <div className="password-input-wrapper">
                                <input
                                    id="new-user-password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Mínimo 8 caracteres"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                                    minLength={8}
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? '🙈' : '👁️'}
                                </button>
                            </div>
                        </div>
                        <div className="filter-field">
                            <label htmlFor="new-user-role">Rol</label>
                            <select
                                id="new-user-role"
                                value={newUser.role}
                                onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                            >
                                <option value="customer">Cliente</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>
                    </div>
                    <div className="create-user-actions">
                        <button type="submit" className="admin-btn primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Creando…' : '✓ Crear Usuario'}
                        </button>
                    </div>
                </form>
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
                <div className="filter-field">
                    <label htmlFor="user-type">Tipo</label>
                    <select
                        id="user-type"
                        value={userFilters.type}
                        onChange={(event) => setUserFilters((prev) => ({ ...prev, type: event.target.value }))}
                    >
                        <option value="all">Todos</option>
                        <option value="customer">Clientes</option>
                        <option value="guest">Invitados</option>
                    </select>
                </div>
            </div>

            {isLoadingUsers ? (
                <div className="admin-empty"><LoadingSpinner /></div>
            ) : users.length === 0 ? (
                <div className="admin-empty">No hay usuarios que coincidan con el filtro actual.</div>
            ) : (
                <>
                    {/* Desktop table — hidden on mobile */}
                    <div className="admin-table-container users-desktop">
                        <table className="admin-table users-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nombre</th>
                                    <th>Email</th>
                                    <th>Tipo</th>
                                    <th>Rol</th>
                                    <th>Estado</th>
                                    <th>Registro</th>
                                    <th>Último Acceso</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td data-label="ID">{user.id}</td>
                                        <td className="admin-table-name" data-label="Nombre">{user.name}</td>
                                        <td data-label="Email">{user.email}</td>
                                        <td data-label="Tipo">
                                            <span className={`admin-chip ${user.is_guest ? 'guest-badge' : 'customer-badge'}`}>
                                                {user.is_guest ? '👤 Invitado' : '✅ Cliente'}
                                            </span>
                                        </td>
                                        <td data-label="Rol">
                                            <span className={`admin-chip ${user.role === 'admin' ? 'role-admin' : 'role-customer'}`}>
                                                {user.role === 'admin' ? '👑 Admin' : '👤 Cliente'}
                                            </span>
                                        </td>
                                        <td data-label="Estado">
                                            <span className={`admin-stock ${user.is_active ? 'in-stock' : 'out-stock'}`}>
                                                {user.is_active ? '✓ Activo' : '✗ Inactivo'}
                                            </span>
                                        </td>
                                        <td data-label="Registro">{new Date(user.created_at).toLocaleDateString()}</td>
                                        <td data-label="Último Acceso">
                                            {user.last_login 
                                                ? new Date(user.last_login).toLocaleString()
                                                : 'Nunca'
                                            }
                                        </td>
                                        <td className="admin-table-actions" data-label="Acciones">
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

                    {/* Mobile compact list — one row per user */}
                    <div className="users-mobile">
                        {users.map((user) => (
                            <div key={user.id} className="user-mobile-row">
                                {/* Main info line */}
                                <div className="user-mobile-main">
                                    <span className={`user-mobile-status ${user.is_active ? 'active' : 'inactive'}`} />
                                    <span className="user-mobile-name">{user.name}</span>
                                    <span className={`admin-chip mini ${user.role === 'admin' ? 'role-admin' : 'role-customer'}`}>
                                        {user.role === 'admin' ? '👑' : '👤'}
                                    </span>
                                </div>
                                {/* Secondary line: email + date */}
                                <div className="user-mobile-sub">
                                    <span className="user-mobile-email">{user.email}</span>
                                    <span className="user-mobile-date">{new Date(user.created_at).toLocaleDateString()}</span>
                                </div>
                                {/* Actions */}
                                <div className="user-mobile-actions">
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
                                        className={`admin-btn mini ${user.is_active ? 'danger' : 'ghost'}`}
                                        onClick={() => handleStatusToggle(user.id, user.is_active)}
                                        disabled={isSubmitting}
                                    >
                                        {user.is_active ? 'Desactivar' : 'Activar'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
            
            {/* Pagination Controls */}
            <div className="pagination-controls">
                <button 
                    className="admin-btn ghost"
                    disabled={usersPagination.page === 1}
                    onClick={() => loadUsers(usersPagination.page - 1)}
                >
                    &laquo; Anterior
                </button>
                <span>Página {usersPagination.page} de {usersPagination.totalPages}</span>
                <button 
                    className="admin-btn ghost"
                    disabled={usersPagination.page === usersPagination.totalPages}
                    onClick={() => loadUsers(usersPagination.page + 1)}
                >
                    Siguiente &raquo;
                </button>
            </div>
        </section>
    );
}