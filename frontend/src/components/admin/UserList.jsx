import { useState, useEffect, useCallback } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../common/LoadingSpinner';

export default function UserList({ onStatsUpdate }) {
    const [users, setUsers] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [userFilters, setUserFilters] = useState({ search: '', role: 'all', status: 'all', type: 'all' });
    const [usersPagination, setUsersPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const loadUsers = useCallback(async (page = 1) => {
        try {
            setIsLoadingUsers(true);
            const queryParams = new URLSearchParams({
                page: page,
                limit: usersPagination.limit,
                search: userFilters.search,
                role: userFilters.role,
                status: userFilters.status
            });

            const response = await apiFetch(apiUrl(`/users?${queryParams}`), {
                headers: {
                    'Content-Type': 'application/json'
                }
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
            setUsersPagination(prev => ({
                ...prev,
                page: result.page,
                total: result.total,
                totalPages: result.totalPages
            }));

            if (onStatsUpdate) {
                onStatsUpdate({ total: result.total });
            }

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
        }, 500); // Debounce search
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

    return (
        <section className="admin-section">
            <div className="admin-section-header">
                <h3>Gestión de Usuarios y Accesos</h3>
                <span>
                    {users.length} / {usersPagination.total} usuarios
                </span>
            </div>

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
                <div className="admin-table-container">
                    <table className="admin-table">
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