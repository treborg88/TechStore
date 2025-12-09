import { API_URL } from '../config';

export const sendVerificationCode = async (email, purpose) => {
  try {
    const response = await fetch(`${API_URL}/verification/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, purpose }),
    });
    
    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al enviar el código');
      } else {
        const text = await response.text();
        console.error('Error del servidor (no JSON):', text);
        throw new Error('Error de conexión con el servidor. Por favor verifica que el backend esté corriendo.');
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending verification code:', error);
    throw error;
  }
};

export const verifyCode = async (email, code, purpose) => {
  try {
    const response = await fetch(`${API_URL}/verification/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, purpose }),
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Código inválido');
      } else {
        const text = await response.text();
        console.error('Error del servidor (no JSON):', text);
        throw new Error('Error de conexión con el servidor.');
      }
    }

    return await response.json();
  } catch (error) {
    console.error('Error verifying code:', error);
    throw error;
  }
};
