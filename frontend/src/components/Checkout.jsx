import React, { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { getCurrentUser } from '../services/authService';
import Invoice from './Invoice';
import EmailVerification from './EmailVerification';

function Checkout({ cartItems, total, onSubmit, onClose, onClearCart }) {
const [formData, setFormData] = useState({
firstName: '',
lastName: '',
email: '',
address: '',
sector: '',
city: '',
phone: '',
notes: '', // Nuevo campo opcional para notas/referencias
paymentMethod: '' // Nuevo campo para método de pago
});

const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [orderCreated, setOrderCreated] = useState(null);
    const [confirmedItems, setConfirmedItems] = useState([]);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [showVerification, setShowVerification] = useState(false);

    useEffect(() => {
    const user = getCurrentUser();
    if (user) {
        const nameParts = user.name ? user.name.split(' ') : [''];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // Try to load saved address
        const savedAddr = localStorage.getItem('user_default_address');
        let addressData = {};
        if (savedAddr) {
            try {
                const parsed = JSON.parse(savedAddr);
                addressData = {
                    address: parsed.street || '',
                    sector: parsed.sector || '',
                    city: parsed.city || ''
                };
            } catch (e) {
                console.error('Error parsing saved address', e);
            }
        }

        setFormData(prev => ({
            ...prev,
            firstName: firstName,
            lastName: lastName,
            email: user.email || '',
            phone: user.phone || '',
            ...addressData
        }));
        setIsEmailVerified(true);
    }
}, []);

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
                    shipping_sector: formData.sector,
                    notes: formData.notes
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
                    shipping_sector: formData.sector,
                    notes: formData.notes,
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
    
    // Guardar items confirmados para la factura antes de limpiar el carrito
    setConfirmedItems([...cartItems]);

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
        <Invoice 
            order={orderCreated}
            customerInfo={formData}
            items={confirmedItems}
            onClose={onClose}
        />
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
                <div className={`step ${step >= 3 ? 'active' : ''}`}>Confirmación</div>
                <div className={`step ${step >= 4 ? 'active' : ''}`}>Pago</div>
            </div>

            {step === 1 && (
                !showVerification ? (
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const user = getCurrentUser();
                    if (user || isEmailVerified) {
                        setStep(2);
                    } else {
                        setShowVerification(true);
                    }
                }}>
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
                    onChange={(e) => {
                        handleInputChange(e);
                        const user = getCurrentUser();
                        if (!user) {
                            setIsEmailVerified(false);
                        }
                    }}
                    required
                    disabled={isSubmitting}
                    />
                </div>
                <button type="submit" className="next-step-btn" disabled={isSubmitting}>
                    Siguiente
                </button>
                </form>
                ) : (
                    <div className="verification-step">
                        <EmailVerification
                            initialEmail={formData.email}
                            autoSend={true}
                            purpose="guest_checkout"
                            onVerified={(verifiedEmail) => {
                                setFormData(prev => ({ ...prev, email: verifiedEmail }));
                                setIsEmailVerified(true);
                                setShowVerification(false);
                                setStep(2);
                            }}
                        />
                        <button 
                            className="back-btn" 
                            onClick={() => setShowVerification(false)}
                            style={{ marginTop: '10px', background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            Volver a editar datos
                        </button>
                    </div>
                )
            )}

            {step === 2 && (
                <form onSubmit={(e) => {e.preventDefault(); setStep(3)}}>
                <div className="form-group">
                    <input
                    type="text"
                    name="address"
                    placeholder="Calle y Número"
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                    />
                </div>
                <div className="form-group">
                    <input
                    type="text"
                    name="sector"
                    placeholder="Sector"
                    value={formData.sector}
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
                    name="country"
                    value="Republica Dominicana"
                    disabled
                    style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed', color: '#666' }}
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
                <div className="form-group">
                    <textarea
                    name="notes"
                    placeholder="Notas o referencias de la dirección (Opcional)"
                    value={formData.notes}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    rows="3"
                    className="checkout-textarea"
                    ></textarea>
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
                <div className="confirmation-section">
                    <h3 className="section-subtitle">Resumen de Facturación</h3>
                    
                    <div className="order-info-section" style={{ background: 'var(--gray-50)', padding: '20px', borderRadius: '16px', border: '1px solid var(--gray-200)' }}>
                        <div className="info-row">
                            <span className="info-label">Cliente:</span>
                            <span className="info-value">{formData.firstName} {formData.lastName}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Email:</span>
                            <span className="info-value">{formData.email}</span>
                        </div>
                        <div className="info-row">
                            <span className="info-label">Teléfono:</span>
                            <span className="info-value">{formData.phone}</span>
                        </div>
                        <div className="info-row full-width">
                            <span className="info-label">Dirección de Envío:</span>
                            <span className="info-value">
                                {formData.address}, {formData.sector}<br />
                                {formData.city}, República Dominicana
                            </span>
                        </div>
                    </div>

                    <div className="order-items-section">
                        <h4>Productos a Confirmar</h4>
                        <div className="order-items-list">
                            {cartItems.map((item) => (
                                <div key={item.id} className="order-item-row">
                                    <img 
                                        src={item.image ? (
                                            item.image.startsWith('http') 
                                                ? item.image 
                                                : (item.image.startsWith('/images/') 
                                                    ? `${API_URL.replace('/api', '')}${item.image}` 
                                                    : `${API_URL.replace('/api', '')}/images/${item.image}`)
                                        ) : '/images/sin imagen.jpeg'} 
                                        alt={item.name}
                                        className="item-image"
                                        style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px' }}
                                        onError={(e) => {
                                            e.target.src = '/images/sin imagen.jpeg';
                                        }}
                                    />
                                    <div className="item-info">
                                        <p className="item-name" style={{ margin: 0, fontWeight: '600' }}>{item.name}</p>
                                        <p className="item-quantity" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                                            {item.quantity} × ${item.price.toFixed(2)}
                                        </p>
                                    </div>
                                    <div className="item-total" style={{ fontWeight: '700', color: 'var(--primary-color)' }}>
                                        ${(item.quantity * item.price).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="summary-divider" style={{ margin: '25px 0' }}></div>
                    
                    <div className="total-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1.5rem', fontWeight: '800' }}>
                        <span>Total a Pagar:</span>
                        <span style={{ color: 'var(--primary-color)' }}>${total.toFixed(2)}</span>
                    </div>

                    <div className="button-group" style={{ marginTop: '35px' }}>
                        <button type="button" className="back-btn" onClick={() => setStep(2)} disabled={isSubmitting}>
                            Anterior
                        </button>
                        <button 
                            type="button" 
                            className="next-step-btn"
                            onClick={() => setStep(4)} 
                            disabled={isSubmitting}
                        >
                            Siguiente: Método de Pago
                        </button>
                    </div>
                </div>
            )}

            {step === 4 && (
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
                        className="payment-option disabled"
                        style={{ opacity: 0.6, cursor: 'not-allowed' }}
                    >
                        <div className="payment-icon">💳</div>
                        <div className="payment-info">
                            <h4>Pago en Línea</h4>
                            <p>PayPal, Stripe, MercadoPago</p>
                            <span className="coming-soon">Próximamente</span>
                        </div>
                        <div className="payment-check">
                        </div>
                    </div>

                    <div 
                        className="payment-option disabled"
                        style={{ opacity: 0.6, cursor: 'not-allowed' }}
                    >
                        <div className="payment-icon">💳</div>
                        <div className="payment-info">
                            <h4>Tarjeta de Crédito/Débito</h4>
                            <p>Visa, MasterCard, American Express</p>
                            <span className="coming-soon">Próximamente</span>
                        </div>
                        <div className="payment-check">
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
                    <button type="button" onClick={() => setStep(3)} disabled={isSubmitting}>
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