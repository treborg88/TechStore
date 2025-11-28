import React, { useState } from "react";
import { login, register } from '../services/authService';
import { toast } from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

export default function LoginPage({ onLoginSuccess, onBackToHome }) {
const [isRegister, setIsRegister] = useState(false);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [formData, setFormData] = useState({
    nombre: "",
    email: "",
    password: "",
    confirmPassword: ""
});

const handleChange = (e) => {
    setFormData({
    ...formData,
    [e.target.name]: e.target.value
    });
    // Limpiar error cuando el usuario empiece a escribir
    if (error) {
    setError('');
    }
};

    const validateForm = () => {
        if (isRegister) {
        if (!formData.nombre.trim()) {
            toast.error('El nombre es requerido');
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            toast.error('Las contraseñas no coinciden');
            return false;
        }
        if (formData.password.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres');
            return false;
        }
        }
        
        if (!formData.email.includes('@')) {
        toast.error('Por favor ingresa un email válido');
        return false;
        }
        
        if (!formData.password.trim()) {
        toast.error('La contraseña es requerida');
        return false;
        }
        
        return true;
    };
const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
    return;
    }

    setLoading(true);
    setError('');

    try {
    if (isRegister) {
        const userData = await register(formData.nombre, formData.email, formData.password);
        toast.success('¡Cuenta creada exitosamente!');
        onLoginSuccess(userData);
    } else {
        const userData = await login(formData.email, formData.password);
        toast.success('¡Bienvenido de nuevo!');
        onLoginSuccess(userData);
    }
    } catch (err) {
    const msg = err.message || 'Ha ocurrido un error. Inténtalo de nuevo.';
    setError(msg);
    toast.error(msg);
    } finally {
    setLoading(false);
    }
};

const toggleMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setFormData({
    nombre: "",
    email: "",
    password: "",
    confirmPassword: ""
    });
};

const handleBackToHome = () => {
    if (onBackToHome) {
    onBackToHome();
    }
};

return (
    <div className="login-page">
    <div className="login-container">
        {/* Header con opción de volver */}
        <div className="login-header">
        <button 
            className="back-button" 
            onClick={handleBackToHome}
            type="button"
            aria-label="Volver a la página principal"
        >
            ← Volver a TechStore
        </button>
        </div>

        {/* Contenido del formulario */}
        <div className="login-content">
        <div className="login-logo">
            <h1>🛍️ TechStore</h1>
        </div>

        <h2 className="login-title">
            {isRegister ? "Crear Nueva Cuenta" : "Bienvenido de Nuevo"}
        </h2>
        
        <p className="login-subtitle">
            {isRegister 
            ? "Únete a nuestra comunidad y disfruta de ofertas exclusivas" 
            : "Inicia sesión para continuar con tus compras"
            }
        </p>

        {error && (
            <div className="error-message" role="alert">
            ⚠️ {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
            {isRegister && (
            <div className="form-group">
                <label htmlFor="nombre">Nombre completo</label>
                <input
                id="nombre"
                type="text"
                name="nombre"
                placeholder="Ingresa tu nombre completo"
                value={formData.nombre}
                onChange={handleChange}
                required={isRegister}
                disabled={loading}
                autoComplete="name"
                />
            </div>
            )}

            <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
                id="email"
                type="email"
                name="email"
                placeholder="tu@email.com"
                value={formData.email}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete="email"
            />
            </div>

            <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
                id="password"
                type="password"
                name="password"
                placeholder={isRegister ? "Mínimo 6 caracteres" : "Ingresa tu contraseña"}
                value={formData.password}
                onChange={handleChange}
                required
                disabled={loading}
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={isRegister ? 6 : undefined}
            />
            </div>

            {isRegister && (
            <div className="form-group">
                <label htmlFor="confirmPassword">Confirmar contraseña</label>
                <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                placeholder="Confirma tu contraseña"
                value={formData.confirmPassword}
                onChange={handleChange}
                required={isRegister}
                disabled={loading}
                autoComplete="new-password"
                />
            </div>
            )}

            <button 
            type="submit" 
            className="submit-button"
            disabled={loading}
            style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
            >
            {loading ? (
                <>
                <LoadingSpinner size="small" color="#ffffff" />
                {isRegister ? "Creando cuenta..." : "Iniciando sesión..."}
                </>
            ) : (
                isRegister ? "Crear Cuenta" : "Iniciar Sesión"
            )}
            </button>
        </form>

        {!isRegister && (
            <div className="forgot-password">
            <a href="#" className="forgot-link">
                ¿Olvidaste tu contraseña?
            </a>
            </div>
        )}

        <div className="divider">
            <span>o</span>
        </div>

        <button
            type="button"
            className="toggle-button"
            onClick={toggleMode}
            disabled={loading}
        >
            {isRegister
            ? "¿Ya tienes cuenta? Inicia sesión aquí"
            : "¿No tienes cuenta? Regístrate gratis"}
        </button>

        {/* Información adicional para registro */}
        {isRegister && (
            <div className="register-benefits">
            <h4>Al crear una cuenta obtienes:</h4>
            <ul>
                <li>✅ Seguimiento de pedidos</li>
                <li>✅ Ofertas exclusivas por email</li>
                <li>✅ Historial de compras</li>
                <li>✅ Carrito guardado</li>
            </ul>
            </div>
        )}
        </div>

        {/* Footer del login */}
        <div className="login-footer">
        <p>
            Al continuar, aceptas nuestros{' '}
            <a href="#" className="terms-link">Términos de Servicio</a>
            {' '}y{' '}
            <a href="#" className="terms-link">Política de Privacidad</a>
        </p>
        </div>
    </div>
    </div>
);
}