import React, { useState, useEffect } from 'react';
import { apiFetch, apiUrl } from '../services/apiClient';
import { toast } from 'react-hot-toast';
import '../styles/UserProfile.css';

function UserProfile({ onClose, onLogout, onUpdate, user }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        street: '',
        sector: '',
        city: '',
        country: 'Republica Dominicana',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    useEffect(() => {
        loadUserProfile();
    }, []);

    const loadUserProfile = async () => {
        try {
            setLoading(true);
            const response = await apiFetch(apiUrl('/auth/me'));

            if (response.ok) {
                const userData = await response.json();
                setFormData(prev => ({
                    ...prev,
                    name: userData.name || '',
                    email: userData.email || '',
                    phone: userData.phone || '',
                    street: userData.street || '',
                    sector: userData.sector || '',
                    city: userData.city || '',
                    country: userData.country || 'Republica Dominicana'
                }));
            } else {
                if (response.status === 401 || response.status === 403) {
                    toast.error('Sesión expirada');
                    onLogout();
                }
            }
        } catch (error) {
            console.error('Error loading profile:', error);
            toast.error('Error al cargar perfil');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        // Validate password if changing
        if (showPassword) {
            if (formData.newPassword !== formData.confirmPassword) {
                toast.error('Las contraseñas nuevas no coinciden');
                setSaving(false);
                return;
            }
            if (!formData.currentPassword) {
                toast.error('Ingresa tu contraseña actual');
                setSaving(false);
                return;
            }
            if (formData.newPassword.length < 6) {
                toast.error('La contraseña debe tener al menos 6 caracteres');
                setSaving(false);
                return;
            }
        }

        if (!formData.name.trim()) {
            toast.error('El nombre es requerido');
            setSaving(false);
            return;
        }

        try {
            const payload = {
                name: formData.name,
                phone: formData.phone,
                street: formData.street,
                sector: formData.sector,
                city: formData.city,
                country: formData.country
            };

            if (showPassword && formData.newPassword) {
                payload.currentPassword = formData.currentPassword;
                payload.newPassword = formData.newPassword;
            }

            const response = await apiFetch(apiUrl('/auth/profile'), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                // Update local storage user data just in case
                localStorage.setItem('userData', JSON.stringify(data.user));
                
                // Update parent state
                if (onUpdate) {
                    onUpdate(data.user);
                }

                toast.success('Perfil actualizado');
                if (showPassword) {
                    setFormData(prev => ({
                        ...prev,
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: ''
                    }));
                    setShowPassword(false);
                }
            } else {
                const error = await response.json();
                toast.error(error.message || 'Error al actualizar');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            toast.error('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="profile-page-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <div className="loading-spinner"></div>
        </div>
    );

    return (
        <div className="profile-page" style={{ padding: '40px 20px', display: 'flex', justifyContent: 'center' }}>
            <div className="compact-profile">
                <div className="profile-header-compact">
                    <div className="avatar-small">
                        {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div className="header-info">
                        <h3>{formData.name}</h3>
                        <span className="email-badge">{formData.email}</span>
                    </div>
                    <button 
                        className="close-btn-compact" 
                        onClick={onClose}
                        type="button"
                        aria-label="Cerrar"
                    >✖</button>
                </div>

                <form onSubmit={handleSubmit} className="compact-form">
                    <div className="form-section">
                        <label className="section-label">Información Personal</label>
                        <div className="input-group">
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                placeholder="Nombre completo"
                                className="compact-input"
                                required
                            />
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                placeholder="Teléfono"
                                className="compact-input"
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <label className="section-label">Dirección de Envío</label>
                        <input
                            type="text"
                            name="street"
                            value={formData.street}
                            onChange={handleInputChange}
                            placeholder="Calle y número"
                            className="compact-input full-width"
                        />
                        <div className="input-group">
                            <input
                                type="text"
                                name="sector"
                                value={formData.sector}
                                onChange={handleInputChange}
                                placeholder="Sector"
                                className="compact-input"
                            />
                            <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleInputChange}
                                placeholder="Ciudad"
                                className="compact-input"
                            />
                        </div>
                    </div>

                    <div className="form-section security-section">
                        <button 
                            type="button" 
                            className="toggle-password-btn"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? 'Cancelar cambio de contraseña' : '🔒 Cambiar contraseña'}
                        </button>
                        
                        {showPassword && (
                            <div className="password-fields">
                                <input
                                    type="password"
                                    name="currentPassword"
                                    value={formData.currentPassword}
                                    onChange={handleInputChange}
                                    placeholder="Contraseña actual"
                                    className="compact-input full-width"
                                />
                                <div className="input-group">
                                    <input
                                        type="password"
                                        name="newPassword"
                                        value={formData.newPassword}
                                        onChange={handleInputChange}
                                        placeholder="Nueva contraseña"
                                        className="compact-input"
                                    />
                                    <input
                                        type="password"
                                        name="confirmPassword"
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                        placeholder="Confirmar"
                                        className="compact-input"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="form-actions">
                        <button type="button" onClick={onLogout} className="logout-btn-compact">
                            Cerrar Sesión
                        </button>
                        <button type="submit" className="save-btn-compact" disabled={saving}>
                            {saving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default UserProfile;
