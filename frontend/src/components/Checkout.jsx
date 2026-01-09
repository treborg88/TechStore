import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, BASE_URL } from '../config';
import { getCurrentUser } from '../services/authService';
import Invoice from './Invoice';
import EmailVerification from './EmailVerification';
import '../styles/ProductDetail.css';
import '../styles/Checkout.css';

function Checkout({ cartItems, total, onSubmit, onClose, onClearCart, siteName, siteIcon }) {
    const navigate = useNavigate();
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
        <div className="checkout-page product-detail-page">
            <section className="hero-section">
                <div className="container hero-container">
                    <div className="hero-content">
                        <button 
                            className="back-btn-new hero-back-btn" 
                            onClick={onClose}
                        >
                            ← Volver
                        </button>
                        <h2 className="hero-title">Finalizar Pedido</h2>
                        <p className="hero-text">
                            <span className="hero-category-badge">CHECKOUT</span>
                            Completa tu información de envío y selecciona tu método de pago.
                        </p>
                    </div>
                </div>
            </section>

            <div className="checkout-content container">
    
            {orderCreated ? (
                <Invoice 
                    order={orderCreated}
                    customerInfo={formData}
                    items={confirmedItems}
                    onClose={() => {
                        window.scrollTo(0, 0);
                        navigate('/');
                    }}
                    siteName={siteName}
                    siteIcon={siteIcon}
                />
            ) : (
        <div className="checkout-flow-container">
            {/* Indicador de pasos */}
            <div className="checkout-steps">
                <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Datos</div>
                <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Envió</div>
                <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Revisión</div>
                <div className={`step ${step >= 4 ? 'active' : ''}`}>4. Pago</div>
            </div>

            {error && (
                <div className="checkout-error-banner">
                    ⚠️ {error}
                </div>
            )}

            <div className="cart-layout">
                <div className="checkout-form-column">
                    <div className="form-card-container">
                        {step === 1 && (
                            !showVerification ? (
                                <form id="step1-form" className="step-form" onSubmit={(e) => {
                                    e.preventDefault();
                                    const user = getCurrentUser();
                                    if (user || isEmailVerified) {
                                        setStep(2);
                                    } else {
                                        setShowVerification(true);
                                    }
                                }}>
                                    <h3>Información Personal</h3>
                                    <div className="form-grid">
                                        <div className="form-group">
                                            <label>Nombre</label>
                                            <input
                                                type="text"
                                                name="firstName"
                                                placeholder="Ej. Juan"
                                                value={formData.firstName}
                                                onChange={handleInputChange}
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Apellidos</label>
                                            <input
                                                type="text"
                                                name="lastName"
                                                placeholder="Ej. Pérez"
                                                value={formData.lastName}
                                                onChange={handleInputChange}
                                                required
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{marginBottom: '20px'}}>
                                        <label>Correo Electrónico</label>
                                        <input
                                            type="email"
                                            name="email"
                                            placeholder="correo@ejemplo.com"
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
                                </form>
                            ) : (
                                <div className="verification-step-wrapper">
                                    <EmailVerification
                                        email={formData.email}
                                        purpose="guest_checkout"
                                        onVerified={() => {
                                            setIsEmailVerified(true);
                                            setShowVerification(false);
                                            setStep(2);
                                        }}
                                        onCancel={() => setShowVerification(false)}
                                    />
                                    <button 
                                        className="back-link" 
                                        onClick={() => setShowVerification(false)}
                                        style={{marginTop: '15px', background: 'none', border: 'none', color: 'var(--gray-500)', textDecoration: 'underline', width: '100%', cursor: 'pointer'}}
                                    >
                                        Regresar a editar datos
                                    </button>
                                </div>
                            )
                        )}

                        {step === 2 && (
                            <form id="step2-form" className="step-form" onSubmit={(e) => {e.preventDefault(); setStep(3)}}>
                                <h3>Detalles de Entrega</h3>
                                <div className="form-group" style={{marginBottom: '15px'}}>
                                    <label>Calle y Número</label>
                                    <input
                                        type="text"
                                        name="address"
                                        placeholder="Ej. Calle 5, Casa #10"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        required
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Sector</label>
                                        <input
                                            type="text"
                                            name="sector"
                                            placeholder="Sector / Barrio"
                                            value={formData.sector}
                                            onChange={handleInputChange}
                                            required
                                            disabled={isSubmitting}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Ciudad</label>
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
                                </div>
                                <div className="form-group" style={{marginBottom: '15px'}}>
                                    <label>Teléfono de Contacto</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        placeholder="Ej. 809-555-0123"
                                        value={formData.phone}
                                        onChange={handleInputChange}
                                        required
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="form-group" style={{marginBottom: '20px'}}>
                                    <label>Notas adicionales (Opcional)</label>
                                    <textarea
                                        name="notes"
                                        placeholder="Referencias para el mensajero (color de casa, cerca de x lugar...)"
                                        className="checkout-textarea"
                                        style={{width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--divider-color)', minHeight: '80px'}}
                                        value={formData.notes}
                                        onChange={handleInputChange}
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </form>
                        )}

                        {step === 3 && (
                            <div className="step-form">
                                <h3>Revisión de Pedido</h3>
                                <div className="review-card">
                                    <div className="review-item">
                                        <label>Enviar a:</label>
                                        <p>{formData.firstName} {formData.lastName}</p>
                                    </div>
                                    <div className="review-item">
                                        <label>Correo Electrónico:</label>
                                        <p>{formData.email}</p>
                                    </div>
                                    <div className="review-item">
                                        <label>Teléfono de Contacto:</label>
                                        <p>{formData.phone}</p>
                                    </div>
                                    <div className="review-item">
                                        <label>Dirección:</label>
                                        <p>{formData.address}, {formData.sector}, {formData.city}</p>
                                    </div>
                                    {formData.notes && (
                                        <div className="review-item">
                                            <label>Notas:</label>
                                            <p>{formData.notes}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="step-form">
                                <h3>Método de Pago</h3>
                                
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

                                    <div className="payment-option disabled">
                                        <div className="payment-icon">💳</div>
                                        <div className="payment-info">
                                            <h4>Pago en Línea</h4>
                                            <p>PayPal, Stripe, MercadoPago</p>
                                            <span className="badge-soon">Próximamente</span>
                                        </div>
                                    </div>

                                    <div className="payment-option disabled">
                                        <div className="payment-icon">💳</div>
                                        <div className="payment-info">
                                            <h4>Tarjeta de Crédito/Débito</h4>
                                            <p>Visa, MasterCard, American Express</p>
                                            <span className="badge-soon">Próximamente</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                        <div className="checkout-summary-column">
                            <div className="summary-card">
                                <h3>Tu Carrito</h3>
                                <div className="mini-item-list">
                                    {cartItems.map(item => (
                                        <div key={item.id} className="mini-item">
                                            <div className="mini-item-main">
                                                <img 
                                                    src={item.image ? (
                                                        item.image.startsWith('http') 
                                                            ? item.image 
                                                            : (item.image.startsWith('/images/') 
                                                                ? `${BASE_URL}${item.image}` 
                                                                : `${BASE_URL}/images/${item.image}`)
                                                    ) : '/images/sin imagen.jpeg'} 
                                                    alt={item.name}
                                                    className="mini-item-img"
                                                    onError={(e) => { e.target.src = '/images/sin imagen.jpeg'; }}
                                                />
                                                <div className="mini-item-info">
                                                    <span className="mini-item-name">{item.name}</span>
                                                    <span className="mini-item-meta">{item.quantity} un. x ${item.price.toFixed(2)}</span>
                                                </div>
                                            </div>
                                            <span className="mini-item-price">${(item.price * item.quantity).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="summary-divider"></div>
                                <div className="summary-row">
                                    <span>Subtotal</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                                <div className="summary-row">
                                    <span>Envío</span>
                                    <span style={{color: 'var(--accent-color)', fontWeight: '700'}}>Gratis</span>
                                </div>
                                <div className="summary-divider"></div>
                                <div className="summary-row total-row">
                                    <span>Total</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
            </div>

            <div className="checkout-actions-container">
                {step > 1 && (
                    <button 
                        type="button" 
                        className="btn-back" 
                        onClick={() => setStep(step - 1)}
                        disabled={isSubmitting}
                    >
                        <span className="btn-icon">←</span> Atrás
                    </button>
                )}
                
                {step === 1 && !showVerification && (
                    <button type="submit" form="step1-form" className="btn-next">
                        Siguiente <span className="btn-icon">→</span>
                    </button>
                )}
                
                {step === 2 && (
                    <button type="submit" form="step2-form" className="btn-next">
                        Siguiente <span className="btn-icon">→</span>
                    </button>
                )}

                {step === 3 && (
                    <button type="button" className="btn-next" onClick={() => setStep(4)}>
                        Siguiente <span className="btn-icon">→</span>
                    </button>
                )}

                {step === 4 && (
                    <button 
                        type="button" 
                        className="btn-confirm" 
                        onClick={handleSubmit} 
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Procesando...' : 'Confirmar Todo el Pedido'} <span className="btn-icon">✓</span>
                    </button>
                )}
            </div>
        </div>
    )}
    </div>
</div>
);

}

export default Checkout;