import React, { useState, useEffect } from 'react';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { toast } from 'react-hot-toast';
import './UserProfile.css';

function UserProfile({ onClose, onLogout, onUpdate, user }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isHeroEditing, setIsHeroEditing] = useState(false);
    const [showPasswordText, setShowPasswordText] = useState(false);
    
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

    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: user.name || prev.name,
                email: user.email || prev.email,
                phone: user.phone || prev.phone,
                street: user.street || prev.street,
                sector: user.sector || prev.sector,
                city: user.city || prev.city,
                country: user.country || prev.country
            }));
            setLoading(false);
        }
    }, [user]);

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

    const hasInitialData = Boolean(formData.name || formData.email);

    if (loading && !hasInitialData) return (
        <div className="profile-page-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <div className="loading-spinner"></div>
        </div>
    );

    return (
        <main className="profile-page">
            <section className="profile-hero">
                <div className="container profile-hero-content">
                    <div>
                        <p className="profile-kicker">Cuenta y seguridad</p>
                        <h2>Mi perfil</h2>
                        <p className="profile-subtitle">Actualiza tus datos personales, dirección y contraseña en un solo lugar.</p>
                        <div className="profile-actions">
                            <button type="button" onClick={onLogout} className="profile-btn profile-btn-outline">
                                Cerrar sesión
                            </button>
                            <button type="button" onClick={onClose} className="profile-btn">
                                Volver
                            </button>
                        </div>
                    </div>
                    <div className="profile-hero-card">
                        <div className="profile-hero-top">
                            <div className="avatar-large">
                                {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div className="profile-hero-actions">
                                {isHeroEditing && (
                                    <button
                                        type="submit"
                                        form="profile-form"
                                        className="hero-save-btn"
                                    >
                                        Guardar
                                    </button>
                                )}
                                <button
                                    className="close-btn-compact"
                                    onClick={() => setIsHeroEditing((prev) => !prev)}
                                    type="button"
                                    aria-label={isHeroEditing ? 'Cerrar edición' : 'Editar'}
                                    title="Editar"
                                >🖋</button>
                            </div>
                        </div>
                        {isHeroEditing ? (
                            <div className="profile-hero-edit">
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Nombre completo"
                                    className="compact-input"
                                    disabled
                                />
                                <input
                                    type="email"
                                    value={formData.email}
                                    className="compact-input"
                                    disabled
                                />
                                <div className="input-group">
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        placeholder="Teléfono"
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
                                        name="street"
                                        value={formData.street}
                                        onChange={handleInputChange}
                                        placeholder="Dirección"
                                        className="compact-input"
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
                                <h3>{formData.name}</h3>
                                <p>{formData.email}</p>
                                <div className="profile-hero-stats">
                                    <div>
                                        <span>{formData.phone || 'Sin teléfono'}</span>
                                        <small>Contacto</small>
                                    </div>
                                    <div>
                                        <span>{formData.city || 'Sin ciudad'}</span>
                                        <small>Ciudad</small>
                                    </div>
                                    <div>
                                        <span>{formData.sector || 'Sin sector'}</span>
                                        <small>Sector</small>
                                    </div>
                                    <div>
                                        <span>{formData.street || 'Sin dirección'}</span>
                                        <small>Dirección</small>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </section>

            <section className="profile-content">
                <div className="container">
                    <form id="profile-form" onSubmit={handleSubmit} className="profile-form">
                        <div className="profile-grid">
                            <div className="profile-card">
                                <h3>Información personal</h3>
                                <div className="form-section">
                                    <label className="section-label">Dirección de envío</label>
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
                            </div>

                            <div className="profile-card">
                                <h3>Agregar método de pago</h3>
                                <p className="profile-card-hint">Guarda tu método preferido para agilizar tus compras.</p>
                                <div className="form-section">
                                    <label className="section-label">Detalles de la tarjeta</label>
                                    <input
                                        type="text"
                                        name="cardHolder"
                                        placeholder="Nombre en la tarjeta"
                                        className="compact-input full-width"
                                    />
                                    <input
                                        type="text"
                                        name="cardNumber"
                                        placeholder="Número de tarjeta"
                                        className="compact-input full-width"
                                    />
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            name="cardExpiry"
                                            placeholder="MM/AA"
                                            className="compact-input"
                                        />
                                        <input
                                            type="text"
                                            name="cardCvc"
                                            placeholder="CVC"
                                            className="compact-input"
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        name="cardId"
                                        placeholder="Cédula / ID (Opcional)"
                                        className="compact-input full-width"
                                    />
                                    <button type="button" className="save-btn-compact" disabled title="Función no disponible">
                                        Agregar
                                    </button>
                                </div>
                            </div>

                            <div className="profile-card">
                                <h3>Seguridad y acceso</h3>
                                <p className="profile-card-hint">Gestiona tu contraseña y mantén tu cuenta protegida.</p>
                                <div className="form-section security-section">
                                    <div className="security-header">
                                        <div>
                                            <span className="security-title">Contraseña</span>
                                            <span className="security-subtitle">Actualiza tu clave si lo necesitas.</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="toggle-password-btn"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? 'Cerrar' : '🔒 Cambiar'}
                                        </button>
                                    </div>

                                    {showPassword && (
                                        <div className="password-fields">
                                            <div className="password-visibility">
                                                <span>Mostrar contraseñas</span>
                                                <button
                                                    type="button"
                                                    className="password-eye-btn"
                                                    onClick={() => setShowPasswordText((prev) => !prev)}
                                                    aria-label={showPasswordText ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                                                >
                                                    {showPasswordText ? 'Ocultar' : 'Mostrar'}
                                                </button>
                                            </div>
                                            <input
                                                type={showPasswordText ? 'text' : 'password'}
                                                name="currentPassword"
                                                value={formData.currentPassword}
                                                onChange={handleInputChange}
                                                placeholder="Contraseña actual"
                                                className="compact-input full-width"
                                            />
                                            <div className="input-group stack">
                                                <input
                                                    type={showPasswordText ? 'text' : 'password'}
                                                    name="newPassword"
                                                    value={formData.newPassword}
                                                    onChange={handleInputChange}
                                                    placeholder="Nueva contraseña"
                                                    className="compact-input"
                                                />
                                                <input
                                                    type={showPasswordText ? 'text' : 'password'}
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
                                    <button type="submit" className="save-btn-compact" disabled={saving}>
                                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </section>
        </main>
    );
}

export default UserProfile;
