    // services/authService.js
   import { apiFetch, apiUrl, refreshCsrfToken } from './apiClient';

    // Funciones de autenticación
    export const login = async (email, password) => {
    try {
        const response = await apiFetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al iniciar sesión');
        }

        const data = await response.json();
        
        // Guardar datos del usuario
        localStorage.setItem('userData', JSON.stringify(data.user));
        if (data.token) {
        localStorage.setItem('authToken', data.token);
        }
        
        // Refresh CSRF token after login for mobile compatibility
        await refreshCsrfToken();
        
        return data.user;
    } catch (error) {
        console.error('Error en login:', error);
        throw error;
    }
    };

    export const register = async (name, email, password, code) => {
    try {
        const response = await apiFetch(apiUrl('/auth/register'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            name, 
            email, 
            password,
            code
        }),
        });

        if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al registrar usuario');
        }

        const data = await response.json();
        
        // Guardar datos del usuario automáticamente después del registro
        localStorage.setItem('userData', JSON.stringify(data.user));
        if (data.token) {
        localStorage.setItem('authToken', data.token);
        }
        
        // Refresh CSRF token after registration for mobile compatibility
        await refreshCsrfToken();
        
        return data.user;
    } catch (error) {
        console.error('Error en register:', error);
        throw error;
    }
    };

    export const logout = () => {
    try {
        apiFetch(apiUrl('/auth/logout'), { method: 'POST' });
    } catch (error) {
        console.error('Error en logout:', error);
    }
    localStorage.removeItem('userData');
    localStorage.removeItem('authToken');
    
    // Limpiar carritos guardados (opcional)
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith('cart_')) {
        localStorage.removeItem(key);
        }
    });
    };

    export const getCurrentUser = () => {
    try {
        const userData = localStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    } catch (error) {
        console.error('Error al obtener usuario actual:', error);
        return null;
    }
    };

    export const isLoggedIn = () => {
    const userData = localStorage.getItem('userData');
    return !!userData;
    };

    export const getAuthToken = () => {
        return localStorage.getItem('authToken');
    };

    export const forgotPassword = async (email) => {
    try {
        const response = await apiFetch(apiUrl('/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al enviar código');
        return data;
    } catch (error) {
        console.error('Error en forgotPassword:', error);
        throw error;
    }
    };

    export const resetPassword = async (email, code, newPassword) => {
    try {
        const response = await apiFetch(apiUrl('/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al restablecer contraseña');
        return data;
    } catch (error) {
        console.error('Error en resetPassword:', error);
        throw error;
    }
    };

    export default {
    login,
    register,
    logout,
    getCurrentUser,
    isLoggedIn,
    getAuthToken
    };

