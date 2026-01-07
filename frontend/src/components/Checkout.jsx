import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { API_URL, BASE_URL } from '../config';
import { getCurrentUser } from '../services/authService';
import Invoice from './Invoice';
import EmailVerification from './EmailVerification';
import Footer from './Footer';
import Header from './Header';
import '../styles/ProductDetail.css';

function Checkout({ cartItems, total, onSubmit, onClose, onClearCart, user, onLogout, onOpenProfile, onOpenOrders, siteName, siteIcon, headerSettings }) {
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
        <div className="checkout-modal product-detail-page">
            <Header
                siteName={siteName || 'TechStore'}
                siteIcon={siteIcon || '🛍️'}
                headerSettings={headerSettings || { bgColor: '#2563eb', transparency: 100 }}
                cartItems={cartItems}
                user={user}
                onCartOpen={() => {}}
                onProfileOpen={onOpenProfile}
                onOrdersOpen={onOpenOrders}
                onLogout={onLogout}
                onLogoClick={onClose}
                isSticky={true}
            />

            <section className="hero-section" style={{ padding: '40px 0 30px' }}>
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

            <div className="checkout-content" style={{ padding: '60px 20px 80px' }}>
                <div style={{ display: 'none' }}>
                    <button 
                        onClick={onClose} 
                        className="back-btn-cart"
                        style={{ 
                            marginBottom: '15px'
                        }}
                    >
                        ← Volver
                    </button>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '800', margin: '0 0 10px 0', color: 'var(--gray-800)' }}>Finalizar Pedido</h1>
                </div>
    
            {orderCreated ? (
                <Invoice 
                    order={orderCreated}
                    customerInfo={formData}
                    items={confirmedItems}
                    onClose={onClose}
                    siteName={siteName}
                    siteIcon={siteIcon}
                />
            ) : (
        <div className="checkout-flow-container">
            <h2 style={{ display: 'none' }}>Finalizar Compra</h2>
            
            {/* Indicador de pasos */}
            <div className="checkout-steps">
                <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Datos</div>
                <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Envio</div>
                <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Revision</div>
                <div className={`step ${step >= 4 ? 'active' : ''}`}>4. Pago</div>
            </div>

            {error && (
                <div className="checkout-error-banner" style={{background: '#fee2e2', color: '#dc2626', padding: '15px', borderRadius: '12px', marginBottom: '25px', border: '1px solid #fecaca'}}>
                    ⚠️ {error}
                </div>
            )}

            <div className="cart-layout">
                <div className="checkout-form-column">
                    <div className="form-card-container">
                        {step === 1 && (
                            !showVerification ? (
                                <form className="step-form" onSubmit={(e) => {
                                    e.preventDefault();
                                    const user = getCurrentUser();
                                    if (user || isEmailVerified) {
                                        setStep(2);
                                    } else {
                                        setShowVerification(true);
                                    }
                                }}>
                                    <h3 style={{marginBottom: '20px'}}>Información Personal</h3>
                                    <div className="form-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px'}}>
                                        <div className="form-group">
                                            <label style={{fontSize: '0.85rem', fontWeight: '700', color: 'var(--gray-600)', marginBottom: '5px', display: 'block'}}>Nombre</label>
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
                                            <label style={{fontSize: '0.85rem', fontWeight: '700', color: 'var(--gray-600)', marginBottom: '5px', display: 'block'}}>Apellidos</label>
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
                                        <label style={{fontSize: '0.85rem', fontWeight: '700', color: 'var(--gray-600)', marginBottom: '5px', display: 'block'}}>Correo Electrónico</label>
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
                                    <button type="submit" className="next-step-btn-large" style={{width: '100%', padding: '15px', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '1rem', cursor: 'pointer'}}>
                                        Siguiente: Dirección de Envío
                                    </button>
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
                            <form className="step-form" onSubmit={(e) => {e.preventDefault(); setStep(3)}}>
                                <h3 style={{marginBottom: '20px'}}>Detalles de Entrega</h3>
                                <div className="form-group" style={{marginBottom: '15px'}}>
                                    <label style={{fontSize: '0.85rem', fontWeight: '700', color: 'var(--gray-600)', marginBottom: '5px', display: 'block'}}>Calle y Número</label>
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
                                <div className="form-grid" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px'}}>
                                    <div className="form-group">
                                        <label style={{fontSize: '0.85rem', fontWeight: '700', color: 'var(--gray-600)', marginBottom: '5px', display: 'block'}}>Sector</label>
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
                                        <label style={{fontSize: '0.85rem', fontWeight: '700', color: 'var(--gray-600)', marginBottom: '5px', display: 'block'}}>Ciudad</label>
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
                                    <label style={{fontSize: '0.85rem', fontWeight: '700', color: 'var(--gray-600)', marginBottom: '5px', display: 'block'}}>Teléfono de Contacto</label>
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
                                    <label style={{fontSize: '0.85rem', fontWeight: '700', color: 'var(--gray-600)', marginBottom: '5px', display: 'block'}}>Notas adicionales (Opcional)</label>
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
                                <div className="btn-group-row" style={{display: 'flex', gap: '15px'}}>
                                    <button type="button" className="secondary-btn" onClick={() => setStep(1)} style={{flex: 1, padding: '15px', borderRadius: '12px', background: 'var(--gray-100)', color: 'var(--gray-700)', border: 'none', fontWeight: '600', cursor: 'pointer'}}>Anterior</button>
                                    <button type="submit" className="primary-btn" style={{flex: 2, padding: '15px', borderRadius: '12px', background: 'var(--primary-color)', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer'}}>Siguiente Step</button>
                                </div>
                            </form>
                        )}

                        {step === 3 && (
                            <div className="step-form">
                                <h3 style={{marginBottom: '20px'}}>Revision de Pedido</h3>
                                <div className="review-card" style={{background: 'var(--gray-50)', padding: '20px', borderRadius: '16px', border: '1px solid var(--gray-200)', marginBottom: '25px'}}>
                                    <div className="review-item" style={{marginBottom: '10px'}}>
                                        <p style={{fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '2px'}}>Enviar a:</p>
                                        <p style={{fontWeight: '600'}}>{formData.firstName} {formData.lastName}</p>
                                    </div>
                                    <div className="review-item" style={{marginBottom: '10px'}}>
                                        <p style={{fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '2px'}}>Correo Electrónico:</p>
                                        <p style={{fontWeight: '600'}}>{formData.email}</p>
                                    </div>
                                    <div className="review-item" style={{marginBottom: '10px'}}>
                                        <p style={{fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '2px'}}>Teléfono de Contacto:</p>
                                        <p style={{fontWeight: '600'}}>{formData.phone}</p>
                                    </div>
                                    <div className="review-item">
                                        <p style={{fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '2px'}}>Dirección:</p>
                                        <p style={{fontWeight: '600'}}>{formData.address}, {formData.sector}, {formData.city}</p>
                                    </div>
                                </div>
                                <div className="btn-group-row" style={{display: 'flex', gap: '15px'}}>
                                    <button type="button" className="secondary-btn" onClick={() => setStep(2)} style={{flex: 1, padding: '15px', borderRadius: '12px', background: 'var(--gray-100)', color: 'var(--gray-700)', border: 'none', fontWeight: '600', cursor: 'pointer'}}>Atrás</button>
                                    <button type="button" className="primary-btn" onClick={() => setStep(4)} style={{flex: 2, padding: '15px', borderRadius: '12px', background: 'var(--primary-color)', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer'}}>Continuar al Pago</button>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="step-form">
                                <h3 style={{marginBottom: '20px'}}>Método de Pago</h3>
                                
                                <div className="payment-methods" style={{display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '25px'}}>
                                    <div 
                                        className={`payment-option ${formData.paymentMethod === 'cash' ? 'selected' : ''}`}
                                        onClick={() => setFormData({...formData, paymentMethod: 'cash'})}
                                        style={{display: 'flex', alignItems: 'center', padding: '16px', border: `2px solid ${formData.paymentMethod === 'cash' ? 'var(--primary-color)' : 'var(--gray-200)'}`, borderRadius: '12px', cursor: 'pointer', background: formData.paymentMethod === 'cash' ? 'var(--gray-50)' : 'white'}}
                                    >
                                        <div className="payment-icon" style={{fontSize: '2rem', marginRight: '16px'}}>💵</div>
                                        <div className="payment-info" style={{flex: 1}}>
                                            <h4 style={{margin: 0, fontSize: '1.1rem'}}>Pago Contra Entrega</h4>
                                            <p style={{margin: 0, fontSize: '0.9rem', color: 'var(--gray-500)'}}>Paga en efectivo cuando recibas tu pedido</p>
                                        </div>
                                        <div className="payment-check">
                                            {formData.paymentMethod === 'cash' && '✓'}
                                        </div>
                                    </div>

                                    <div 
                                        className={`payment-option ${formData.paymentMethod === 'transfer' ? 'selected' : ''}`}
                                        onClick={() => setFormData({...formData, paymentMethod: 'transfer'})}
                                        style={{display: 'flex', alignItems: 'center', padding: '16px', border: `2px solid ${formData.paymentMethod === 'transfer' ? 'var(--primary-color)' : 'var(--gray-200)'}`, borderRadius: '12px', cursor: 'pointer', background: formData.paymentMethod === 'transfer' ? 'var(--gray-50)' : 'white'}}
                                    >
                                        <div className="payment-icon" style={{fontSize: '2rem', marginRight: '16px'}}>🏦</div>
                                        <div className="payment-info" style={{flex: 1}}>
                                            <h4 style={{margin: 0, fontSize: '1.1rem'}}>Transferencia Bancaria</h4>
                                            <p style={{margin: 0, fontSize: '0.9rem', color: 'var(--gray-500)'}}>Transferencia o depósito bancario</p>
                                        </div>
                                        <div className="payment-check">
                                            {formData.paymentMethod === 'transfer' && '✓'}
                                        </div>
                                    </div>

                                    <div 
                                        className="payment-option disabled"
                                        style={{ display: 'flex', alignItems: 'center', padding: '16px', border: '2px solid var(--gray-200)', borderRadius: '12px', opacity: 0.6, cursor: 'not-allowed', background: 'white' }}
                                    >
                                        <div className="payment-icon" style={{fontSize: '2rem', marginRight: '16px'}}>💳</div>
                                        <div className="payment-info" style={{flex: 1}}>
                                            <h4 style={{margin: 0, fontSize: '1.1rem'}}>Pago en Línea</h4>
                                            <p style={{margin: 0, fontSize: '0.9rem', color: 'var(--gray-500)'}}>PayPal, Stripe, MercadoPago</p>
                                            <span style={{fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: '700'}}>Próximamente</span>
                                        </div>
                                    </div>

                                    <div 
                                        className="payment-option disabled"
                                        style={{ display: 'flex', alignItems: 'center', padding: '16px', border: '2px solid var(--gray-200)', borderRadius: '12px', opacity: 0.6, cursor: 'not-allowed', background: 'white' }}
                                    >
                                        <div className="payment-icon" style={{fontSize: '2rem', marginRight: '16px'}}>💳</div>
                                        <div className="payment-info" style={{flex: 1}}>
                                            <h4 style={{margin: 0, fontSize: '1.1rem'}}>Tarjeta de Crédito/Débito</h4>
                                            <p style={{margin: 0, fontSize: '0.9rem', color: 'var(--gray-500)'}}>Visa, MasterCard, American Express</p>
                                            <span style={{fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: '700'}}>Próximamente</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="btn-group-row" style={{display: 'flex', gap: '15px'}}>
                                    <button type="button" className="secondary-btn" onClick={() => setStep(3)} disabled={isSubmitting} style={{flex: 1, padding: '15px', borderRadius: '12px', background: 'var(--gray-100)', color: 'var(--gray-700)', border: 'none', fontWeight: '600', cursor: 'pointer'}}>Atrás</button>
                                    <button type="button" onClick={handleSubmit} className="confirm-btn-final" disabled={isSubmitting} style={{flex: 2, padding: '15px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--accent-color), var(--primary-color))', color: 'white', border: 'none', fontWeight: '800', cursor: 'pointer', fontSize: '1.1rem'}}>
                                        {isSubmitting ? 'Procesando...' : 'Confirmar Todo el Pedido'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="checkout-summary-column">
                    <div className="summary-card">
                        <h3>Tu Carrito</h3>
                        <div className="mini-item-list" style={{maxHeight: '300px', overflowY: 'auto', marginBottom: '20px', paddingRight: '10px'}}>
                            {cartItems.map(item => (
                                <div key={item.id} className="mini-item" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px'}}>
                                    <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                        <img 
                                            src={item.image ? (
                                                item.image.startsWith('http') 
                                                    ? item.image 
                                                    : (item.image.startsWith('/images/') 
                                                        ? `${BASE_URL}${item.image}` 
                                                        : `${BASE_URL}/images/${item.image}`)
                                            ) : '/images/sin imagen.jpeg'} 
                                            alt={item.name}
                                            style={{width: '45px', height: '45px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--gray-100)'}}
                                            onError={(e) => { e.target.src = '/images/sin imagen.jpeg'; }}
                                        />
                                        <div style={{display: 'flex', flexDirection: 'column'}}>
                                            <span style={{fontSize: '0.9rem', fontWeight: '700', color: 'var(--gray-800)', lineHeight: '1.2'}}>{item.name}</span>
                                            <span style={{fontSize: '0.8rem', color: 'var(--gray-500)'}}>{item.quantity} un. x ${item.price.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <span style={{fontWeight: '800', color: 'var(--primary-color)'}}>${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="summary-divider" style={{height: '1px', background: 'var(--gray-200)', margin: '15px 0'}}></div>
                        <div className="summary-row" style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                            <span>Subtotal</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                        <div className="summary-row" style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                            <span>Envío</span>
                            <span style={{color: 'var(--accent-color)', fontWeight: '700'}}>Gratis</span>
                        </div>
                        <div className="summary-divider" style={{height: '1px', background: 'var(--gray-200)', margin: '15px 0'}}></div>
                        <div className="summary-row total-row" style={{display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem', fontWeight: '800', color: 'var(--primary-color)'}}>
                            <span>Total</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )}
    </div>
    <Footer />
</div>
);

}

export default Checkout;