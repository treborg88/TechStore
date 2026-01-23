import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, BASE_URL } from '../../config';
import { apiFetch, apiUrl } from '../../services/apiClient';
import { getCurrentUser } from '../../services/authService';
import Invoice, { buildInvoiceData, generateInvoicePdfBlob } from '../common/Invoice';
import EmailVerification from '../auth/EmailVerification';
import LoginPage from '../auth/LoginPage';
import '../products/ProductDetail.css';
import './Checkout.css';
import { formatCurrency } from '../../utils/formatCurrency';

function Checkout({ cartItems, total, onSubmit, onClose, onClearCart, onOrderComplete, siteName, siteIcon, onLoginSuccess, currencyCode }) {
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
    const [_emailExists, setEmailExists] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [friendlyLoginMessage, setFriendlyLoginMessage] = useState('');

    const getSavedAddressDefaults = () => {
        const savedAddr = localStorage.getItem('user_default_address');
        if (!savedAddr) return { address: '', sector: '', city: '' };
        try {
            const parsed = JSON.parse(savedAddr);
            return {
                address: parsed.street || '',
                sector: parsed.sector || '',
                city: parsed.city || ''
            };
        } catch (e) {
            console.error('Error parsing saved address', e);
            return { address: '', sector: '', city: '' };
        }
    };

    const getUserDefaults = (userData) => {
        if (!userData) return { firstName: '', lastName: '', email: '', phone: '', address: '', sector: '', city: '' };
        const nameParts = userData.name ? userData.name.trim().split(' ').filter(Boolean) : [];
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const addressFromProfile = userData.street || userData.address || '';
        const savedAddress = getSavedAddressDefaults();
        return {
            firstName,
            lastName,
            email: userData.email || '',
            phone: userData.phone || '',
            address: addressFromProfile || savedAddress.address,
            sector: userData.sector || savedAddress.sector || '',
            city: userData.city || savedAddress.city || ''
        };
    };

    const applyDefaultsToForm = (defaults) => {
        setFormData((prev) => ({
            ...prev,
            firstName: prev.firstName || defaults.firstName,
            lastName: prev.lastName || defaults.lastName,
            email: prev.email || defaults.email,
            phone: prev.phone || defaults.phone,
            address: prev.address || defaults.address,
            sector: prev.sector || defaults.sector,
            city: prev.city || defaults.city
        }));
    };

    // Cargar y guardar progreso del checkout
    useEffect(() => {
        const user = getCurrentUser();
        const savedProgress = localStorage.getItem('checkout_progress');
        let hasSavedProgress = false;

        if (savedProgress) {
            try {
                const parsed = JSON.parse(savedProgress);
                // Si hay progreso guardado, lo restauramos
                // Si el usuario está logueado, solo restauramos si el email coincide o si estaba vacío
                if (!user || !parsed.formData.email || user.email === parsed.formData.email) {
                    setFormData(parsed.formData);
                    setStep(parsed.step || 1);
                    setIsEmailVerified(parsed.isEmailVerified || false);
                    setShowVerification(parsed.showVerification || false);
                    hasSavedProgress = true;
                }
            } catch (e) {
                console.error('Error al cargar progreso de checkout:', e);
            }
        }

        if (user) {
            const defaults = getUserDefaults(user);
            applyDefaultsToForm(defaults);
            setIsEmailVerified(true);
            setShowVerification(false);
            setShowLogin(false);
            setEmailExists(false);
            setFriendlyLoginMessage('');
            if (!hasSavedProgress) {
                setStep(1);
            }
        }
    }, []);

    // Guardar progreso cada vez que cambie algo relevante
    useEffect(() => {
        if (!orderCreated) {
            localStorage.setItem('checkout_progress', JSON.stringify({
                formData,
                step,
                isEmailVerified,
                showVerification
            }));
        }
    }, [formData, step, isEmailVerified, showVerification, orderCreated]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
        if (name === 'email') {
            setIsEmailVerified(false);
            setShowLogin(false);
            setEmailExists(false);
            setFriendlyLoginMessage('');
        }
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

        const isAuthenticated = !!getCurrentUser();

        // Preparar items para el backend
        const orderItems = cartItems.map(item => ({
            product_id: item.id,
            quantity: item.quantity
        }));

        let response;

        const blobToBase64 = (blob) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result || '';
                const base64 = String(result).split(',')[1] || '';
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        const sendInvoiceEmail = async (order) => {
            try {
                const invoiceData = buildInvoiceData({
                    order,
                    customerInfo: formData,
                    items: cartItems,
                    siteName,
                    siteIcon,
                    currencyCode
                });
                const pdfBlob = await generateInvoicePdfBlob(invoiceData);
                const pdfBase64 = await blobToBase64(pdfBlob);
                await apiFetch(apiUrl(`/orders/${order.id}/invoice-email`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pdfBase64,
                        email: formData.email
                    })
                });
            } catch (error) {
                console.error('Error enviando factura adjunta:', error);
            }
        };

        if (isAuthenticated) {
            // Usuario autenticado - enviar datos estructurados
            response = await apiFetch(apiUrl('/orders'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
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
                    notes: formData.notes,
                    skipEmail: true
                })
            });
        } else {
            // Usuario invitado - enviar datos estructurados
            response = await apiFetch(apiUrl('/orders/guest'), {
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
                    skipEmail: true,
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
    localStorage.removeItem('checkout_progress');

    await sendInvoiceEmail(order);

    if (onOrderComplete) {
        onOrderComplete(cartItems);
    }
    
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

const checkEmailExists = async (email) => {
    try {
        const response = await fetch(`${API_URL}/auth/check-email?email=${encodeURIComponent(email)}`);
        if (!response.ok) return false;
        const data = await response.json();
        return !!data.exists;
    } catch (err) {
        console.error('Error checking email:', err);
        return false;
    }
};

const applyUserToForm = (userData) => {
    if (!userData) return;
    const defaults = getUserDefaults(userData);
    applyDefaultsToForm(defaults);
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
                    currencyCode={currencyCode}
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
                            showLogin ? (
                                <div className="verification-step-wrapper">
                                    {friendlyLoginMessage && (
                                        <div style={{ marginBottom: '12px', color: '#2f855a', fontWeight: 600, textAlign: 'center' }}>
                                            {friendlyLoginMessage}
                                        </div>
                                    )}
                                    <LoginPage
                                        embedded={true}
                                        hideRegister={true}
                                        prefillEmail={formData.email}
                                        lockEmail={true}
                                        onLoginSuccess={async (userData) => {
                                            setIsEmailVerified(true);
                                            setShowLogin(false);
                                            setShowVerification(false);
                                            applyUserToForm(userData);
                                            if (onLoginSuccess) {
                                                await onLoginSuccess(userData);
                                            }
                                            setStep(2);
                                        }}
                                        onBackToHome={() => setShowLogin(false)}
                                    />
                                    <button 
                                        className="back-link" 
                                        onClick={() => setShowLogin(false)}
                                        style={{marginTop: '15px', background: 'none', border: 'none', color: 'var(--gray-500)', textDecoration: 'underline', width: '100%', cursor: 'pointer'}}
                                    >
                                        Regresar a editar datos
                                    </button>
                                </div>
                            ) : showVerification ? (
                                <div className="verification-step-wrapper">
                                    <EmailVerification
                                        initialEmail={formData.email}
                                        lockEmail={true}
                                        purpose="guest_checkout"
                                        onBeforeSend={async (email) => {
                                            const exists = await checkEmailExists(email);
                                            setEmailExists(exists);
                                            if (exists) {
                                                setFriendlyLoginMessage('Ya está registrado. Inicia sesión para continuar.');
                                                setShowLogin(true);
                                                setShowVerification(false);
                                                setError('');
                                                return false;
                                            }
                                            setError('');
                                            return true;
                                        }}
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
                            ) : (
                                <form id="step1-form" className="step-form" onSubmit={(e) => {
                                    e.preventDefault();
                                    const user = getCurrentUser();
                                    if (user || isEmailVerified) {
                                        setStep(2);
                                        return;
                                    }
                                    setEmailExists(false);
                                    setShowLogin(false);
                                    checkEmailExists(formData.email).then((exists) => {
                                        if (exists) {
                                            setEmailExists(true);
                                            setShowLogin(true);
                                            setShowVerification(false);
                                            setFriendlyLoginMessage('Ya está registrado. Inicia sesión para continuar.');
                                            setError('');
                                        } else {
                                            setError('');
                                            setShowVerification(true);
                                        }
                                    });
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
                                                    <span className="mini-item-meta">{item.quantity} un. x {formatCurrency(item.price, currencyCode)}</span>
                                                </div>
                                            </div>
                                            <span className="mini-item-price">{formatCurrency(item.price * item.quantity, currencyCode)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="summary-divider"></div>
                                <div className="summary-row">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(total, currencyCode)}</span>
                                </div>
                                <div className="summary-divider"></div>
                                <div className="summary-row total-row">
                                    <span>Total</span>
                                    <span>{formatCurrency(total, currencyCode)}</span>
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
                
                {step === 1 && !showVerification && !showLogin && (
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
