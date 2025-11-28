    // services/authService.js
   import { API_URL } from '../config';

    // Funciones de autenticación
    export const login = async (email, password) => {
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
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
        
        // Guardar token y datos del usuario
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        
        console.log('Login exitoso:', data.user);
        return data.user;
    } catch (error) {
        console.error('Error en login:', error);
        throw error;
    }
    };

    export const register = async (name, email, password) => {
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            name, 
            email, 
            password 
        }),
        });

        if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al registrar usuario');
        }

        const data = await response.json();
        
        // Guardar token y datos del usuario automáticamente después del registro
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
        
        console.log('Registro exitoso:', data.user);
        return data.user;
    } catch (error) {
        console.error('Error en register:', error);
        throw error;
    }
    };

    export const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    
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
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    return token && userData;
    };

    export const getAuthToken = () => {
    return localStorage.getItem('authToken');
    };

    export default {
    login,
    register,
    logout,
    getCurrentUser,
    isLoggedIn,
    getAuthToken
    };

