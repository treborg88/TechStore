import React, { useState, useEffect } from "react";
import { login, register, forgotPassword, resetPassword } from '../../services/authService';
import { toast } from 'react-hot-toast';
import LoadingSpinner from '../common/LoadingSpinner';
import EmailVerification from './EmailVerification';

export default function LoginPage({ onLoginSuccess, onBackToHome, prefillEmail = '', lockEmail = false, embedded = false, hideRegister = false }) {
const [isRegister, setIsRegister] = useState(false);
const [isForgotPassword, setIsForgotPassword] = useState(false);
const [showPassword, setShowPassword] = useState(false);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [showVerification, setShowVerification] = useState(false);
const [formData, setFormData] = useState({
    nombre: "",
    email: prefillEmail || "",
    password: "",
    confirmPassword: ""
});

const [resetData, setResetData] = useState({
    email: "",
    code: "",
    newPassword: "",
    confirmNewPassword: ""
});

const [resetStep, setResetStep] = useState('input_email'); // input_email, verify_code, success

    // Persistencia para no perder el progreso si se recarga la página
    useEffect(() => {
        const saved = localStorage.getItem('auth_form_persistence');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setIsRegister(parsed.isRegister || false);
                setIsForgotPassword(parsed.isForgotPassword || false);
                setFormData(parsed.formData || { nombre: "", email: prefillEmail || "", password: "", confirmPassword: "" });
                setShowVerification(parsed.showVerification || false);
                setResetStep(parsed.resetStep || 'input_email');
            } catch {
                console.log('No había estado de autenticación previo');
            }
        }
    }, []);

    useEffect(() => {
        if (prefillEmail) {
            setFormData((prev) => ({ ...prev, email: prefillEmail }));
        }
    }, [prefillEmail]);

    useEffect(() => {
        if (embedded || hideRegister) {
            setIsRegister(false);
            setShowVerification(false);
        }
    }, [embedded, hideRegister]);

    useEffect(() => {
        localStorage.setItem('auth_form_persistence', JSON.stringify({
            isRegister,
            isForgotPassword,
            formData,
            showVerification,
            resetStep
        }));
    }, [isRegister, isForgotPassword, formData, showVerification, resetStep]);

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
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(formData.password)) {
            toast.error('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número');
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

    const handleRegisterAfterVerification = async (email, code) => {
        setLoading(true);
        try {
            const userData = await register(formData.nombre, email, formData.password, code);
            toast.success('¡Cuenta creada exitosamente!');
            localStorage.removeItem('auth_form_persistence');
            onLoginSuccess(userData);
        } catch (err) {
            const msg = err.message || 'Ha ocurrido un error. Inténtalo de nuevo.';
            setError(msg);
            toast.error(msg);
            setShowVerification(false); // Volver al formulario si falla el registro final
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            await forgotPassword(formData.email);
            toast.success('Código de recuperación enviado');
            setIsForgotPassword(true);
            setResetStep('verify_code');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (email, code) => {
        setResetData({ ...resetData, email, code });
        setResetStep('new_password');
    };

    const handleFinalReset = async (e) => {
        e.preventDefault();
        if (resetData.newPassword !== resetData.confirmNewPassword) {
            toast.error('Las contraseñas no coinciden');
            return;
        }
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(resetData.newPassword)) {
            toast.error('La contraseña debe tener al menos 8 caracteres, una mayúscula y un número');
            return;
        }

        setLoading(true);
        try {
            await resetPassword(resetData.email, resetData.code, resetData.newPassword);
            toast.success('Contraseña actualizada correctamente');
            setIsForgotPassword(false);
            setResetStep('input_email');
            setIsRegister(false);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
    return;
    }

    setError('');

    if (isRegister && !showVerification) {
        setShowVerification(true);
        return;
    }

    setLoading(true);

    try {
    if (!isRegister) {
        const userData = await login(formData.email, formData.password);
        toast.success('¡Bienvenido de nuevo!');
        localStorage.removeItem('auth_form_persistence');
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
    setShowVerification(false);
    setError('');
    setFormData({
    nombre: "",
    email: prefillEmail || "",
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
    <div className={`login-page ${embedded ? 'embedded' : ''}`}>
    {loading && (
        <LoadingSpinner 
            fullPage={true} 
            size="large" 
            message={
                isForgotPassword 
                    ? (resetStep === 'verify_code' ? "Enviando código..." : "Actualizando contraseña...") 
                    : (isRegister ? "Creando tu cuenta..." : "Iniciando sesión...")
            } 
        />
    )}
    <div className="login-container">
        {/* Header con opción de volver */}
        {!embedded && (
            <div className="login-header">
            <button 
                className="back-button" 
                onClick={handleBackToHome}
                type="button"
                aria-label="Volver a la página principal"
            >    ←Volver
            </button>
            </div>
        )}

        {/* Contenido del formulario */}
        <div className="login-content">
        {!embedded && (
            <div 
                className="login-logo" 
                onClick={handleBackToHome}
                style={{ cursor: 'pointer' }}
                title="Volver al inicio"
            >
                <h1>🛍️ TechStore</h1>
            </div>
        )}

        <h2 className="login-title">
            {isForgotPassword ? "Recuperar Contraseña" : (isRegister ? "Crear Nueva Cuenta" : "Bienvenido de Nuevo")}
        </h2>
        
        <p className="login-subtitle">
            {isForgotPassword 
                ? "Te enviaremos un código para restablecer tu contraseña"
                : (isRegister 
                    ? "Únete a nuestra comunidad y disfruta de ofertas exclusivas" 
                    : "Inicia sesión para continuar con tus compras")
            }
        </p>

        {error && (
            <div className="error-message" role="alert">
            ⚠️ {error}
            </div>
        )}

        {isForgotPassword ? (
            <div className="forgot-password-container">
                {resetStep === 'verify_code' ? (
                    <EmailVerification
                        initialEmail={formData.email}
                        autoSend={false}
                        purpose="password_reset"
                        onVerified={(email, code) => handleResetPassword(email, code)}
                    />
                ) : resetStep === 'new_password' ? (
                    <form onSubmit={handleFinalReset} className="login-form">
                        <div className="form-group">
                            <label htmlFor="newPassword">Nueva Contraseña</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    id="newPassword"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Mínimo 8 caracteres, 1 mayúscula, 1 número"
                                    value={resetData.newPassword}
                                    onChange={(e) => setResetData({...resetData, newPassword: e.target.value})}
                                    required
                                    style={{ width: '100%', paddingRight: '80px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '10px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: '#007bff',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem'
                                    }}
                                >
                                    {showPassword ? "Ocultar" : "Mostrar"}
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label htmlFor="confirmNewPassword">Confirmar Nueva Contraseña</label>
                            <input
                                id="confirmNewPassword"
                                type={showPassword ? "text" : "password"}
                                placeholder="Confirma tu nueva contraseña"
                                value={resetData.confirmNewPassword}
                                onChange={(e) => setResetData({...resetData, confirmNewPassword: e.target.value})}
                                required
                            />
                        </div>
                        <button type="submit" className="submit-button" disabled={loading}>
                            {loading ? <LoadingSpinner size="small" color="#ffffff" /> : "Actualizar Contraseña"}
                        </button>
                    </form>
                ) : null}
                <button 
                    className="back-button-text" 
                    onClick={() => setIsForgotPassword(false)}
                    style={{ 
                        marginTop: '15px', 
                        background: 'none', 
                        border: 'none', 
                        color: '#666', 
                        cursor: 'pointer', 
                        textDecoration: 'underline',
                        width: '100%'
                    }}
                >
                    Volver al inicio de sesión
                </button>
            </div>
        ) : showVerification ? (
            <div className="verification-container">
                <EmailVerification
                    initialEmail={formData.email}
                    autoSend={true}
                    purpose="register"
                    onVerified={(email, code) => handleRegisterAfterVerification(email, code)}
                />
                <button 
                    className="back-button-text" 
                    onClick={() => setShowVerification(false)}
                    style={{ 
                        marginTop: '15px', 
                        background: 'none', 
                        border: 'none', 
                        color: '#666', 
                        cursor: 'pointer', 
                        textDecoration: 'underline',
                        width: '100%'
                    }}
                >
                    Volver a editar datos
                </button>
            </div>
        ) : (
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
                disabled={loading || lockEmail || embedded}
                autoComplete="email"
            />
            </div>

            <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <div className="password-input-container" style={{ position: 'relative' }}>
                <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder={isRegister ? "Mínimo 8 caracteres, 1 mayúscula, 1 número" : "Ingresa tu contraseña"}
                    value={formData.password}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    style={{ width: '100%', paddingRight: '80px' }}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#007bff',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                    }}
                >
                    {showPassword ? "Ocultar" : "Mostrar"}
                </button>
            </div>
            </div>

            {isRegister && (
            <div className="form-group">
                <label htmlFor="confirmPassword">Confirmar contraseña</label>
                <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
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
        )}

        {!isRegister && !showVerification && !isForgotPassword && (
            <div className="forgot-password">
            <button 
                type="button" 
                className="forgot-link" 
                onClick={handleForgotPassword}
                style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', padding: 0 }}
            >
                ¿Olvidaste tu contraseña?
            </button>
            </div>
        )}

        {!showVerification && !isForgotPassword && !hideRegister && !embedded && (
            <>
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
            </>
        )}

        {/* Información adicional para registro */}
        {isRegister && !embedded && !hideRegister && (
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
