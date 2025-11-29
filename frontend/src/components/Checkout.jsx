import React, { useState } from 'react';
import { API_URL } from '../config';

function Checkout({ cartItems, total, onSubmit, onClose, onClearCart }) {
const [formData, setFormData] = useState({
firstName: '',
lastName: '',
email: '',
address: '',
city: '',
postalCode: '',
phone: '',
paymentMethod: '' // Nuevo campo para método de pago
});

const [step, setStep] = useState(1);
const [isSubmitting, setIsSubmitting] = useState(false);
const [error, setError] = useState('');
const [orderCreated, setOrderCreated] = useState(null);

const handleInputChange = (e) => {
setFormData({
    ...formData,
    [e.target.name]: e.target.value
});
setError(''); // Limpiar errores al escribir
};

const handleSubmit = async (e) => {
e.preventDefault();

    try {
        setIsSubmitting(true);
        setError('');

        // Validar que se haya seleccionado un método de pago
        if (!formData.paymentMethod) {
            setError('Por favor selecciona un método de pago');
            setIsSubmitting(false);
            return;
        }

        // Validar si el método de pago está disponible
        if (formData.paymentMethod !== 'cash' && formData.paymentMethod !== 'transfer') {
            setError('Este método de pago estará disponible próximamente. Por favor selecciona "Pago Contra Entrega" o "Transferencia Bancaria"');
            setIsSubmitting(false);
            return;
        }

        const token = localStorage.getItem('authToken');
        const isAuthenticated = !!token;

        // Preparar items para el backend
        const orderItems = cartItems.map(item => ({
            product_id: item.id,
            quantity: item.quantity
        }));

        let response;

        if (isAuthenticated) {
            // Usuario autenticado - enviar datos estructurados
            response = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    items: orderItems,
                    payment_method: formData.paymentMethod,
                    customer_name: `${formData.firstName} ${formData.lastName}`,
                    customer_email: formData.email,
                    customer_phone: formData.phone,
                    shipping_street: formData.address,
                    shipping_city: formData.city,
                    shipping_postal_code: formData.postalCode
                })
            });
        } else {
            // Usuario invitado - enviar datos estructurados
            response = await fetch(`${API_URL}/orders/guest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    items: orderItems,
                    payment_method: formData.paymentMethod,
                    shipping_street: formData.address,
                    shipping_city: formData.city,
                    shipping_postal_code: formData.postalCode,
                    customer_info: {
                        name: `${formData.firstName} ${formData.lastName}`,
                        email: formData.email,
                        phone: formData.phone
                    }
                })
            });
        }    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al crear la orden');
    }

    const order = await response.json();
    console.log('Orden creada exitosamente:', order);
    
    // Mostrar confirmación
    setOrderCreated(order);
    
    // Vaciar carrito después de confirmar pedido
    if (onClearCart) {
        onClearCart();
    }

    // Llamar callback original si existe
    if (onSubmit) {
        onSubmit({ orderDetails: formData, items: cartItems, total, orderId: order.id });
    }

} catch (err) {
    console.error('Error al procesar la orden:', err);
    setError(err.message || 'Error al procesar la orden. Inténtalo de nuevo.');
} finally {
    setIsSubmitting(false);
}
};

return (
<div className="checkout-modal">
    <div className="checkout-content">
    <button className="close-checkout" onClick={onClose} disabled={isSubmitting}>✖</button>
    
    {orderCreated ? (
        // Pantalla de éxito
        <div className="order-success">
            <div className="success-icon">✅</div>
            <h2>¡Pedido Confirmado!</h2>
            <p className="order-number">Orden #{orderCreated.id}</p>
            <p className="success-message">
                Tu pedido ha sido recibido y está siendo procesado.
                {!localStorage.getItem('authToken') && (
                    <><br/>📧 Recibirás la confirmación en <strong>{formData.email}</strong></>
                )}
            </p>
            <div className="order-summary-success">
                <p><strong>Total:</strong> ${orderCreated.total.toFixed(2)}</p>
                <p><strong>Método de Pago:</strong> 
                    {formData.paymentMethod === 'cash' && ' 💵 Pago Contra Entrega'}
                    {formData.paymentMethod === 'transfer' && ' 🏦 Transferencia Bancaria'}
                    {formData.paymentMethod === 'online' && ' 💳 Pago en Línea'}
                    {formData.paymentMethod === 'card' && ' 💳 Tarjeta de Crédito/Débito'}
                </p>
                <p><strong>Estado:</strong> <span className="status-badge">{orderCreated.status}</span></p>
                <p><strong>Envío a:</strong> {formData.address}, {formData.city}</p>
            </div>
            {formData.paymentMethod === 'cash' && (
                <div className="payment-note">
                    💰 Prepara el monto exacto: <strong>${orderCreated.total.toFixed(2)}</strong>
                </div>
            )}
            {formData.paymentMethod === 'transfer' && (
                <div className="payment-note transfer-note">
                    <h4>📋 Instrucciones de Transferencia</h4>
                    <div className="bank-details">
                        <p><strong>Banco:</strong> Banco Ejemplo</p>
                        <p><strong>Titular:</strong> Mi Tienda Online</p>
                        <p><strong>Cuenta:</strong> 1234-5678-9012-3456</p>
                        <p><strong>CLABE:</strong> 012345678901234567</p>
                        <p><strong>Monto:</strong> <span className="amount">${orderCreated.total.toFixed(2)}</span></p>
                    </div>
                    <p className="transfer-instructions">
                        ⚠️ Envía tu comprobante de pago por email a <strong>pagos@mitienda.com</strong> 
                        indicando el número de orden <strong>#{orderCreated.id}</strong>
                    </p>
                </div>
            )}
            {!localStorage.getItem('authToken') && (
                <div className="guest-info">
                    💡 <strong>Tip:</strong> Crea una cuenta para hacer seguimiento de tus pedidos.
                </div>
            )}
            <button className="continue-shopping-btn" onClick={onClose}>
                Continuar Comprando
            </button>
        </div>
    ) : (
        <>
            <h2>Proceso de Compra</h2>
            
            {/* Mostrar errores */}
            {error && (
                <div className="checkout-error">
                    ⚠️ {error}
                </div>
            )}
            
            {/* Indicador de pasos */}
            <div className="checkout-steps">
                <div className={`step ${step >= 1 ? 'active' : ''}`}>Datos</div>
                <div className={`step ${step >= 2 ? 'active' : ''}`}>Envío</div>
                <div className={`step ${step >= 3 ? 'active' : ''}`}>Pago</div>
            </div>

            {step === 1 && (
                <form onSubmit={(e) => {e.preventDefault(); setStep(2)}}>
                <div className="form-group">
                    <input
                    type="text"
                    name="firstName"
                    placeholder="Nombre"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                    />
                </div>
                <div className="form-group">
                    <input
                    type="text"
                    name="lastName"
                    placeholder="Apellidos"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                    />
                </div>
                <div className="form-group">
                    <input
                    type="email"
                    name="email"
                    placeholder="Email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                    />
                </div>
                <button type="submit" className="next-step-btn" disabled={isSubmitting}>
                    Siguiente
                </button>
                </form>
            )}

            {step === 2 && (
                <form onSubmit={(e) => {e.preventDefault(); setStep(3)}}>
                <div className="form-group">
                    <input
                    type="text"
                    name="address"
                    placeholder="Dirección"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                    />
                </div>
                <div className="form-group">
                    <input
                    type="text"
                    name="city"
                    placeholder="Ciudad"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                    />
                </div>
                <div className="form-group">
                    <input
                    type="text"
                    name="postalCode"
                    placeholder="Código Postal"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                    />
                </div>
                <div className="form-group">
                    <input
                    type="tel"
                    name="phone"
                    placeholder="Teléfono"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                    />
                </div>
                <div className="button-group">
                    <button type="button" onClick={() => setStep(1)} disabled={isSubmitting}>
                    Anterior
                    </button>
                    <button type="submit" disabled={isSubmitting}>
                    Siguiente
                    </button>
                </div>
                </form>
            )}

            {step === 3 && (
                <div className="payment-section">
                <h3>Método de Pago</h3>
                
                {/* Selector de método de pago */}
                <div className="payment-methods">
                    <div 
                        className={`payment-option ${formData.paymentMethod === 'cash' ? 'selected' : ''}`}
                        onClick={() => setFormData({...formData, paymentMethod: 'cash'})}
                    >
                        <div className="payment-icon">💵</div>
                        <div className="payment-info">
                            <h4>Pago Contra Entrega</h4>
                            <p>Paga en efectivo cuando recibas tu pedido</p>
                        </div>
                        <div className="payment-check">
                            {formData.paymentMethod === 'cash' && '✓'}
                        </div>
                    </div>

                    <div 
                        className={`payment-option ${formData.paymentMethod === 'transfer' ? 'selected' : ''}`}
                        onClick={() => setFormData({...formData, paymentMethod: 'transfer'})}
                    >
                        <div className="payment-icon">🏦</div>
                        <div className="payment-info">
                            <h4>Transferencia Bancaria</h4>
                            <p>Transferencia o depósito bancario</p>
                        </div>
                        <div className="payment-check">
                            {formData.paymentMethod === 'transfer' && '✓'}
                        </div>
                    </div>

                    <div 
                        className={`payment-option ${formData.paymentMethod === 'online' ? 'selected' : ''}`}
                        onClick={() => setFormData({...formData, paymentMethod: 'online'})}
                    >
                        <div className="payment-icon">💳</div>
                        <div className="payment-info">
                            <h4>Pago en Línea</h4>
                            <p>PayPal, Stripe, MercadoPago</p>
                            <span className="coming-soon">Próximamente</span>
                        </div>
                        <div className="payment-check">
                            {formData.paymentMethod === 'online' && '✓'}
                        </div>
                    </div>

                    <div 
                        className={`payment-option ${formData.paymentMethod === 'card' ? 'selected' : ''}`}
                        onClick={() => setFormData({...formData, paymentMethod: 'card'})}
                    >
                        <div className="payment-icon">💳</div>
                        <div className="payment-info">
                            <h4>Tarjeta de Crédito/Débito</h4>
                            <p>Visa, MasterCard, American Express</p>
                            <span className="coming-soon">Próximamente</span>
                        </div>
                        <div className="payment-check">
                            {formData.paymentMethod === 'card' && '✓'}
                        </div>
                    </div>
                </div>

                {/* Error si no selecciona método de pago */}
                {error && (
                    <div className="payment-error">
                        ⚠️ {error}
                    </div>
                )}

                {/* Resumen del pedido */}
                <h3 style={{marginTop: '30px'}}>Resumen del Pedido</h3>
                <div className="order-summary">
                    {cartItems.map(item => (
                    <div key={item.id} className="summary-item">
                        <span>{item.name} x {item.quantity}</span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    ))}
                    <div className="summary-total">
                    <strong>Total: ${total.toFixed(2)}</strong>
                    </div>
                </div>

                <div className="button-group">
                    <button type="button" onClick={() => setStep(2)} disabled={isSubmitting}>
                    Anterior
                    </button>
                    <button 
                        type="button" 
                        onClick={handleSubmit} 
                        className="confirm-btn"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Procesando...' : 'Confirmar Pedido'}
                    </button>
                </div>
                </div>
            )}
        </>
    )}
    </div>
</div>
);
}

export default Checkout;